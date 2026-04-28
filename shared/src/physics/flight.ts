import { Ship, ShipInput } from "../state/Ship.js";

const THRUST_FORCE = 30;
const LINEAR_DAMPING = 0.92;
const TURN_RATE = 2.5;

export function stepShip(ship: Ship, input: ShipInput, dt: number): void {
  ship.yaw += input.strafe * TURN_RATE * dt;

  const forwardX = Math.sin(ship.yaw);
  const forwardZ = Math.cos(ship.yaw);
  const accel = input.thrust * THRUST_FORCE;
  ship.vx += forwardX * accel * dt;
  ship.vz += forwardZ * accel * dt;

  const damp = Math.pow(LINEAR_DAMPING, dt);
  ship.vx *= damp;
  ship.vz *= damp;

  ship.x += ship.vx * dt;
  ship.z += ship.vz * dt;

  ship.y = 0;
}
