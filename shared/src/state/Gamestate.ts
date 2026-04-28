import { Ship } from './Ship.js';

export class GameState {
  // playerId -> Ship
  ships: Map<string, Ship> = new Map();
  // Server's authoritative tick number. Increments at fixed rate.
  tick: number = 0;

  addPlayer(id: string): void {
    // TODO: spawn at a random uncontested location, not origin.
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 10;
    this.ships.set(id, new Ship(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }

  removePlayer(id: string): void {
    this.ships.delete(id);
  }
}