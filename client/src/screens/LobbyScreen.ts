import type { Screen, ScreenManager } from "./ScreenManager.js";
import { TitleSceneView } from "../render/TitleSceneView.js";
import { showToast } from "../ui/components/Toast.js";
import { TitleScreen } from "./TitleScreen.js";
import { MatchScreen } from "./MatchScreen.js";
import { SocketClient } from "../net/SocketClient.js";
import { MessageRouter } from "../net/MessageRouter.js";
import { MSG } from "@stargazing/shared";
import { session } from "../account/Session.js";
import "../ui/title.css";

interface PlayerInfo {
  id: string;
}

export class LobbyScreen implements Screen {
  private manager: ScreenManager;
  private code: string;
  private rootEl: HTMLDivElement | null = null;
  private sceneView: TitleSceneView | null = null;
  private socket: SocketClient | null = null;
  private router: MessageRouter = new MessageRouter();
  private rafHandle: number = 0;
  private lastFrameTime: number = 0;
  private myId: string = "";
  private players: Set<string> = new Set();
  private transferringSocket: boolean = false;

  constructor(manager: ScreenManager, code: string) {
    this.manager = manager;
    this.code = code;
  }

  enter(root: HTMLElement): void {
    const wrap = document.createElement("div");
    wrap.className = "title-screen";
    root.appendChild(wrap);
    this.rootEl = wrap;

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "title-canvas-wrap";
    wrap.appendChild(canvasWrap);

    this.sceneView = new TitleSceneView(canvasWrap);

    const hud = document.createElement("div");
    hud.className = "lobby-hud";
    wrap.appendChild(hud);

    hud.innerHTML = `
      <div class="lobby-top">
        <button class="lobby-leave" data-leave>Back</button>
        <div class="lobby-room-info">
          <div class="lobby-room-label">ROOM CODE</div>
          <div class="lobby-room-code">${this.escape(this.code)}</div>
        </div>
        <div class="lobby-spacer"></div>
      </div>

      <div class="lobby-main">
        <div class="lobby-players">
          <div class="lobby-section-title">Players</div>
          <div class="lobby-players-list" data-players></div>
        </div>
        <div class="lobby-chat">
          <div class="lobby-section-title">Chat</div>
          <div class="lobby-chat-log" data-chat-log></div>
          <form class="lobby-chat-form" data-chat-form>
            <input class="lobby-chat-input" data-chat-input placeholder="say something..." maxlength="200" autocomplete="off" />
            <button type="submit" class="lobby-chat-send">Send</button>
          </form>
        </div>
      </div>

      <div class="lobby-bottom">
        <button class="title-btn title-btn-primary" data-start>START MATCH</button>
      </div>
    `;

    const leaveBtn = hud.querySelector<HTMLButtonElement>("[data-leave]");
    const startBtn = hud.querySelector<HTMLButtonElement>("[data-start]");
    const chatForm = hud.querySelector<HTMLFormElement>("[data-chat-form]");
    const chatInput = hud.querySelector<HTMLInputElement>("[data-chat-input]");

    leaveBtn?.addEventListener("click", () => this.leave());
    startBtn?.addEventListener("click", () => this.startMatch());
    chatForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput?.value.trim() ?? "";
      if (!text || !this.socket) return;
      this.socket.send({ type: MSG.HELLO, payload: { text, from: this.myId } });
      this.appendLog("chat", `${session.displayName}: ${text}`);
      if (chatInput) chatInput.value = "";
    });

    this.connect();

    this.lastFrameTime = performance.now();
    this.tick();
  }

  exit(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = 0;
    if (!this.transferringSocket) {
      this.socket?.disconnect();
    }
    this.socket = null;
    this.sceneView?.dispose();
    this.sceneView = null;
    this.rootEl?.remove();
    this.rootEl = null;
  }

  private connect(): void {
    this.appendLog("system", `Connecting to ${this.code}...`);
    this.socket = new SocketClient(this.code);

    this.router.on(MSG.WELCOME, (payload: { yourId: string; players: PlayerInfo[] | string[] }) => {
      this.myId = payload.yourId;
      const ids = (payload.players ?? []).map((p) => (typeof p === "string" ? p : p.id));
      this.players = new Set(ids);
      this.players.add(this.myId);
      this.refreshPlayerList();
      this.appendLog("system", `Connected as ${this.shortId(this.myId)}. ${this.players.size} player(s) here.`);
    });

    this.router.on(MSG.PLAYER_JOINED, (payload: { id: string }) => {
      if (payload.id === this.myId) return;
      this.players.add(payload.id);
      this.refreshPlayerList();
      this.appendLog("system", `${this.shortId(payload.id)} joined`);
    });

    this.router.on(MSG.PLAYER_LEFT, (payload: { id: string }) => {
      this.players.delete(payload.id);
      this.refreshPlayerList();
      this.appendLog("system", `${this.shortId(payload.id)} left`);
    });

    this.router.on(MSG.HELLO, (payload: { text: string; from: string }) => {
      if (payload.from === this.myId) return;
      const sender = this.shortId(payload.from);
      this.appendLog("chat", `${sender}: ${payload.text}`);
    });

    this.socket.onMessage((msg) => this.router.dispatch(msg));
    this.socket.connect();
  }

  private tick = (): void => {
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    this.sceneView?.update(dt);
    this.rafHandle = requestAnimationFrame(this.tick);
  };

  private refreshPlayerList(): void {
    const el = this.rootEl?.querySelector<HTMLDivElement>("[data-players]");
    if (!el) return;
    el.innerHTML = "";
    for (const id of this.players) {
      const row = document.createElement("div");
      row.className = "lobby-player-row";
      const isMe = id === this.myId;
      const name = isMe ? `${session.displayName} (you)` : this.shortId(id);
      row.innerHTML = `<span class="lobby-player-dot"></span><span></span>`;
      const span = row.querySelectorAll("span")[1];
      if (span) span.textContent = name;
      el.appendChild(row);
    }
  }

  private appendLog(kind: "system" | "chat", text: string): void {
    const log = this.rootEl?.querySelector<HTMLDivElement>("[data-chat-log]");
    if (!log) return;
    const row = document.createElement("div");
    row.className = `lobby-chat-row lobby-chat-${kind}`;
    row.textContent = text;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  private shortId(id: string): string {
    return id.slice(0, 8);
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
  }

  private leave(): void {
    this.manager.go(new TitleScreen(this.manager));
  }

  private startMatch(): void {
    if (!this.socket) {
      showToast("Not connected");
      return;
    }
    this.transferringSocket = true;
    const match = new MatchScreen(this.manager, this.socket);
    match.setMyId(this.myId);
    this.manager.go(match);
  }
}