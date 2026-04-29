import type { Screen, ScreenManager } from './ScreenManager.js';
import { Renderer } from '../engine/renderer.js';
import { GameLoop } from '../engine/loop.js';
import { detectPlatform } from '../engine/platform.js';
import { StarfieldView } from '../render/StarfieldView.js';
import { ShipView } from '../render/ShipView.js';
import { DesktopControls } from '../input/DesktopControls.js';
import { MessageRouter } from '../net/MessageRouter.js';
import type { SocketClient } from '../net/SocketClient.js';
import { MSG } from '@stargazing/shared';
import { ChaseCamera } from '../engine/ChaseCamera.js';
import { Prediction } from '../net/Prediction.js';
import { Interpolation } from '../net/Interpolation.js';

export class MatchScreen implements Screen {
  // @ts-expect-error reserved
  private manager: ScreenManager;
  private socket: SocketClient;

  private renderer: Renderer | null = null;
  private loop: GameLoop | null = null;
  private starfield: StarfieldView | null = null;
  private controls: DesktopControls;
  private router = new MessageRouter();

  // Visual ship views, one per playerId (including ours).
  private ships = new Map<string, ShipView>();

  // Local player state.
  private myId: string = '';
  private prediction = new Prediction();
  private chaseCamera: ChaseCamera | null = null;
  private hasSnappedCamera: boolean = false;

  // Remote players: one Interpolation buffer each.
  private remotes = new Map<string, Interpolation>();

  // Input throttle.
  private clientTick = 0;
  private lastInputSend = 0;
  private readonly INPUT_SEND_INTERVAL = 1 / 30;

  constructor(manager: ScreenManager, socket: SocketClient) {
    this.manager = manager;
    this.socket = socket;
    this.controls = new DesktopControls();
  }

  enter(root: HTMLElement): void {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative; width:100%; height:100%;';
    root.appendChild(wrap);

    const hud = document.createElement('div');
    hud.style.cssText =
      'position:absolute; top:0; left:0; padding:1rem; ' +
      'pointer-events:none; color:#e8ecf4; font-family:monospace; font-size:0.9em;';
    hud.innerHTML = `
      <div>Sprint 3 — netcode smoothing</div>
      <div style="opacity:0.6;">WASD or arrows to move</div>
      <div style="opacity:0.6;" id="hud-info"></div>
    `;
    wrap.appendChild(hud);
    const info = hud.querySelector('#hud-info') as HTMLDivElement;

    const platform = detectPlatform();
    this.renderer = new Renderer(wrap, platform);
    this.starfield = new StarfieldView(this.renderer.scene);

    this.chaseCamera = new ChaseCamera(this.renderer.camera);
    this.chaseCamera.setOffset(0, 6, 22);
    this.chaseCamera.setSmoothing(0.08, 0.18);

    // Snapshot handler: route each ship to either prediction (self) or interpolation (remotes).
    this.router.on(MSG.SNAPSHOT, (payload) => {
      const now = performance.now();
      const presentIds = new Set<string>();

      for (const shipSnap of payload.ships) {
        presentIds.add(shipSnap.id);

        // Ensure a ShipView exists for visual rendering.
        if (!this.ships.has(shipSnap.id)) {
          const isMine = shipSnap.id === this.myId;
          const color = isMine ? 0x60ff90 : 0x6080ff;
          this.ships.set(shipSnap.id, new ShipView(this.renderer!.scene, color));
        }

        if (shipSnap.id === this.myId) {
          // Reconcile our predicted state with server truth.
          this.prediction.applyServerSnapshot(shipSnap);
        } else {
          // Buffer for interpolation.
          let interp = this.remotes.get(shipSnap.id);
          if (!interp) {
            interp = new Interpolation();
            this.remotes.set(shipSnap.id, interp);
          }
          interp.push(shipSnap, now);
        }
      }

      // Remove ships that left.
      for (const [id, view] of this.ships) {
        if (!presentIds.has(id)) {
          view.dispose();
          this.ships.delete(id);
          this.remotes.delete(id);
        }
      }

      info.textContent = `tick ${payload.tick} · ${payload.ships.length} ship(s)`;
    });

    this.socket.onMessage((msg) => this.router.dispatch(msg));
    this.controls.attach();

    this.loop = new GameLoop();
    this.loop.add((dt, elapsed) => {
      this.starfield?.update(dt, elapsed);

      const currentInput = {
        thrust: this.controls.thrust,
        strafe: this.controls.strafe,
      };

      if (elapsed - this.lastInputSend >= this.INPUT_SEND_INTERVAL) {
        this.lastInputSend = elapsed;
        this.clientTick++;
        this.socket.send({
          type: MSG.INPUT,
          payload: { ...currentInput, clientTick: this.clientTick },
        });
      }

      this.prediction.applyInput(this.clientTick, currentInput, dt);

      this.prediction.update(dt);

      const myView = this.ships.get(this.myId);
      if (myView) {
        myView.applySnapshot({
          x: this.prediction.renderX,
          y: this.prediction.renderY,
          z: this.prediction.renderZ,
          yaw: this.prediction.renderYaw,
        });
      }

      const now = performance.now();
      for (const [id, interp] of this.remotes) {
        const sample = interp.sample(now);
        if (!sample) continue;
        const view = this.ships.get(id);
        if (view) view.applySnapshot(sample);
      }

      if (this.chaseCamera) {
        const target = {
          x: this.prediction.renderX,
          y: this.prediction.renderY,
          z: this.prediction.renderZ,
          yaw: this.prediction.renderYaw,
        };
        if (!this.hasSnappedCamera && this.ships.has(this.myId)) {
          this.chaseCamera.snapTo(target);
          this.hasSnappedCamera = true;
        } else if (this.hasSnappedCamera) {
          this.chaseCamera.update(dt, target);
        }
      }

      this.renderer?.render();
    });
    this.loop.start();
  }

  setMyId(id: string): void {
    this.myId = id;
  }

  exit(): void {
    this.loop?.stop();
    this.controls.detach();
    for (const view of this.ships.values()) view.dispose();
    this.ships.clear();
    this.remotes.clear();
    this.starfield?.dispose();
    this.renderer?.dispose();
    this.loop = null;
    this.starfield = null;
    this.renderer = null;
    this.chaseCamera = null;
    this.hasSnappedCamera = false;
  }
}