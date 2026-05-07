import {
  NETCODE,
  Ship,
  stepShip,
  applyBoundary,
  type ShipInput,
  type ShipSnapshotWire,
} from "@stargazing/shared";

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
  private previousShip: Ship = new Ship();

  private inputs: BufferedInput[] = [];
  private gotInitialSnapshot = false;
  private interpAlpha = 0;

  private correctionX = 0;
  private correctionY = 0;
  private correctionZ = 0;
  private correctionHeading = 0;
  private correctionPitch = 0;
  private correctionBank = 0;

  private lastRenderX = 0;
  private lastRenderY = 0;
  private lastRenderZ = 0;
  private lastRenderHeading = 0;
  private lastRenderPitch = 0;
  private lastRenderBank = 0;

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
      correctionSuppressed: false,
    };
  }

  get renderX(): number {
    return this.lastRenderX;
  }
  get renderY(): number {
    return this.lastRenderY;
  }
  get renderZ(): number {
    return this.lastRenderZ;
  }
  get renderHeading(): number {
    return this.lastRenderHeading;
  }
  get renderPitch(): number {
    return this.lastRenderPitch;
  }
  get renderBank(): number {
    return this.lastRenderBank;
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
    if (this.inputs.length > NETCODE.MAX_BUFFERED_INPUTS) {
      this.inputs.splice(0, this.inputs.length - NETCODE.MAX_BUFFERED_INPUTS);
    }
  }

  predictTick(input: ShipInput): void {
    if (!this.gotInitialSnapshot) return;
    copyShipState(this.ship, this.previousShip);
    stepShip(this.ship, sanitizeInput(input), NETCODE.TICK_DT);
    applyBoundary(this.ship, NETCODE.TICK_DT);
  }

  applyServerSnapshot(snap: ShipSnapshotWire): void {
    if (!this.gotInitialSnapshot) {
      this.ship.applySnapshot(snap);
      this.previousShip.applySnapshot(snap);
      this.lastAckTickValue = snap.lastInputTick;
      this.inputs = this.inputs.filter((e) => e.tick > snap.lastInputTick);

      for (const entry of this.inputs) {
        copyShipState(this.ship, this.previousShip);
        stepShip(this.ship, entry.input, NETCODE.TICK_DT);
        applyBoundary(this.ship, NETCODE.TICK_DT);
      }

      this.lastReplayCountValue = this.inputs.length;
      this.lastRenderX = this.ship.x;
      this.lastRenderY = this.ship.y;
      this.lastRenderZ = this.ship.z;
      this.lastRenderHeading = this.ship.heading;
      this.lastRenderPitch = this.ship.pitch;
      this.lastRenderBank = this.ship.bank;
      this.gotInitialSnapshot = true;
      return;
    }

    const prevRenderX = this.lastRenderX;
    const prevRenderY = this.lastRenderY;
    const prevRenderZ = this.lastRenderZ;
    const prevRenderHeading = this.lastRenderHeading;
    const prevRenderPitch = this.lastRenderPitch;
    const prevRenderBank = this.lastRenderBank;

    const prePredictedX = this.ship.x;
    const prePredictedY = this.ship.y;
    const prePredictedZ = this.ship.z;

    this.ship.applySnapshot(snap);
    this.previousShip.applySnapshot(snap);
    this.lastAckTickValue = snap.lastInputTick;
    this.inputs = this.inputs.filter((e) => e.tick > snap.lastInputTick);

    for (const entry of this.inputs) {
      copyShipState(this.ship, this.previousShip);
      stepShip(this.ship, entry.input, NETCODE.TICK_DT);
      applyBoundary(this.ship, NETCODE.TICK_DT);
    }

    this.lastReplayCountValue = this.inputs.length;

    const dx = prePredictedX - this.ship.x;
    const dy = prePredictedY - this.ship.y;
    const dz = prePredictedZ - this.ship.z;
    this.lastCorrectionDistanceValue = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const t = this.interpAlpha;
    const newLerpX = lerp(this.previousShip.x, this.ship.x, t);
    const newLerpY = lerp(this.previousShip.y, this.ship.y, t);
    const newLerpZ = lerp(this.previousShip.z, this.ship.z, t);
    const newLerpHeading = lerpAngle(this.previousShip.heading, this.ship.heading, t);
    const newLerpPitch = lerpAngle(this.previousShip.pitch, this.ship.pitch, t);
    const newLerpBank = lerpAngle(this.previousShip.bank, this.ship.bank, t);

    this.correctionX = prevRenderX - newLerpX;
    this.correctionY = prevRenderY - newLerpY;
    this.correctionZ = prevRenderZ - newLerpZ;
    this.correctionHeading = angleDelta(newLerpHeading, prevRenderHeading);
    this.correctionPitch = angleDelta(newLerpPitch, prevRenderPitch);
    this.correctionBank = angleDelta(newLerpBank, prevRenderBank);

    this.lastVisualCorrectionDistanceValue = Math.sqrt(
      this.correctionX * this.correctionX +
        this.correctionY * this.correctionY +
        this.correctionZ * this.correctionZ,
    );
  }

  update(dt: number, leadTime: number = 0): void {
    if (!this.gotInitialSnapshot) return;

    const correctionDecay = 1 - Math.exp(-NETCODE.PREDICTION_CORRECTION_DECAY * dt);
    this.correctionX *= 1 - correctionDecay;
    this.correctionY *= 1 - correctionDecay;
    this.correctionZ *= 1 - correctionDecay;
    this.correctionHeading *= 1 - correctionDecay;
    this.correctionPitch *= 1 - correctionDecay;
    this.correctionBank *= 1 - correctionDecay;

    const t = clamp(leadTime / NETCODE.TICK_DT, 0, 1);
    this.interpAlpha = t;

    this.lastRenderX = lerp(this.previousShip.x, this.ship.x, t) + this.correctionX;
    this.lastRenderY = lerp(this.previousShip.y, this.ship.y, t) + this.correctionY;
    this.lastRenderZ = lerp(this.previousShip.z, this.ship.z, t) + this.correctionZ;
    this.lastRenderHeading =
      lerpAngle(this.previousShip.heading, this.ship.heading, t) + this.correctionHeading;
    this.lastRenderPitch =
      lerpAngle(this.previousShip.pitch, this.ship.pitch, t) + this.correctionPitch;
    this.lastRenderBank =
      lerpAngle(this.previousShip.bank, this.ship.bank, t) + this.correctionBank;
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

function copyShipState(src: Ship, dst: Ship): void {
  dst.applySnapshot(src.toSnapshot());
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
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