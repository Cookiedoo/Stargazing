import { Ship, ShipInput } from '../state/Ship.js';

// Tunable constants. These will move to shared/tuning.ts later.
const THRUST_FORCE = 30;     // units/sec^2 of acceleration
const STRAFE_FORCE = 25;
const LINEAR_DAMPING = 0.92; // velocity multiplier per second of drift
const TURN_RATE = 2.5;       // radians/sec of yaw from strafe

// step() mutates the ship in place. Pure with respect to (ship, input, dt).
// No randomness, no Date.now(), no Math.random() in here ever.
export function stepShip(ship: Ship, input: ShipInput, dt: number): void {
  // Strafe rotates the ship (bank-to-turn for now, simplified).
  ship.yaw += input.strafe * TURN_RATE * dt;

  // Thrust applies in the direction the ship is facing.
  const forwardX = Math.sin(ship.yaw);
  const forwardZ = Math.cos(ship.yaw);
  const accel = input.thrust * THRUST_FORCE;
  ship.vx += forwardX * accel * dt;
  ship.vz += forwardZ * accel * dt;

  // Damping (drag in space — arcade style, not realistic).
  // Math.pow(damping, dt) is the correct way to apply per-second damping
  // at variable dt without it changing behavior at different tick rates.
  const damp = Math.pow(LINEAR_DAMPING, dt);
  ship.vx *= damp;
  ship.vz *= damp;

  // Integrate position.
  ship.x += ship.vx * dt;
  ship.z += ship.vz * dt;

  // y stays at 0 — flat disc gameplay.
  ship.y = 0;
}