import {
  GameState,
  Ship,
  stepShip,
  applyBoundary,
  type ShipInput,
} from "@stargazing/shared";

const TICK_RATE_HZ = 30;
export const TICK_DT = 1 / TICK_RATE_HZ;

export class Simulation {
  state: GameState;
  private latestInputs: Map<string, ShipInput> = new Map();
  private lastInputTick: Map<string, number> = new Map();

  constructor() {
    this.state = new GameState();
  }

  addPlayer(id: string): void {
    this.state.addPlayer(id);
    this.latestInputs.set(id, this.zeroInput());
    this.lastInputTick.set(id, 0);
  }

  removePlayer(id: string): void {
    this.state.removePlayer(id);
    this.latestInputs.delete(id);
    this.lastInputTick.delete(id);
  }

  receiveInput(playerId: string, input: ShipInput, clientTick: number): void {
    this.latestInputs.set(playerId, {
      thrust: clamp01(input.thrust),
      brake: clamp01(input.brake),
      strafe: clampSym(input.strafe),
      pitch: clampSym(input.pitch),
      boost: !!input.boost,
    });

    const prev = this.lastInputTick.get(playerId) ?? 0;

    if (clientTick > prev) {
      this.lastInputTick.set(playerId, clientTick);
    }
  }

  step(): void {
    this.state.tick++;

    for (const [id, ship] of this.state.ships) {
      const input = this.latestInputs.get(id) ?? this.zeroInput();

      stepShip(ship, input, TICK_DT);
      applyBoundary(ship);
    }
  }

  buildSnapshot() {
    const ships = [];

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
        lastInputTick: this.lastInputTick.get(id) ?? 0,
      });
    }

    return {
      tick: this.state.tick,
      serverTimeMs: this.state.tick,
      ships,
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
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function clampSym(v: number): number {
  if (v < -1) return -1;
  if (v > 1) return 1;
  return v;
}

void Ship;
