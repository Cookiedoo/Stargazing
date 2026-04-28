// For Sprint 2 there's no simulation yet, so onFrame just spins everything.

export type FrameCallback = (dt: number, elapsed: number) => void;

export class GameLoop {
  private callbacks = new Set<FrameCallback>();
  private rafId: number | null = null;
  private lastTime = 0;
  private startTime = 0;

  start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    this.startTime = this.lastTime;
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      const elapsed = (now - this.startTime) / 1000;
      for (const cb of this.callbacks) cb(dt, elapsed);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  add(cb: FrameCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }
}
