// Pure data class. No DOM, no Three.js. Same code runs on client and server.
// In Sprint 2.5 the client treats this as read-only state from the server.
// In Sprint 3 the client will also run step() locally for prediction.

export interface ShipInput {
  thrust: number;   // -1 to 1 (back to forward)
  strafe: number;   // -1 to 1 (left to right)
  // TODO Sprint 3: pitch, yaw, roll, fire, interact
}

export class Ship {
  // Position (units = world space, ~1 unit = 1 meter)
  x: number = 0;
  y: number = 0;
  z: number = 0;

  // Velocity per second
  vx: number = 0;
  vy: number = 0;
  vz: number = 0;

  // Yaw only for now — flat disc gameplay. Pitch/roll added Sprint 3.
  yaw: number = 0;

  constructor(spawnX: number = 0, spawnZ: number = 0) {
    this.x = spawnX;
    this.z = spawnZ;
  }

  // Serialize to the minimum data needed to reproduce visuals.
  // This is what goes in snapshots over the wire.
  toSnapshot(): ShipSnapshot {
    return {
      x: this.x, y: this.y, z: this.z,
      vx: this.vx, vy: this.vy, vz: this.vz,
      yaw: this.yaw,
    };
  }

  applySnapshot(snap: ShipSnapshot): void {
    this.x = snap.x; this.y = snap.y; this.z = snap.z;
    this.vx = snap.vx; this.vy = snap.vy; this.vz = snap.vz;
    this.yaw = snap.yaw;
  }
}

export interface ShipSnapshot {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number;
}