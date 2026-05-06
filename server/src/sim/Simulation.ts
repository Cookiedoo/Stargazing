import {
  GameState,
  stepShip,
  applyBoundary,
  type ShipInput,
  type ShipSnapshotWire,
} from "@stargazing/shared";

const TICK_RATE_HZ = 30;
export const TICK_DT = 1 / TICK_RATE_HZ;

interface PendingInput {
  tick: number;
  input: ShipInput;
}

interface SimulationSnapshot {
  tick: number;
  serverTick: number;
  ships: ShipSnapshotWire[];
}

export class Simulation {
  state: GameState;

  private pendingInputs: Map<string, PendingInput> = new Map();
  private currentInputs: Map<string, ShipInput> = new Map();
  private lastProcessedInputTick: Map<string, number> = new Map();

  constructor() {
    this.state = new GameState();
  }

  addPlayer(id: string): void {
    this.state.addPlayer(id);
    this.pendingInputs.delete(id);
    this.currentInputs.set(id, this.zeroInput());
    this.lastProcessedInputTick.set(id, 0);
  }

  removePlayer(id: string): void {
    this.state.removePlayer(id);
    this.pendingInputs.delete(id);
    this.currentInputs.delete(id);
    this.lastProcessedInputTick.delete(id);
  }

  receiveInput(playerId: string, input: ShipInput, clientTick: number): void {
    if (!Number.isFinite(clientTick)) return;

    const tick = Math.floor(clientTick);
    const lastProcessed = this.lastProcessedInputTick.get(playerId) ?? 0;

    if (tick <= lastProcessed) return;

    const pending = this.pendingInputs.get(playerId);

    if (pending && tick < pending.tick) return;

    this.pendingInputs.set(playerId, {
      tick,
      input: this.sanitizeInput(input),
    });
  }

  step(): void {
    this.state.tick++;

    for (const [id, ship] of this.state.ships) {
      const pending = this.pendingInputs.get(id);
      const lastProcessed = this.lastProcessedInputTick.get(id) ?? 0;

      let input = this.currentInputs.get(id) ?? this.zeroInput();
      let sampledTick: number | null = null;

      if (pending && pending.tick > lastProcessed) {
        input = pending.input;
        sampledTick = pending.tick;
        this.currentInputs.set(id, input);
        this.pendingInputs.delete(id);
      } else if (pending && pending.tick <= lastProcessed) {
        this.pendingInputs.delete(id);
      }

      stepShip(ship, input, TICK_DT);
      applyBoundary(ship);

      if (sampledTick !== null) {
        this.lastProcessedInputTick.set(id, sampledTick);
      }
    }
  }

  buildSnapshot(): SimulationSnapshot {
    const ships: ShipSnapshotWire[] = [];

    for (const [id, ship] of this.state.ships) {
      ships.push({
        id,
        x: ship.x,
        y: ship.y,
        z: ship.z,
        vx: ship.vx,
        vy: ship.vy,
        vz: ship.vz,
        heading: ship.heading,
        pitch: ship.pitch,
        bank: ship.bank,
        thrustLevel: ship.thrustLevel,
        lastInputTick: this.lastProcessedInputTick.get(id) ?? 0,
      });
    }

    return {
      tick: this.state.tick,
      serverTick: this.state.tick,
      ships,
    };
  }

  private sanitizeInput(input: ShipInput): ShipInput {
    return {
      thrust: clamp01(input.thrust),
      brake: clamp01(input.brake),
      strafe: clampSym(input.strafe),
      pitch: clampSym(input.pitch),
      boost: !!input.boost,
    };
  }

  private zeroInput(): ShipInput {
    return {
      thrust: 0,
      brake: 0,
      strafe: 0,
      pitch: 0,
      boost: false,
    };
  }
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
