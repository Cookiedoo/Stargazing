import {
  NETCODE,
  Ship,
  stepShip,
  applyBoundary,
  type ShipInput,
  type ShipSnapshotWire,
} from "@stargazing/shared";

const MAX_BUFFERED_INPUTS = 240;

// Slower visual correction keeps the active camera from twitching every snapshot.
// Logical prediction is still corrected immediately; only reconciliation is eased.
const CORRECTION_DECAY = 3.5;

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
  private lastInput: ShipInput = zeroInput();
  private renderShip: Ship = new Ship();
  private gotInitialSnapshot = false;

  private correctionX = 0;
  private correctionY = 0;
  private correctionZ = 0;
  private correctionHeading = 0;
  private correctionPitch = 0;
  private correctionBank = 0;

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
    return false;
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

    const sanitized = sanitizeInput(input);
    const last = this.inputs[this.inputs.length - 1];

    if (last?.tick === clientTick) {
      last.input = sanitized;
      return;
    }

    if (last && clientTick < last.tick) return;

    this.inputs.push({ tick: clientTick, input: sanitized });

    if (this.inputs.length > MAX_BUFFERED_INPUTS) {
      this.inputs.splice(0, this.inputs.length - MAX_BUFFERED_INPUTS);
    }
  }

  predictTick(input: ShipInput): void {
    if (!this.gotInitialSnapshot) return;
    this.stepPredictedShip(sanitizeInput(input));
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

    const previousRenderX = this.renderX;
    const previousRenderY = this.renderY;
    const previousRenderZ = this.renderZ;
    const previousRenderHeading = this.renderHeading;
    const previousRenderPitch = this.renderPitch;
    const previousRenderBank = this.renderBank;

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

    this.lastCorrectionDistanceValue = Math.sqrt(
      rawCorrectionX * rawCorrectionX +
        rawCorrectionY * rawCorrectionY +
        rawCorrectionZ * rawCorrectionZ,
    );

    // Preserve the current rendered pose exactly, then ease it toward the newly
    // reconciled predicted ship. This prevents snapshot arrival from producing
    // an immediate visible pop.
    this.correctionX = previousRenderX - this.ship.x;
    this.correctionY = previousRenderY - this.ship.y;
    this.correctionZ = previousRenderZ - this.ship.z;
    this.correctionHeading = angleDelta(
      this.ship.heading,
      previousRenderHeading,
    );
    this.correctionPitch = angleDelta(this.ship.pitch, previousRenderPitch);
    this.correctionBank = angleDelta(this.ship.bank, previousRenderBank);

    this.lastVisualCorrectionDistanceValue = Math.sqrt(
      this.correctionX * this.correctionX +
        this.correctionY * this.correctionY +
        this.correctionZ * this.correctionZ,
    );
  }

  update(dt: number, renderLeadTime: number = 0): void {
    if (!this.gotInitialSnapshot) return;

    const correctionAlpha = 1 - Math.exp(-CORRECTION_DECAY * dt);

    this.correctionX += (0 - this.correctionX) * correctionAlpha;
    this.correctionY += (0 - this.correctionY) * correctionAlpha;
    this.correctionZ += (0 - this.correctionZ) * correctionAlpha;
    this.correctionHeading += (0 - this.correctionHeading) * correctionAlpha;
    this.correctionPitch += (0 - this.correctionPitch) * correctionAlpha;
    this.correctionBank += (0 - this.correctionBank) * correctionAlpha;

    const leadTime = clamp(renderLeadTime, 0, NETCODE.TICK_DT);
    const baseShip = leadTime > 0 ? this.renderShip : this.ship;

    if (leadTime > 0) {
      this.renderShip.applySnapshot(this.ship.toSnapshot());
      stepShip(this.renderShip, this.lastInput, leadTime);
      applyBoundary(this.renderShip, leadTime);
    }

    this.smoothX = baseShip.x + this.correctionX;
    this.smoothY = baseShip.y + this.correctionY;
    this.smoothZ = baseShip.z + this.correctionZ;
    this.smoothHeading = baseShip.heading + this.correctionHeading;
    this.smoothPitch = baseShip.pitch + this.correctionPitch;
    this.smoothBank = baseShip.bank + this.correctionBank;
  }

  private stepPredictedShip(input: ShipInput): void {
    this.lastInput = input;
    stepShip(this.ship, input, NETCODE.TICK_DT);
    applyBoundary(this.ship, NETCODE.TICK_DT);
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

function sanitizeInput(input: ShipInput): ShipInput {
  return {
    thrust: clamp01(input.thrust),
    brake: clamp01(input.brake),
    strafe: clampSym(input.strafe),
    pitch: clampSym(input.pitch),
    boost: !!input.boost,
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function clampSym(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < -1) return -1;
  if (v > 1) return 1;
  return v;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function zeroInput(): ShipInput {
  return {
    thrust: 0,
    brake: 0,
    strafe: 0,
    pitch: 0,
    boost: false,
  };
}

function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
