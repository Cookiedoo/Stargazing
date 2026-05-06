import type { Screen, ScreenManager } from "./ScreenManager.js";
import { TitleSceneView } from "../render/TitleSceneView.js";
import { AuthModal } from "../ui/components/AuthModal.js";
import { showToast } from "../ui/components/Toast.js";
import { session } from "../account/Session.js";
import type { ApiAccount } from "../account/AuthApi.js";
import { SERVER_HTTP } from "../config.js";
import { UI } from "@stargazing/shared";
import { LobbyScreen } from "./LobbyScreen.js";
import "../ui/title.css";

export class TitleScreen implements Screen {
  private manager: ScreenManager;
  private rootEl: HTMLDivElement | null = null;
  private sceneView: TitleSceneView | null = null;
  private rafHandle: number = 0;
  private lastFrameTime: number = 0;
  private unsubscribe: (() => void) | null = null;
  private currentAccount: ApiAccount | null = null;

  constructor(manager: ScreenManager) {
    this.manager = manager;
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
    hud.className = "title-hud";
    wrap.appendChild(hud);

    const xpPercent = (UI.STARTING_XP / UI.XP_PER_LEVEL) * 100;

    hud.innerHTML = `
      <div class="title-top">
        <div class="title-stats">
          <div class="title-stat title-stat-xp">
            <span class="title-stat-icon"></span>
            <span>Level ${UI.STARTING_LEVEL}</span>
            <span style="margin-left: auto; opacity: 0.7; font-size: 0.85rem;">${UI.STARTING_XP} / ${UI.XP_PER_LEVEL}</span>
          </div>
          <div class="title-xp-bar"><div class="title-xp-fill" style="width: ${xpPercent}%"></div></div>
          <div class="title-stat title-stat-coins">
            <span class="title-stat-icon"></span>
            <span>${UI.STARTING_COINS.toLocaleString()} Coins</span>
          </div>
        </div>
        <button class="title-auth" data-auth-btn>Sign In / Up</button>
      </div>

      <div class="title-center">
        <div class="title-logo">
          <div class="title-logo-sub">PROJECT</div>
          <div class="title-logo-main">STARGAZE</div>
        </div>
        <div class="title-actions">
          <div class="title-action-row">
            <button class="title-btn title-btn-primary" data-play-btn disabled>PLAY</button>
            <button class="title-btn title-btn-secondary" data-create-btn>CREATE ROOM</button>
          </div>
          <div class="title-join">
            <span class="title-join-label">JOIN CODE:</span>
            <input class="title-join-input" data-join-input placeholder="three-word-code" />
            <button class="title-join-btn" data-join-btn>Join</button>
          </div>
        </div>
      </div>
    `;

    const authBtn = hud.querySelector<HTMLButtonElement>("[data-auth-btn]");
    const playBtn = hud.querySelector<HTMLButtonElement>("[data-play-btn]");
    const createBtn = hud.querySelector<HTMLButtonElement>("[data-create-btn]");
    const joinInput = hud.querySelector<HTMLInputElement>("[data-join-input]");
    const joinBtn = hud.querySelector<HTMLButtonElement>("[data-join-btn]");

    authBtn?.addEventListener("click", () => this.openAuth());
    playBtn?.addEventListener("click", () => showToast("Quick Match coming in Sprint 9 — try Create Room"));
    createBtn?.addEventListener("click", () => this.createRoom());
    joinBtn?.addEventListener("click", () => this.joinRoom(joinInput?.value ?? ""));
    joinInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.joinRoom(joinInput.value);
    });

    this.unsubscribe = session.subscribe((account) => {
      this.currentAccount = account;
      this.refreshAuthButton();
    });

    this.lastFrameTime = performance.now();
    this.tick();
  }

  exit(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = 0;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.sceneView?.dispose();
    this.sceneView = null;
    this.rootEl?.remove();
    this.rootEl = null;
  }

  private tick = (): void => {
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    this.sceneView?.update(dt);
    this.rafHandle = requestAnimationFrame(this.tick);
  };

  private refreshAuthButton(): void {
    if (!this.rootEl) return;
    const btn = this.rootEl.querySelector<HTMLButtonElement>("[data-auth-btn]");
    if (!btn) return;
    if (this.currentAccount && !this.currentAccount.isGuest) {
      btn.textContent = this.currentAccount.username ?? "Account";
    } else {
      btn.textContent = "Sign In / Up";
    }
  }

  private openAuth(): void {
    const modal = new AuthModal();
    modal.open();
  }

  private async createRoom(): Promise<void> {
    try {
      const r = await fetch(`${SERVER_HTTP}/room/create`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error(`server returned ${r.status}`);
      const data = (await r.json()) as { code: string };
      this.manager.go(new LobbyScreen(this.manager, data.code));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create room");
    }
  }

  private joinRoom(code: string): void {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) {
      showToast("Enter a room code");
      return;
    }
    this.manager.go(new LobbyScreen(this.manager, trimmed));
  }
}