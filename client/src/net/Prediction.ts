import {
  NETCODE,
  Ship,
  stepShip,
  applyBoundary,
  type ShipInput,
  type ShipSnapshotWire,
} from "@stargazing/shared";

const MAX_BUFFERED_INPUTS = 240;
const CORRECTION_DECAY = 10;
const RENDER_SMOOTHING = 32;

const POSITION_CORRECTION_DEADZONE = 0.35;
const ANGLE_CORRECTION_DEADZONE = 0.006;

interface BufferedInput {
  tick: number;
  input: ShipInput;
}

export interface PredictionDebug {
  pendingInputs: number;
  lastAckTick: number;
  lastCorrectionDistance: number;
  lastVisualCorrectionDistance: number;
  lastReplayCount: number;
  correctionSuppressed: boolean;
}

export class Prediction {
  readonly ship: Ship = new Ship();

  private inputs: BufferedInput[] = [];
  private gotInitialSnapshot = false;

  private correctionX = 0;
  private correctionY = 0;
  private correctionZ = 0;
  private correctionHeading = 0;

  private smoothX = 0;
  private smoothY = 0;
  private smoothZ = 0;
  private smoothHeading = 0;
  private smoothPitch = 0;
  private smoothBank = 0;

  private lastAckTickValue = 0;
  private lastCorrectionDistanceValue = 0;
  private lastVisualCorrectionDistanceValue = 0;
  private lastReplayCountValue = 0;
  private correctionSuppressedValue = false;

  get hasSnapshot(): boolean {
    return this.gotInitialSnapshot;
  }

  get pendingInputs(): number {
    return this.inputs.length;
  }

  get lastAckTick(): number {
    return this.lastAckTickValue;
  }

  get lastCorrectionDistance(): number {
    return this.lastCorrectionDistanceValue;
  }

  get lastVisualCorrectionDistance(): number {
    return this.lastVisualCorrectionDistanceValue;
  }

  get lastReplayCount(): number {
    return this.lastReplayCountValue;
  }

  get correctionSuppressed(): boolean {
    return this.correctionSuppressedValue;
  }

  get debug(): PredictionDebug {
    return {
      pendingInputs: this.pendingInputs,
      lastAckTick: this.lastAckTick,
      lastCorrectionDistance: this.lastCorrectionDistance,
      lastVisualCorrectionDistance: this.lastVisualCorrectionDistance,
      lastReplayCount: this.lastReplayCount,
      correctionSuppressed: this.correctionSuppressed,
    };
  }

  pushInput(clientTick: number, input: ShipInput): void {
    if (clientTick <= 0) return;

    const last = this.inputs[this.inputs.length - 1];

    if (last?.tick === clientTick) {
      last.input = input;
      return;
    }

    if (last && clientTick < last.tick) return;

    this.inputs.push({ tick: clientTick, input });

    if (this.inputs.length > MAX_BUFFERED_INPUTS) {
      this.inputs.splice(0, this.inputs.length - MAX_BUFFERED_INPUTS);
    }
  }

  predictTick(input: ShipInput): void {
    if (!this.gotInitialSnapshot) return;
    this.stepPredictedShip(input);
  }

