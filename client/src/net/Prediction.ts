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
    this.buffer.push({ tick: clientTick, input });

    if (this.buffer.length > 240) {
      this.buffer.shift();
    }
  }

  applyInput(clientTick: number, input: ShipInput, dt: number): void {
    if (!this.gotInitialSnapshot) return;

    this.pushInput(clientTick, input);

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

    this.ship.applySnapshot(snap);

    this.buffer = this.buffer.filter((b) => b.tick > snap.lastInputTick);

    const tmp = new Ship();

    tmp.applySnapshot(snap);

    for (const entry of this.buffer) {
      stepShip(tmp, entry.input, NETCODE.TICK_DT);
    }

    const dx = tmp.x - this.ship.x;
    const dy = tmp.y - this.ship.y;
    const dz = tmp.z - this.ship.z;
    const dh = tmp.heading - this.ship.heading;

    const alpha = 0.12;

    this.errorX += dx * alpha;
    this.errorY += dy * alpha;
    this.errorZ += dz * alpha;
    this.errorHeading += dh * alpha;
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
