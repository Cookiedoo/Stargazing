import { Ship, ShipInput } from '../state/Ship.js';
import { NETCODE, SHIP } from '../tuning.js';

export function stepShip(ship: Ship, input: ShipInput, dt: number): void {
  ship.heading += input.strafe * SHIP.YAW_RATE * dt;

  const targetPitch = clamp(input.pitch * SHIP.MAX_PITCH, -SHIP.MAX_PITCH, SHIP.MAX_PITCH);
  ship.pitch = lerp(ship.pitch, targetPitch, SHIP.PITCH_SMOOTH * dt);

  const targetBank = -input.strafe * SHIP.BANK_ANGLE_MAX;
  ship.bank = lerp(ship.bank, targetBank, SHIP.BANK_SMOOTH * dt);

  const rawThrust = input.thrust - input.brake;
  ship.thrustLevel = lerp(ship.thrustLevel, rawThrust, perTickAlpha(0.07, dt));

  const cosPitch = Math.cos(ship.pitch);
  const forwardX = -Math.sin(ship.heading) * cosPitch;
  const forwardY = Math.sin(ship.pitch);
  const forwardZ = -Math.cos(ship.heading) * cosPitch;

  const boostMult = input.boost && rawThrust > 0 ? SHIP.BOOST_MULTIPLIER : 1;
  const accel = ship.thrustLevel * SHIP.THRUST_FORCE * boostMult;

  ship.vx += forwardX * accel * dt;
  ship.vy += forwardY * accel * dt;
  ship.vz += forwardZ * accel * dt;

  const damping = perTickScale(SHIP.VELOCITY_DAMPING, dt);
  ship.vx *= damping;
  ship.vy *= damping;
  ship.vz *= damping;

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  ship.z += ship.vz * dt;
}

function lerp(a: number, b: number, t: number): number {
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function perTickAlpha(alpha: number, dt: number): number {
  return 1 - perTickScale(1 - alpha, dt);
}

function perTickScale(value: number, dt: number): number {
  return Math.pow(value, Math.max(0, dt) / NETCODE.TICK_DT);
}
