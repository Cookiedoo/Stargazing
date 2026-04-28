import type { Screen, ScreenManager } from "./ScreenManager.js";
import { SocketClient } from "../net/SocketClient.js";
import { MSG } from "@stargazing/shared";
import type { ServerMessage } from "@stargazing/shared";
import { MatchScreen } from "./MatchScreen.js";

export class LobbyScreen implements Screen {
  private manager: ScreenManager;
  private code: string;
  private socket: SocketClient;
  private logEl: HTMLDivElement | null = null;
  private myId = "";
  private keepSocket = false;

  constructor(manager: ScreenManager, code: string) {
    this.manager = manager;
    this.code = code;
    this.socket = new SocketClient(code);
  }

  async enter(root: HTMLElement): Promise<void> {
    const wrap = document.createElement("div");
    wrap.className = "screen";
    wrap.innerHTML = `
      <h2>Lobby</h2>
      <p>Room code: <span class="code">${this.code}</span></p>
      <p>Open this URL in another tab and join with the code above.</p>
      <div class="log" id="log"></div>
      <div style="display:flex; gap:0.5rem;">
        <input id="msg-input" placeholder="say something" />
        <button id="btn-send">Send</button>
      </div>
      <button id="btn-start" style="margin-top:1rem;">Start Match (solo test)</button>
    `;
    root.appendChild(wrap);
    this.logEl = wrap.querySelector("#log") as HTMLDivElement;

    this.log(`Connecting to ${this.code}...`);

    try {
      await this.socket.connect();
    } catch {
      this.log(`Failed to connect.`);
      return;
    }

    this.socket.onMessage((msg) => this.handleMessage(msg));

    // --- Send button + Enter key for chat ---
    const input = wrap.querySelector("#msg-input") as HTMLInputElement;
    const sendIt = () => {
      const text = input.value.trim();
      if (!text) return;
      this.socket.send({ type: MSG.HELLO, payload: { text, from: this.myId } });
      input.value = "";
    };
    wrap.querySelector("#btn-send")!.addEventListener("click", sendIt);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendIt();
    });

    wrap.querySelector("#btn-start")!.addEventListener("click", async () => {
      this.keepSocket = true;
      const match = new MatchScreen(this.manager, this.socket);
      match.setMyId(this.myId);
      await this.manager.go(match);
    });
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case MSG.WELCOME:
        this.myId = msg.payload.yourId;
        this.log(
          `Connected as ${this.myId}. ${msg.payload.players.length} player(s) here.`,
        );
        break;
      case MSG.PLAYER_JOINED:
        this.log(`-> ${msg.payload.id} joined`);
        break;
      case MSG.PLAYER_LEFT:
        this.log(`<- ${msg.payload.id} left`);
        break;
      case MSG.HELLO:
        this.log(`[${msg.payload.from}] ${msg.payload.text}`);
        break;
    }
  }

  private log(line: string): void {
    if (!this.logEl) return;
    const div = document.createElement("div");
    div.className = "log-line";
    div.textContent = line;
    this.logEl.appendChild(div);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  async exit(): Promise<void> {
    if (!this.keepSocket) {
      this.socket.disconnect();
    }
  }
}
