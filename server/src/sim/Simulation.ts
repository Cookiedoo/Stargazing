import { GameState, Ship, stepShip, type ShipInput } from '@stargazing/shared';

const TICK_RATE_HZ = 30;
export const TICK_DT = 1 / TICK_RATE_HZ;

// One simulation per room. Holds GameState + per-player latest input.
export class Simulation {
  state: GameState;
  // Latest input received from each player. Server replays this each tick.
  // If a player sends multiple inputs between ticks, only the latest applies.
  // (Sprint 3 fixes this with input buffering for proper reconciliation.)
  private latestInputs: Map<string, ShipInput> = new Map();

  constructor() {
    this.state = new GameState();
  }

  addPlayer(id: string): void {
    this.state.addPlayer(id);
    this.latestInputs.set(id, { thrust: 0, strafe: 0 });
  }

  removePlayer(id: string): void {
    this.state.removePlayer(id);
    this.latestInputs.delete(id);
  }

  // Called whenever a client sends an input message.
  receiveInput(playerId: string, input: ShipInput): void {
    // TODO: validate input bounds (clamp to -1..1) before storing.
    //   For now, trust local dev. Add InputValidator.ts in Sprint 4.
    this.latestInputs.set(playerId, {
      thrust: Math.max(-1, Math.min(1, input.thrust)),
      strafe: Math.max(-1, Math.min(1, input.strafe)),
    });
  }

  // Advance simulation by one tick.
  step(): void {
    this.state.tick++;
    for (const [id, ship] of this.state.ships) {
      const input = this.latestInputs.get(id) ?? { thrust: 0, strafe: 0 };
      stepShip(ship, input, TICK_DT);
    }
  }

  // Build a snapshot of all ships for broadcast.
  buildSnapshot(): { tick: number; ships: Array<{
    id: string; x: number; y: number; z: number;
    vx: number; vy: number; vz: number; yaw: number;
  }> } {
    const ships = [];
    for (const [id, ship] of this.state.ships) {
      ships.push({
        id,
        x: ship.x, y: ship.y, z: ship.z,
        vx: ship.vx, vy: ship.vy, vz: ship.vz,
        yaw: ship.yaw,
      });
    }
    return { tick: this.state.tick, ships };
  }
}

// Silence unused
void Ship;