import type { ShipSnapshotWire } from "@stargazing/shared";

const INTERP_DELAY_MS = 100;
const MAX_BUFFER_AGE_MS = 1000;

interface TimedSnapshot {
  receivedAt: number;
  snap: ShipSnapshotWire;
}

export class Interpolation {
  private buffer: TimedSnapshot[] = [];

  push(snap: ShipSnapshotWire, now: number): void {
    this.buffer.push({ receivedAt: now, snap });
    // Drop ancient entries.
    const cutoff = now - MAX_BUFFER_AGE_MS;
    while (this.buffer.length > 0 && this.buffer[0].receivedAt < cutoff) {
      this.buffer.shift();
    }
  }

  sample(now: number): ShipSnapshotWire | null {
    if (this.buffer.length === 0) return null;
    if (this.buffer.length === 1) return this.buffer[0].snap; // best we can do

    const renderTime = now - INTERP_DELAY_MS;

    let a: TimedSnapshot | null = null;
    let b: TimedSnapshot | null = null;
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (
        this.buffer[i].receivedAt <= renderTime &&
        this.buffer[i + 1].receivedAt >= renderTime
      ) {
        a = this.buffer[i];
        b = this.buffer[i + 1];
        break;
      }
    }

    if (!a || !b) {
      return this.buffer[this.buffer.length - 1].snap;
    }

    const span = b.receivedAt - a.receivedAt;
    const t = span > 0 ? (renderTime - a.receivedAt) / span : 0;
    return lerpSnap(a.snap, b.snap, t);
  }
}

function lerpSnap(
  a: ShipSnapshotWire,
  b: ShipSnapshotWire,
  t: number,
): ShipSnapshotWire {
  return {
    id: a.id,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    vx: a.vx + (b.vx - a.vx) * t,
    vy: a.vy + (b.vy - a.vy) * t,
    vz: a.vz + (b.vz - a.vz) * t,
    yaw: lerpAngle(a.yaw, b.yaw, t),
    pitch: lerpAngle(a.pitch, b.pitch, t),
    bank: lerpAngle(a.bank, b.bank, t),

    lastInputTick: b.lastInputTick,
  };
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Wrap to [-π, π] so we always take the short path around the circle.
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
