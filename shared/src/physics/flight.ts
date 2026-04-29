import { Ship, ShipInput } from '../state/Ship.js';
import { SHIP } from '../tuning.js';

// Pure deterministic physics step. Same inputs + same state = same output.
// Runs identically on server (authoritative) and client (prediction).
//
// Coordinate convention (matches Three.js default):
//   +X = right, +Y = up, +Z = toward camera at default orientation
//   yaw = rotation around Y axis (turning)
//   pitch = rotation around local X axis (looking up/down)
//   bank = roll around local Z axis (cosmetic tilt during turns)

export function stepShip(ship: Ship, input: ShipInput, dt: number): void {
  // 1. Yaw responds directly to strafe input (no smoothing — feels snappy).
  ship.yaw += input.strafe * SHIP.YAW_RATE * dt;

  // 2. Pitch lerps toward the target pitch from input (smoothing — feels weighty).
  //    input.pitch is -1..1, scaled by MAX_PITCH to get the actual angle.
  const targetPitch = clampPitch(input.pitch * SHIP.MAX_PITCH);
  ship.pitch = lerp(ship.pitch, targetPitch, SHIP.PITCH_SMOOTH * dt);

  // 3. Bank lerps toward a target derived from strafe (cosmetic — visible in render).
  //    Negative because banking left during right-turn looks more natural.
  const targetBank = -input.strafe * SHIP.BANK_ANGLE_MAX;
  ship.bank = lerp(ship.bank, targetBank, SHIP.BANK_SMOOTH * dt);

  // 4. Compute 3D forward direction from yaw + pitch.
  //    See spherical coords explanation in the chunk doc.
  const cosPitch = Math.cos(ship.pitch);
  const forwardX = Math.sin(ship.yaw) * cosPitch;
  const forwardY = -Math.sin(ship.pitch);
  const forwardZ = Math.cos(ship.yaw) * cosPitch;

  // 5. Apply thrust in the 3D forward direction. Boost multiplies if active.
  const boostMult = input.boost && input.thrust > 0 ? SHIP.BOOST_MULTIPLIER : 1;
  const accel = input.thrust * SHIP.THRUST_FORCE * boostMult;
  ship.vx += forwardX * accel * dt;
  ship.vy += forwardY * accel * dt;
  ship.vz += forwardZ * accel * dt;

  // 6. Damping. dt-compensated so 0.992 means "0.8% gone per 1/60 sec".
  const damp = Math.pow(SHIP.VELOCITY_DAMPING, dt * 60);
  ship.vx *= damp;
  ship.vy *= damp;
  ship.vz *= damp;

  // 7. Integrate position.
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  ship.z += ship.vz * dt;
}

// Local helpers. Could move to shared/utils/math.ts later if useful elsewhere.
function lerp(a: number, b: number, t: number): number {
  // Clamp t to [0,1] in case dt is large after a tab-switch.
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return a + (b - a) * t;
}

function clampPitch(p: number): number {
  if (p > SHIP.MAX_PITCH) return SHIP.MAX_PITCH;
  if (p < -SHIP.MAX_PITCH) return -SHIP.MAX_PITCH;
  return p;
}