  applyServerSnapshot(snap: ShipSnapshotWire): void {
    if (!this.gotInitialSnapshot) {
      this.ship.applySnapshot(snap);
      this.lastAckTickValue = snap.lastInputTick;
      this.inputs = this.inputs.filter(
        (entry) => entry.tick > snap.lastInputTick,
      );

      for (const entry of this.inputs) {
        this.stepPredictedShip(entry.input);
      }

      this.lastReplayCountValue = this.inputs.length;
      this.seedRenderPose();
      this.gotInitialSnapshot = true;
      return;
    }

    const previousPredictedX = this.ship.x;
    const previousPredictedY = this.ship.y;
    const previousPredictedZ = this.ship.z;
    const previousPredictedHeading = this.ship.heading;
    const previousPredictedPitch = this.ship.pitch;
    const previousPredictedBank = this.ship.bank;

    const previousRenderX = this.renderX;
    const previousRenderY = this.renderY;
    const previousRenderZ = this.renderZ;
    const previousRenderHeading = this.renderHeading;

    this.ship.applySnapshot(snap);
    this.lastAckTickValue = snap.lastInputTick;

    this.inputs = this.inputs.filter(
      (entry) => entry.tick > snap.lastInputTick,
    );

    for (const entry of this.inputs) {
      this.stepPredictedShip(entry.input);
    }

    this.lastReplayCountValue = this.inputs.length;

    const rawCorrectionX = previousPredictedX - this.ship.x;
    const rawCorrectionY = previousPredictedY - this.ship.y;
    const rawCorrectionZ = previousPredictedZ - this.ship.z;
    const rawHeadingCorrection = Math.abs(
      angleDelta(this.ship.heading, previousPredictedHeading),
    );
    const rawPitchCorrection = Math.abs(
      angleDelta(this.ship.pitch, previousPredictedPitch),
    );
    const rawBankCorrection = Math.abs(
      angleDelta(this.ship.bank, previousPredictedBank),
    );

    const rawCorrectionDistance = Math.sqrt(
      rawCorrectionX * rawCorrectionX +
        rawCorrectionY * rawCorrectionY +
        rawCorrectionZ * rawCorrectionZ,
    );

    this.lastCorrectionDistanceValue = rawCorrectionDistance;

    const shouldSuppress =
      rawCorrectionDistance <= POSITION_CORRECTION_DEADZONE &&
      rawHeadingCorrection <= ANGLE_CORRECTION_DEADZONE &&
      rawPitchCorrection <= ANGLE_CORRECTION_DEADZONE &&
      rawBankCorrection <= ANGLE_CORRECTION_DEADZONE;

    this.correctionSuppressedValue = shouldSuppress;

    if (shouldSuppress) {
      this.correctionX = 0;
      this.correctionY = 0;
      this.correctionZ = 0;
      this.correctionHeading = 0;
      this.lastVisualCorrectionDistanceValue = 0;
      this.seedRenderPose();
      return;
    }

    this.correctionX = previousRenderX - this.ship.x;
    this.correctionY = previousRenderY - this.ship.y;
    this.correctionZ = previousRenderZ - this.ship.z;
    this.correctionHeading = angleDelta(
      this.ship.heading,
      previousRenderHeading,
    );

    this.lastVisualCorrectionDistanceValue = Math.sqrt(
      this.correctionX * this.correctionX +
        this.correctionY * this.correctionY +
        this.correctionZ * this.correctionZ,
    );
  }

  update(dt: number): void {
    if (!this.gotInitialSnapshot) return;

    const correctionAlpha = 1 - Math.exp(-CORRECTION_DECAY * dt);

    this.correctionX += (0 - this.correctionX) * correctionAlpha;
    this.correctionY += (0 - this.correctionY) * correctionAlpha;
    this.correctionZ += (0 - this.correctionZ) * correctionAlpha;
    this.correctionHeading += (0 - this.correctionHeading) * correctionAlpha;

    const targetX = this.ship.x + this.correctionX;
    const targetY = this.ship.y + this.correctionY;
    const targetZ = this.ship.z + this.correctionZ;
    const targetHeading = this.ship.heading + this.correctionHeading;

    const renderAlpha = 1 - Math.exp(-RENDER_SMOOTHING * dt);

    this.smoothX += (targetX - this.smoothX) * renderAlpha;
    this.smoothY += (targetY - this.smoothY) * renderAlpha;
    this.smoothZ += (targetZ - this.smoothZ) * renderAlpha;
    this.smoothHeading +=
      angleDelta(this.smoothHeading, targetHeading) * renderAlpha;
    this.smoothPitch +=
      angleDelta(this.smoothPitch, this.ship.pitch) * renderAlpha;
    this.smoothBank +=
      angleDelta(this.smoothBank, this.ship.bank) * renderAlpha;
  }

  private stepPredictedShip(input: ShipInput): void {
    stepShip(this.ship, input, NETCODE.TICK_DT);
    applyBoundary(this.ship);
  }

  private seedRenderPose(): void {
    this.smoothX = this.ship.x;
    this.smoothY = this.ship.y;
    this.smoothZ = this.ship.z;
    this.smoothHeading = this.ship.heading;
    this.smoothPitch = this.ship.pitch;
    this.smoothBank = this.ship.bank;
  }

  get renderX(): number {
    return this.smoothX;
  }

  get renderY(): number {
    return this.smoothY;
  }

  get renderZ(): number {
    return this.smoothZ;
  }

  get renderHeading(): number {
    return this.smoothHeading;
  }

  get renderPitch(): number {
    return this.smoothPitch;
  }

  get renderBank(): number {
    return this.smoothBank;
  }
}

function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
