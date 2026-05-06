import {
  Ship,
  stepShip,
  NETCODE,
  type ShipInput,
  type ShipSnapshotWire,
} from "@stargazing/shared";

interface BufferedInput {
  tick: number;
  input: ShipInput;
}

export class Prediction {
  readonly ship: Ship = new Ship();
  private buffer: BufferedInput[] = [];

  private gotInitialSnapshot = false;

  private errorX = 0;
  private errorY = 0;
  private errorZ = 0;
  private errorHeading = 0;

  private accumulator = 0;

  pushInput(clientTick: number, input: ShipInput): void {
    if (clientTick <= 0) return;

    const last = this.buffer[this.buffer.length - 1];
    if (last?.tick === clientTick) {
      last.input = input;
      return;
    }
    if (last && clientTick < last.tick) return;

    this.buffer.push({ tick: clientTick, input });

    if (this.buffer.length > 240) {
      this.buffer.shift();
    }
  }

  applyInput(_clientTick: number, input: ShipInput, dt: number): void {
    if (!this.gotInitialSnapshot) return;

    this.accumulator += dt;
    const max = NETCODE.TICK_DT * 10;
    if (this.accumulator > max) this.accumulator = max;

    while (this.accumulator >= NETCODE.TICK_DT) {
      stepShip(this.ship, input, NETCODE.TICK_DT);
      this.accumulator -= NETCODE.TICK_DT;
    }
  }

  applyServerSnapshot(snap: ShipSnapshotWire): void {
    if (!this.gotInitialSnapshot) {
      this.ship.applySnapshot(snap);
      this.gotInitialSnapshot = true;
      return;
    }

    const renderXBefore = this.renderX;
    const renderYBefore = this.renderY;
    const renderZBefore = this.renderZ;
    const renderHeadingBefore = this.renderHeading;

    this.ship.applySnapshot(snap);

    this.buffer = this.buffer.filter((b) => b.tick > snap.lastInputTick);

    for (const entry of this.buffer) {
      stepShip(this.ship, entry.input, NETCODE.TICK_DT);
    }

    this.errorX = renderXBefore - this.ship.x;
    this.errorY = renderYBefore - this.ship.y;
    this.errorZ = renderZBefore - this.ship.z;
    this.errorHeading = angleDelta(this.ship.heading, renderHeadingBefore);
  }

  update(dt: number): void {
    const decay = Math.exp(-8 * dt);

    this.errorX *= decay;
    this.errorY *= decay;
    this.errorZ *= decay;
    this.errorHeading *= decay;
  }

  get renderX(): number {
    return this.ship.x + this.errorX;
  }
  get renderY(): number {
    return this.ship.y + this.errorY;
  }
  get renderZ(): number {
    return this.ship.z + this.errorZ;
  }
  get renderHeading(): number {
    return this.ship.heading + this.errorHeading;
  }
}

function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
