import { Ship } from '../state/Ship.js';
import { MAP, NETCODE } from '../tuning.js';

export function applyBoundary(ship: Ship, dt: number = NETCODE.TICK_DT): number {
  const dist = Math.sqrt(ship.x * ship.x + ship.z * ship.z);
  const distFromEdge = MAP.BOUNDARY_RADIUS - dist;

  let warningT = 0;

  if (distFromEdge < MAP.BOUNDARY_WARNING) {
    warningT = 1 - distFromEdge / MAP.BOUNDARY_WARNING;
    if (dist > 0) {
      const pushX = -ship.x / dist;
      const pushZ = -ship.z / dist;
      const tickScale = Math.max(0, dt) / NETCODE.TICK_DT;
      ship.vx += pushX * MAP.BOUNDARY_FORCE * warningT * tickScale;
      ship.vz += pushZ * MAP.BOUNDARY_FORCE * warningT * tickScale;
    }
  }

  if (ship.y < MAP.Y_MIN) {
    ship.y = MAP.Y_MIN;
    ship.vy = 0;
  }
  if (ship.y > MAP.Y_MAX) {
    ship.y = MAP.Y_MAX;
    ship.vy = 0;
  }

  return warningT;
}
