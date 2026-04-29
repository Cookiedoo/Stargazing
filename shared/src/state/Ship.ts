export interface ShipInput {
  thrust: number; // -1 to 1 (back to forward)
  strafe: number; // -1 to 1 (left to right)
}

export class Ship {
  x: number = 0;
  y: number = 0;
  z: number = 0;

  vx: number = 0;
  vy: number = 0;
  vz: number = 0;

  yaw: number = 0;
  pitch: number = 0;
  bank: number = 0;

  constructor(spawnX: number = 0, spawnZ: number = 0) {
    this.x = spawnX;
    this.z = spawnZ;
  }

  toSnapshot(): ShipSnapshot {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      vx: this.vx,
      vy: this.vy,
      vz: this.vz,
      yaw: this.yaw,
      pitch: this.pitch,
      bank: this.bank,
    };
  }

  applySnapshot(snap: ShipSnapshot): void {
    this.x = snap.x;
    this.y = snap.y;
    this.z = snap.z;
    this.vx = snap.vx;
    this.vy = snap.vy;
    this.vz = snap.vz;
    this.yaw = snap.yaw;
    this.pitch = snap.pitch;
    this.bank = snap.bank;
  }
}

export interface ShipSnapshot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  bank: number;
}

export interface ShipInput {
  thrust: number;   // -1 to 1
  strafe: number;   // -1 to 1
  pitch: number;    // NEW: -1 to 1, mouse-Y or pitch keys
  boost: boolean;   // NEW
}