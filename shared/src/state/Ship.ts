export interface ShipInput {
  thrust: number;
  brake: number;
  strafe: number;
  pitch: number;
  boost: boolean;
}

export class Ship {
  x: number = 0;
  y: number = 0;
  z: number = 0;

  vx: number = 0;
  vy: number = 0;
  vz: number = 0;

  heading: number = 0;
  pitch: number = 0;
  bank: number = 0;

  thrustLevel: number = 0;

  constructor(spawnX: number = 0, spawnZ: number = 0) {
    this.x = spawnX;
    this.z = spawnZ;
  }

  toSnapshot(): ShipSnapshot {
    return {
      x: this.x, y: this.y, z: this.z,
      vx: this.vx, vy: this.vy, vz: this.vz,
      heading: this.heading,
      pitch: this.pitch,
      bank: this.bank,
      thrustLevel: this.thrustLevel,
    };
  }

  applySnapshot(snap: ShipSnapshot): void {
    this.x = snap.x; this.y = snap.y; this.z = snap.z;
    this.vx = snap.vx; this.vy = snap.vy; this.vz = snap.vz;
    this.heading = snap.heading;
    this.pitch = snap.pitch;
    this.bank = snap.bank;
    this.thrustLevel = snap.thrustLevel;
  }
}

export interface ShipSnapshot {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  heading: number;
  pitch: number;
  bank: number;
  thrustLevel: number;
}