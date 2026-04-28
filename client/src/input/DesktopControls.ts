// Polling input. Listeners store state, getters read it. This is the right
// pattern for game input — the game loop reads "what's pressed right now"
// rather than "did a key event fire."

export class DesktopControls {
  private keys = new Set<string>();
  private bound = false;

  attach(): void {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  // Arrow functions preserve `this` in event handlers.
  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  // --- Logical actions: the rest of the game reads these, not raw keys ---
  get thrust(): number {
    let v = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) v += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) v -= 1;
    return v;
  }

  get strafe(): number {
    let v = 0;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) v += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) v -= 1;
    return v;
  }
}