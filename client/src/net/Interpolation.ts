import type { ShipSnapshotWire } from "@stargazing/shared";
import { NETCODE } from "@stargazing/shared/tuning";

const INTERP_DELAY_MS = NETCODE.INTERPOLATION_DELAY_MS;
const MAX_BUFFER_MS = 2000;

interface TimedSnapshot {
  receivedAtMs: number;
  snap: ShipSnapshotWire;
}

export interface InterpolationDebug {
  bufferSize: number;
  interpolationAgeMs: number;
  holdingLatest: boolean;
}

export class Interpolation {
  private buffer: TimedSnapshot[] = [];
  private lastDebug: InterpolationDebug = {
    bufferSize: 0,
    interpolationAgeMs: 0,
    holdingLatest: false,
  };

  push(snap: ShipSnapshotWire, receivedAtMs: number): void {
    const last = this.buffer[this.buffer.length - 1];
    if (last && receivedAtMs < last.receivedAtMs) return;

    this.buffer.push({ receivedAtMs, snap });

    const cutoff = receivedAtMs - MAX_BUFFER_MS;
    while (this.buffer.length && this.buffer[0].receivedAtMs < cutoff) {
      this.buffer.shift();
    }
  }

  sample(nowMs: number): ShipSnapshotWire | null {
    this.lastDebug = {
      bufferSize: this.buffer.length,
      interpolationAgeMs: 0,
      holdingLatest: false,
    };

    if (this.buffer.length === 0) return null;

    const renderTimeMs = nowMs - INTERP_DELAY_MS;
    const first = this.buffer[0];
    const last = this.buffer[this.buffer.length - 1];

    this.lastDebug.interpolationAgeMs = Math.max(0, nowMs - last.receivedAtMs);

    if (renderTimeMs <= first.receivedAtMs) return first.snap;

    if (renderTimeMs >= last.receivedAtMs) {
      this.lastDebug.holdingLatest = true;
      return last.snap;
    }

    for (let i = 0; i < this.buffer.length - 1; i++) {
      const a = this.buffer[i];
      const b = this.buffer[i + 1];

      if (a.receivedAtMs <= renderTimeMs && b.receivedAtMs >= renderTimeMs) {
        const span = b.receivedAtMs - a.receivedAtMs;
        const t = span > 0 ? (renderTimeMs - a.receivedAtMs) / span : 0;
        return lerpSnap(a.snap, b.snap, t);
      }
    }

    this.lastDebug.holdingLatest = true;
    return last.snap;
  }

  get debug(): InterpolationDebug {
    return this.lastDebug;
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
