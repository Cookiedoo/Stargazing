import {
  GameState,
  NETCODE,
  stepShip,
  applyBoundary,
  type ShipInput,
  type ShipSnapshotWire,
} from "@stargazing/shared";

export const TICK_DT = NETCODE.TICK_DT;

interface QueuedInput {
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

  private inputQueues: Map<string, QueuedInput[]> = new Map();
  private currentInputs: Map<string, ShipInput> = new Map();
  private lastProcessedInputTick: Map<string, number> = new Map();

  constructor() {
    this.state = new GameState();
  }

  addPlayer(id: string): void {
    this.state.addPlayer(id);
    this.inputQueues.set(id, []);
    this.currentInputs.set(id, this.zeroInput());
    this.lastProcessedInputTick.set(id, 0);
  }

  removePlayer(id: string): void {
    this.state.removePlayer(id);
    this.inputQueues.delete(id);
    this.currentInputs.delete(id);
    this.lastProcessedInputTick.delete(id);
  }

  receiveInput(playerId: string, input: ShipInput, clientTick: number): void {
    const queue = this.inputQueues.get(playerId);
    if (!queue) return;
    if (!Number.isFinite(clientTick)) return;

    const tick = Math.floor(clientTick);
    const lastProcessed = this.lastProcessedInputTick.get(playerId) ?? 0;

    if (tick <= lastProcessed) return;

    const sanitized = this.sanitizeInput(input);

    const existingIndex = queue.findIndex((entry) => entry.tick === tick);
    if (existingIndex >= 0) {
      queue[existingIndex] = { tick, input: sanitized };
      return;
    }

    let insertAt = queue.length;
    while (insertAt > 0 && queue[insertAt - 1].tick > tick) {
      insertAt--;
    }

    queue.splice(insertAt, 0, { tick, input: sanitized });

    if (queue.length > NETCODE.MAX_QUEUED_INPUTS) {
      queue.splice(0, queue.length - NETCODE.MAX_QUEUED_INPUTS);
    }
  }

  step(): void {
    this.state.tick++;

    for (const [id, ship] of this.state.ships) {
      const queue = this.inputQueues.get(id);
      const next = queue?.shift();

      let input = this.currentInputs.get(id) ?? this.zeroInput();

      if (next) {
        input = next.input;
        this.currentInputs.set(id, input);
        this.lastProcessedInputTick.set(id, next.tick);
      }

      stepShip(ship, input, TICK_DT);
      applyBoundary(ship, TICK_DT);
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
