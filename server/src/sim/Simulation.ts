import { GameState, Ship, stepShip, type ShipInput } from "@stargazing/shared";

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
    this.latestInputs.set(id, { thrust: 0, strafe: 0, pitch: 0, boost: false });
    this.lastInputTick.set(id, 0);
  }

  removePlayer(id: string): void {
    this.state.removePlayer(id);
    this.latestInputs.delete(id);
    this.lastInputTick.delete(id);
  }

  receiveInput(playerId: string, input: ShipInput, clientTick: number): void {
    this.latestInputs.set(playerId, {
      thrust: Math.max(-1, Math.min(1, input.thrust)),
      strafe: Math.max(-1, Math.min(1, input.strafe)),
      pitch: Math.max(-1, Math.min(1, input.pitch)),
      boost: input.boost,
    });
    const prev = this.lastInputTick.get(playerId) ?? 0;
    if (clientTick > prev) this.lastInputTick.set(playerId, clientTick);
  }

  step(): void {
    this.state.tick++;
    for (const [id, ship] of this.state.ships) {
      const input = this.latestInputs.get(id) ?? {
        thrust: 0,
        strafe: 0,
        pitch: 0,
        boost: false,
      };
      stepShip(ship, input, TICK_DT);
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
        yaw: ship.yaw,
        pitch: ship.pitch,
        bank: ship.bank,
        lastInputTick: this.lastInputTick.get(id) ?? 0, // NEW
      });
    }
    return { tick: this.state.tick, ships };
  }
}

void Ship;
