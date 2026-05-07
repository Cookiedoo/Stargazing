import type { Screen, ScreenManager } from "./ScreenManager.js";
import { Renderer } from "../engine/renderer.js";
import { GameLoop } from "../engine/loop.js";
import { detectPlatform } from "../engine/platform.js";
import { PointerLock } from "../engine/PointerLock.js";
import { ChaseCamera } from "../engine/ChaseCamera.js";
import { StarfieldView } from "../render/StarfieldView.js";
import { BoundaryView } from "../render/BoundaryView.js";
import { ShipView } from "../render/ShipView.js";
import { DesktopControls } from "../input/DesktopControls.js";
import { MessageRouter } from "../net/MessageRouter.js";
import type { SocketClient } from "../net/SocketClient.js";
import { Prediction } from "../net/Prediction.js";
import { Interpolation } from "../net/Interpolation.js";
import { MSG, type ShipInput } from "@stargazing/shared";
import { Vector3 } from "three";

const PLAYER_COLORS = [
  0x60ff90, 0x6080ff, 0xff8060, 0xffcc40, 0xc060ff, 0x40ffd0, 0xff60c0,
  0xa0ff40,
];

const INPUT_SEND_HZ = 30;
const INPUT_SEND_INTERVAL = 1 / INPUT_SEND_HZ;

// The old value of 2 was useful for diagnostics, but too noisy for this scale.
// With a 9000-unit world, 2-10 unit corrections are expected under live latency.
const CORRECTION_WARN_DISTANCE = 25;
const CORRECTION_WARN_INTERVAL_MS = 1000;

function colorForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}

export class MatchScreen implements Screen {
  // @ts-expect-error reserved
  private manager: ScreenManager;
  private socket: SocketClient;

  private renderer: Renderer | null = null;
  private loop: GameLoop | null = null;
  private starfield: StarfieldView | null = null;
  private boundary: BoundaryView | null = null;
  private chaseCamera: ChaseCamera | null = null;
  private pointerLock: PointerLock;
  private controls: DesktopControls;
  private router = new MessageRouter();

  private ships = new Map<string, ShipView>();
  private myId: string = "";
  private myColor: number = 0x60ff90;
  private prediction = new Prediction();
  private hasSnappedCamera = false;

  private remotes = new Map<string, Interpolation>();

  private clientTick = 0;
  private latestServerTick = 0;
  private inputSendAccumulator = 0;
  private lastCorrectionWarnMs = 0;

  private _shipPos = new Vector3();

  constructor(manager: ScreenManager, socket: SocketClient) {
    this.manager = manager;
    this.socket = socket;
    this.pointerLock = new PointerLock();
    this.controls = new DesktopControls(this.pointerLock);
  }

  setMyId(id: string): void {
    this.myId = id;
    this.myColor = colorForId(id);
  }

