import { Ship } from './Ship.js';
import { SHIP } from '../tuning.js';

export class GameState {
  ships: Map<string, Ship> = new Map();
  tick: number = 0;

  addPlayer(id: string): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = SHIP.SPAWN_RADIUS;
    this.ships.set(
      id,
      new Ship(Math.cos(angle) * radius, Math.sin(angle) * radius),
    );
  }

  removePlayer(id: string): void {
    this.ships.delete(id);
  }
}