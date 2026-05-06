import type { ShipSnapshotWire } from "@stargazing/shared";

const INTERP_DELAY_MS = 100;
const MAX_BUFFER_AGE_MS = 1000;
const MAX_EXTRAPOLATION_MS = 200;

interface TimedSnapshot {
  serverTimeMs: number;
  snap: ShipSnapshotWire;
}

export class Interpolation {
  private buffer: TimedSnapshot[] = [];
  private clockOffsetMs: number | null = null;

  push(
    snap: ShipSnapshotWire,
    serverTimeMs: number,
    receivedAtLocalMs: number,
  ): void {
    const offsetEstimate = receivedAtLocalMs - serverTimeMs;

    if (this.clockOffsetMs === null || offsetEstimate > this.clockOffsetMs) {
      this.clockOffsetMs = offsetEstimate;
    }

    this.buffer.push({ serverTimeMs, snap });

    const cutoff = serverTimeMs - MAX_BUFFER_AGE_MS;
    while (this.buffer.length > 0 && this.buffer[0].serverTimeMs < cutoff) {
      this.buffer.shift();
    }
  }

  sample(nowLocalMs: number): ShipSnapshotWire | null {
    if (this.clockOffsetMs === null || this.buffer.length === 0) {
      return null;
    }

    const renderServerTime = nowLocalMs - this.clockOffsetMs - INTERP_DELAY_MS;

    if (renderServerTime <= this.buffer[0].serverTimeMs) {
      return this.buffer[0].snap;
    }

    const last = this.buffer[this.buffer.length - 1];
    if (renderServerTime >= last.serverTimeMs) {
      const stall = renderServerTime - last.serverTimeMs;
      if (stall > MAX_EXTRAPOLATION_MS) return last.snap;
      const dt = stall / 1000;
      return {
        ...last.snap,
        x: last.snap.x + last.snap.vx * dt,
        y: last.snap.y + last.snap.vy * dt,
        z: last.snap.z + last.snap.vz * dt,
      };
    }

    for (let i = 0; i < this.buffer.length - 1; i++) {
      const a = this.buffer[i];
      const b = this.buffer[i + 1];
      if (
        a.serverTimeMs <= renderServerTime &&
        b.serverTimeMs >= renderServerTime
      ) {
        const span = b.serverTimeMs - a.serverTimeMs;
        const t = span > 0 ? (renderServerTime - a.serverTimeMs) / span : 0;
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
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
