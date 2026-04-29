import {
  Ship,
  stepShip,
  type ShipInput,
  type ShipSnapshotWire,
} from "@stargazing/shared";
import { InputBuffer } from "./InputBuffer.js";

export class Prediction {
  readonly ship: Ship = new Ship();
  private buffer: InputBuffer = new InputBuffer();
  private gotInitialSnapshot = false;
  private errorX = 0;
  private errorY = 0;
  private errorZ = 0;
  private errorYaw = 0;
  applyInput(clientTick: number, input: ShipInput, dt: number): void {
    if (!this.gotInitialSnapshot) return; // wait for spawn
    stepShip(this.ship, input, dt);
    this.buffer.push(clientTick, input, dt);
  }

  applyServerSnapshot(snap: ShipSnapshotWire): void {
    if (!this.gotInitialSnapshot) {
      this.ship.applySnapshot(snap);
      this.gotInitialSnapshot = true;
      return;
    }

    const predictedX = this.ship.x;
    const predictedY = this.ship.y;
    const predictedZ = this.ship.z;
    const predictedYaw = this.ship.yaw;

    this.ship.applySnapshot(snap);

    this.buffer.ackUpTo(snap.lastInputTick);

    for (const entry of this.buffer.all()) {
      stepShip(this.ship, entry.input, entry.dt);
    }

    this.errorX += predictedX - this.ship.x;
    this.errorY += predictedY - this.ship.y;
    this.errorZ += predictedZ - this.ship.z;
    this.errorYaw += predictedYaw - this.ship.yaw;
  }

  update(dt: number): void {
    const decay = 1 - Math.pow(0.001, dt);
    this.errorX *= 1 - decay;
    this.errorY *= 1 - decay;
    this.errorZ *= 1 - decay;
    this.errorYaw *= 1 - decay;
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
  get renderYaw(): number {
    return this.ship.yaw + this.errorYaw;
  }
}
