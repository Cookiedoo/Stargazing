import { KEY_BINDINGS } from './KeyBindings.js';
import { PointerLock } from '../engine/PointerLock.js';

export class DesktopControls {
  private keys: Set<string> = new Set();
  private mouseDown: boolean = false;
  private mouseRightDown: boolean = false;
  private pointerLock: PointerLock;
  private bound: boolean = false;

  constructor(pointerLock: PointerLock) {
    this.pointerLock = pointerLock;
  }

  attach(): void {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.clearAll);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  detach(): void {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.clearAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.clearAll();
  }

  private onKeyDown = (e: KeyboardEvent): void => { this.keys.add(e.code); };
  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.code); };
  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = true;
    if (e.button === 2) this.mouseRightDown = true;
  };
  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.mouseRightDown = false;
  };
  private clearAll = (): void => {
    this.keys.clear();
    this.mouseDown = false;
    this.mouseRightDown = false;
  };
  private onVisibility = (): void => {
    if (document.hidden) this.clearAll();
  };

  private isPressed(action: keyof typeof KEY_BINDINGS): boolean {
    for (const code of KEY_BINDINGS[action]) {
      if (this.keys.has(code)) return true;
    }
    return false;
  }

  get thrust(): number { return this.isPressed('THRUST') ? 1 : 0; }
  get brake(): number { return this.isPressed('BRAKE') ? 1 : 0; }

  get strafe(): number {
    let v = 0;
    if (this.isPressed('YAW_RIGHT')) v -= 1;
    if (this.isPressed('YAW_LEFT')) v += 1;
    return v;
  }

  pitch(deltaTime: number): number {
    const mouse = this.pointerLock.getMousePosition(deltaTime);
    const keyPitch =
      (this.isPressed('PITCH_UP') ? 1 : 0) -
      (this.isPressed('PITCH_DOWN') ? 1 : 0);
    return -mouse.y + keyPitch;
  }

  get boost(): boolean { return this.isPressed('BOOST'); }
  get firing(): boolean { return this.mouseDown; }
  get interact(): boolean { return this.isPressed('INTERACT') || this.mouseRightDown; }
}