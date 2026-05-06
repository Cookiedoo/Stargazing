import type { ShipSnapshotWire } from "@stargazing/shared";

const INTERP_DELAY_MS = 100;
const MAX_BUFFER_AGE_MS = 1000;
const MAX_EXTRAPOLATION_MS = 100;

interface TimedSnapshot {
  receivedAt: number;
  snap: ShipSnapshotWire;
}

export class Interpolation {
  private buffer: TimedSnapshot[] = [];

  push(
    snap: ShipSnapshotWire,
    _serverTimeMs: number,
    receivedAt: number,
  ): void {
    const last = this.buffer[this.buffer.length - 1];

    if (last && receivedAt <= last.receivedAt) {
      return;
    }

    this.buffer.push({
      receivedAt,
      snap,
    });

    const cutoff = receivedAt - MAX_BUFFER_AGE_MS;

    while (
      this.buffer.length > 0 &&
      this.buffer[0].receivedAt < cutoff
    ) {
      this.buffer.shift();
    }
  }

  sample(now: number): ShipSnapshotWire | null {
    if (this.buffer.length === 0) {
      return null;
    }

    if (this.buffer.length === 1) {
      return this.buffer[0].snap;
    }

    const renderTime = now - INTERP_DELAY_MS;

    const first = this.buffer[0];

    if (renderTime <= first.receivedAt) {
      return first.snap;
    }

    const last = this.buffer[this.buffer.length - 1];

    if (renderTime >= last.receivedAt) {
      const stallMs = renderTime - last.receivedAt;

      if (stallMs > MAX_EXTRAPOLATION_MS) {
        return last.snap;
      }

      const dt = stallMs / 1000;

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
        a.receivedAt <= renderTime &&
        b.receivedAt >= renderTime
      ) {
        const span = b.receivedAt - a.receivedAt;

        const t =
          span > 0
            ? (renderTime - a.receivedAt) / span
            : 0;

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
    thrustLevel:
      a.thrustLevel +
      (b.thrustLevel - a.thrustLevel) * t,
    lastInputTick: b.lastInputTick,
  };
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;

  while (diff > Math.PI) {
    diff -= Math.PI * 2;
  }

  while (diff < -Math.PI) {
    diff += Math.PI * 2;
  }

  return a + diff * t;
}