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

export class MatchScreen implements Screen {
  // @ts-expect-error reserved
  private manager: ScreenManager;
  private socket: SocketClient;

  private renderer: Renderer | null = null;
  private loop: GameLoop | null = null;
  private starfield: StarfieldView | null = null;
  private controls: DesktopControls;
  private router = new MessageRouter();

  // ShipView per playerId. Created on first snapshot, destroyed when ship leaves.
  private ships = new Map<string, ShipView>();
  private myId: string = '';
  private clientTick = 0;

  // Throttle input sends to ~30Hz instead of every render frame.
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
      <div>Sprint 2.5 — networked simulation</div>
      <div style="opacity:0.6;">WASD or arrows to move</div>
      <div style="opacity:0.6;" id="hud-info"></div>
    `;
    wrap.appendChild(hud);
    const info = hud.querySelector('#hud-info') as HTMLDivElement;

    const platform = detectPlatform();
    this.renderer = new Renderer(wrap, platform);
    this.starfield = new StarfieldView(this.renderer.scene);

    // The socket already received WELCOME during lobby — we don't get it again.
    // We need to ask the lobby for our ID. For Sprint 2.5, simplest fix:
    // re-derive it from the first snapshot. We'll know it's us when the
    // server tags it. Actually we need to pass myId in. Let's do it cleanly:
    // pass it in via the constructor next sprint. For now, we listen for
    // the next welcome, OR fall back: the Lobby socket already knows.
    // Simplest: have LobbyScreen pass myId. (See LobbyScreen tweak below.)

    // Wire message handling
    this.router.on(MSG.SNAPSHOT, (payload) => {
      // Reconcile ShipView set with snapshot.ships
      const presentIds = new Set<string>();
      for (const shipSnap of payload.ships) {
        presentIds.add(shipSnap.id);
        let view = this.ships.get(shipSnap.id);
        if (!view) {
          view = new ShipView(this.renderer!.scene, shipSnap.id === this.myId);
          this.ships.set(shipSnap.id, view);
        }
        view.applySnapshot(shipSnap);
      }
      // Remove views for ships that left.
      for (const [id, view] of this.ships) {
        if (!presentIds.has(id)) {
          view.dispose();
          this.ships.delete(id);
        }
      }
      info.textContent = `tick ${payload.tick} · ${payload.ships.length} ship(s)`;
    });

    this.socket.onMessage((msg) => this.router.dispatch(msg));
    this.controls.attach();

    this.loop = new GameLoop();
    this.loop.add((dt, elapsed) => {
      this.starfield?.update(dt, elapsed);

      // Send input at fixed rate
      if (elapsed - this.lastInputSend >= this.INPUT_SEND_INTERVAL) {
        this.lastInputSend = elapsed;
        this.clientTick++;
        this.socket.send({
          type: MSG.INPUT,
          payload: {
            thrust: this.controls.thrust,
            strafe: this.controls.strafe,
            clientTick: this.clientTick,
          },
        });
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
    this.starfield?.dispose();
    this.renderer?.dispose();
    this.loop = null;
    this.starfield = null;
    this.renderer = null;
  }
}