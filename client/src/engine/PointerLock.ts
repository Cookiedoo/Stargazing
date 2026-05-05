const ABS_DECAY = 0.85;

export class PointerLock {
  private dx: number = 0;
  private dy: number = 0;
  private absX: number = 0;
  private absY: number = 0;
  private locked: boolean = false;
  private canvas: HTMLElement | null = null;

  attach(canvas: HTMLElement): void {
    this.canvas = canvas;

    canvas.addEventListener('click', this.onCanvasClick);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  detach(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.onCanvasClick);
    }
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.canvas = null;
    this.locked = false;
    this.dx = this.dy = 0;
    this.absX = this.absY = 0;
  }

  private onCanvasClick = (): void => {
    if (!this.locked && this.canvas) {
      this.canvas.requestPointerLock();
    }
  };

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) {
      this.absX = 0;
      this.absY = 0;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.dx += e.movementX;
    this.dy += e.movementY;
    this.absX = Math.min(1, Math.max(-1, this.absX + e.movementX / (window.innerWidth * 0.5)));
    this.absY = Math.min(1, Math.max(-1, this.absY + e.movementY / (window.innerHeight * 0.5)));
  };

  consumeDelta(): { dx: number; dy: number } {
    const out = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return out;
  }

  getMousePosition(deltaTime: number): { x: number; y: number } {
    const decay = Math.pow(ABS_DECAY, deltaTime * 60);
    this.absX *= decay;
    this.absY *= decay;
    return { x: this.absX, y: this.absY };
  }

  isLocked(): boolean {
    return this.locked;
  }
}