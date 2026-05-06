import type { ShipSnapshotWire } from "@stargazing/shared";

const INTERP_DELAY_TICKS = 3;
const MAX_BUFFER_TICKS = 60;

interface TimedSnapshot {
  tick: number;
  snap: ShipSnapshotWire;
}

export class Interpolation {
  private buffer: TimedSnapshot[] = [];
  private latestServerTick = 0;

  push(snap: ShipSnapshotWire, serverTick: number): void {
    this.latestServerTick = Math.max(this.latestServerTick, serverTick);

    const last = this.buffer[this.buffer.length - 1];
    if (last && serverTick <= last.tick) return;

    this.buffer.push({ tick: serverTick, snap });

    const cutoff = serverTick - MAX_BUFFER_TICKS;
    while (this.buffer.length && this.buffer[0].tick < cutoff) {
      this.buffer.shift();
    }
  }

  sample(): ShipSnapshotWire | null {
    if (this.buffer.length === 0) return null;

    const renderTick = this.latestServerTick - INTERP_DELAY_TICKS;

    const first = this.buffer[0];
    const last = this.buffer[this.buffer.length - 1];

    if (renderTick <= first.tick) return first.snap;
    if (renderTick >= last.tick) return last.snap;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      const a = this.buffer[i];
      const b = this.buffer[i + 1];

      if (a.tick <= renderTick && b.tick >= renderTick) {
        const span = b.tick - a.tick;
        const t = span > 0 ? (renderTick - a.tick) / span : 0;
        return lerpSnap(a.snap, b.snap, t);
      }
    }

    return last.snap;
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
    heading: lerpAngle(a.heading, b.heading, t),
    pitch: lerpAngle(a.pitch, b.pitch, t),
    bank: lerpAngle(a.bank, b.bank, t),
    thrustLevel: a.thrustLevel + (b.thrustLevel - a.thrustLevel) * t,
    lastInputTick: b.lastInputTick,
  };
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
