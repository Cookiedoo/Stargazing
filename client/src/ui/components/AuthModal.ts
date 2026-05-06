import { session } from "../../account/Session.js";

type Mode = "login" | "register";

export class AuthModal {
  private root: HTMLDivElement | null = null;
  private mode: Mode = "register";
  private busy: boolean = false;
  private onCloseCallback: () => void;

  constructor(onClose: () => void = () => {}) {
    this.onCloseCallback = onClose;
  }

  open(): void {
    if (this.root) return;
    const root = document.createElement("div");
    root.className = "modal-backdrop";
    root.addEventListener("click", (e) => {
      if (e.target === root) this.close();
    });
    document.body.appendChild(root);
    this.root = root;
    this.render();
  }

  close(): void {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    this.onCloseCallback();
  }

  private render(): void {
    if (!this.root) return;
    this.root.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-tabs">
          <button class="modal-tab ${this.mode === "register" ? "active" : ""}" data-mode="register">Sign Up</button>
          <button class="modal-tab ${this.mode === "login" ? "active" : ""}" data-mode="login">Sign In</button>
        </div>
        <form class="modal-form" autocomplete="off">
          <input class="modal-input" name="username" placeholder="Username" autocomplete="username" required minlength="3" maxlength="20" />
          <input class="modal-input" name="password" type="password" placeholder="Password" autocomplete="${this.mode === "register" ? "new-password" : "current-password"}" required minlength="8" />
          <div class="modal-error" data-error></div>
          <div class="modal-actions">
            <button type="button" class="modal-btn modal-btn-secondary" data-cancel>Cancel</button>
            <button type="submit" class="modal-btn modal-btn-primary" data-submit>${this.mode === "register" ? "Create Account" : "Sign In"}</button>
          </div>
        </form>
      </div>
    `;

    const modal = this.root.querySelector(".modal") as HTMLDivElement;
    modal.addEventListener("click", (e) => e.stopPropagation());

    const tabs = this.root.querySelectorAll<HTMLButtonElement>(".modal-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const next = tab.dataset.mode as Mode;
        if (next !== this.mode) {
          this.mode = next;
          this.render();
        }
      });
    });

    const form = this.root.querySelector("form") as HTMLFormElement;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.submit(form);
    });

    const cancel = this.root.querySelector(
      "[data-cancel]",
    ) as HTMLButtonElement;
    cancel.addEventListener("click", () => this.close());

    const usernameInput =
      form.querySelector<HTMLInputElement>("[name=username]");
    usernameInput?.focus();
  }

  private async submit(form: HTMLFormElement): Promise<void> {
    if (this.busy || !this.root) return;
    const errorEl = this.root.querySelector("[data-error]") as HTMLDivElement;
    const submitBtn = this.root.querySelector(
      "[data-submit]",
    ) as HTMLButtonElement;
    const data = new FormData(form);
    const username = ((data.get("username") as string) ?? "").trim();
    const password = (data.get("password") as string) ?? "";

    errorEl.textContent = "";
    this.busy = true;
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent ?? "";
    submitBtn.textContent = "...";

    try {
      if (this.mode === "register") {
        await session.register(username, password);
      } else {
        await session.login(username, password);
      }
      this.close();
    } catch (err) {
      errorEl.textContent =
        err instanceof Error ? err.message : "Something went wrong";
    } finally {
      this.busy = false;
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  }
}
