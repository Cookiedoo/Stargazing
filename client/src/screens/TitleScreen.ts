import type { Screen } from "./ScreenManager.js";
import { createRoom } from "../net/RoomFlow.js";
import { LobbyScreen } from "./LobbyScreen.js";
import { isValidCodeFormat, normalizeRoomCode } from "@stargazing/shared";
import type { ScreenManager } from "./ScreenManager.js";

export class TitleScreen implements Screen {
  private manager: ScreenManager;

  constructor(manager: ScreenManager) {
    this.manager = manager;
  }

  enter(root: HTMLElement): void {
    const wrap = document.createElement("div");
    wrap.className = "screen";
    wrap.innerHTML = `
      <h1>STARGAZE</h1>
      <p>Capture Your Horizon</p>
      <button id="btn-create">Create Game</button>
      <div style="display:flex; gap:0.5rem;">
        <input id="code-input" placeholder="three words" autocapitalize="off" autocomplete="off" spellcheck="false" />
        <button id="btn-join">Join</button>
      </div>
      <div id="error" style="color:#ff8080; min-height: 1.5rem;"></div>
    `;
    root.appendChild(wrap);

    const errEl = wrap.querySelector("#error") as HTMLDivElement;
    const showErr = (msg: string) => (errEl.textContent = msg);

    wrap.querySelector("#btn-create")!.addEventListener("click", async () => {
      try {
        const code = await createRoom();
        await this.manager.go(new LobbyScreen(this.manager, code));
      } catch (e) {
        showErr(`Failed to create room: ${(e as Error).message}`);
      }
    });

    wrap.querySelector("#btn-join")!.addEventListener("click", async () => {
      const input = wrap.querySelector("#code-input") as HTMLInputElement;
      const code = normalizeRoomCode(input.value);
      if (!code || !isValidCodeFormat(code)) {
        showErr("Enter three words (any separator works)");
        return;
      }
      await this.manager.go(new LobbyScreen(this.manager, code));
    });
  }

  exit(): void {
    /* nothing to clean up yet */
  }
}