  enter(root: HTMLElement): void {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative; width:100%; height:100%;";
    root.appendChild(wrap);

    const hud = document.createElement("div");
    hud.style.cssText =
      "position:absolute; top:0; left:0; padding:1rem; " +
      "pointer-events:none; color:#e8ecf4; font-family:monospace; font-size:0.9em;";
    hud.innerHTML = `
      <div>Sprint 3.5</div>
      <div style="opacity:0.6;">Click to lock pointer - Space=thrust - B=brake - A/D=yaw - Mouse=pitch - Shift=boost</div>
      <div style="opacity:0.6;" id="hud-info"></div>
      <div style="opacity:0.6;" id="hud-netcode"></div>
    `;
    wrap.appendChild(hud);
    const info = hud.querySelector("#hud-info") as HTMLDivElement;
    const netInfo = hud.querySelector("#hud-netcode") as HTMLDivElement;

    const platform = detectPlatform();
    this.renderer = new Renderer(wrap, platform);

    this.pointerLock.attach(this.renderer.gl.domElement);
    this.controls.attach();

    this.starfield = new StarfieldView(this.renderer.scene);
    this.boundary = new BoundaryView(this.renderer.scene);

    this.chaseCamera = new ChaseCamera(this.renderer.camera);
    this.chaseCamera.setOffset(0, 20, 50);
    this.chaseCamera.setLookAtOffset(0, 8, 0);
    this.chaseCamera.setSmoothing(10, 14);
    this.chaseCamera.setTargetSmoothing(18);

    this.router.on(MSG.SNAPSHOT, (payload) => {
      const receivedAtMs = performance.now();
      const presentIds = new Set<string>();

      this.latestServerTick = payload.tick;

      for (const shipSnap of payload.ships) {
        presentIds.add(shipSnap.id);

        if (!this.ships.has(shipSnap.id)) {
          const color =
            shipSnap.id === this.myId ? this.myColor : colorForId(shipSnap.id);
          this.ships.set(
            shipSnap.id,
            new ShipView(this.renderer!.scene, color),
          );
        }

        if (shipSnap.id === this.myId) {
          this.prediction.applyServerSnapshot(shipSnap);
        } else {
          let interp = this.remotes.get(shipSnap.id);
          if (!interp) {
            interp = new Interpolation();
            this.remotes.set(shipSnap.id, interp);
          }
          interp.push(shipSnap, receivedAtMs);
        }
      }

      for (const [id, view] of this.ships) {
        if (!presentIds.has(id)) {
          view.dispose();
          this.ships.delete(id);
          this.remotes.delete(id);
        }
      }

      info.textContent = `server ${payload.tick} - ${payload.ships.length} ship(s)`;
    });

    this.socket.onMessage((msg) => this.router.dispatch(msg));

    this.loop = new GameLoop();
    this.loop.add((dt, elapsed) => {
      this.inputSendAccumulator += dt;

      while (this.inputSendAccumulator >= INPUT_SEND_INTERVAL) {
        this.inputSendAccumulator -= INPUT_SEND_INTERVAL;

        const input = this.readInput(INPUT_SEND_INTERVAL);
        this.clientTick++;
        this.prediction.pushInput(this.clientTick, input);
        this.prediction.predictTick(input);

        this.socket.send({
          type: MSG.INPUT,
          payload: {
            ...input,
            clientTick: this.clientTick,
          },
        });
      }

      this.prediction.update(dt);

      const myView = this.ships.get(this.myId);
      if (myView && this.prediction.hasSnapshot) {
        myView.applySnapshot({
          x: this.prediction.renderX,
          y: this.prediction.renderY,
          z: this.prediction.renderZ,
          vx: this.prediction.ship.vx,
          vy: this.prediction.ship.vy,
          vz: this.prediction.ship.vz,
          heading: this.prediction.renderHeading,
          pitch: this.prediction.renderPitch,
          bank: this.prediction.renderBank,
          thrustLevel: this.prediction.ship.thrustLevel,
        });
      }

      const nowMs = performance.now();
      let remoteBufferSize = 0;
      let remoteAgeMs = 0;
      let remoteHolding = false;

      for (const [id, interp] of this.remotes) {
        const sample = interp.sample(nowMs);
        if (!sample) continue;

        const debug = interp.debug;
        remoteBufferSize = Math.max(remoteBufferSize, debug.bufferSize);
        remoteAgeMs = Math.max(remoteAgeMs, debug.interpolationAgeMs);
        remoteHolding = remoteHolding || debug.holdingLatest;

        const view = this.ships.get(id);
        if (view) view.applySnapshot(sample);
      }

      for (const view of this.ships.values()) {
        view.update(dt);
      }

      if (
        this.chaseCamera &&
        this.ships.has(this.myId) &&
        this.prediction.hasSnapshot
      ) {
        const target = {
          x: this.prediction.renderX,
          y: this.prediction.renderY,
          z: this.prediction.renderZ,
          heading: this.prediction.renderHeading,
          pitch: this.prediction.renderPitch,
        };
        if (!this.hasSnappedCamera) {
          this.chaseCamera.snapTo(target);
          this.hasSnappedCamera = true;
        } else {
          this.chaseCamera.update(dt, target);
        }
      }

      if (this.boundary && this.prediction.hasSnapshot) {
        this._shipPos.set(
          this.prediction.renderX,
          this.prediction.renderY,
          this.prediction.renderZ,
        );
        this.boundary.update(dt, this._shipPos);
      }

      this.updateNetcodeHud(netInfo, remoteBufferSize, remoteAgeMs, remoteHolding);
      this.warnOnCorrectionSpike(nowMs);

      this.starfield?.update(dt, elapsed);

      this.renderer?.render();
    });
    this.loop.start();
  }

  exit(): void {
    this.loop?.stop();
    this.controls.detach();
    this.pointerLock.detach();
    for (const view of this.ships.values()) view.dispose();
    this.ships.clear();
    this.remotes.clear();
    this.boundary?.dispose();
    this.starfield?.dispose();
    this.renderer?.dispose();
    this.loop = null;
    this.boundary = null;
    this.starfield = null;
    this.renderer = null;
    this.chaseCamera = null;
    this.hasSnappedCamera = false;
  }

  private readInput(dt: number): ShipInput {
    return {
      thrust: clamp01(this.controls.thrust),
      brake: clamp01(this.controls.brake),
      strafe: clampSym(this.controls.strafe),
      pitch: clampSym(this.controls.pitch(dt)),
      boost: this.controls.boost,
    };
  }

  private updateNetcodeHud(
    netInfo: HTMLDivElement,
    remoteBufferSize: number,
    remoteAgeMs: number,
    remoteHolding: boolean,
  ): void {
    const debug = this.prediction.debug;
    const inputGap = this.clientTick - debug.lastAckTick;

    netInfo.textContent =
      `server ${this.latestServerTick} client ${this.clientTick} ` +
      `ack ${debug.lastAckTick} gap ${inputGap} ` +
      `pending ${debug.pendingInputs} replay ${debug.lastReplayCount} ` +
      `corr ${debug.lastCorrectionDistance.toFixed(2)} ` +
      `visual ${debug.lastVisualCorrectionDistance.toFixed(2)} ` +
      `remoteBuf ${remoteBufferSize} remoteAge ${remoteAgeMs.toFixed(0)}ms ` +
      `hold ${remoteHolding ? "Y" : "N"}`;
  }

  private warnOnCorrectionSpike(nowMs: number): void {
    if (
      this.prediction.lastCorrectionDistance < CORRECTION_WARN_DISTANCE ||
      nowMs - this.lastCorrectionWarnMs < CORRECTION_WARN_INTERVAL_MS
    ) {
      return;
    }

    this.lastCorrectionWarnMs = nowMs;
    console.warn("Prediction correction spike", {
      clientTick: this.clientTick,
      serverTick: this.latestServerTick,
      ...this.prediction.debug,
    });
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function clampSym(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < -1) return -1;
  if (v > 1) return 1;
  return v;
}
