import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Color,
} from 'three';

// One ShipView per ship in the game. Driven entirely by snapshots.
// In Sprint 3 we'll add interpolation so movement is smooth between snapshots.
// For Sprint 2.5: we just snap to the latest position. It will look stuttery.
// That's intentional — feeling the unfiltered network is a great teacher.

export class ShipView {
  private mesh: Mesh;
  private scene: Scene;

  constructor(scene: Scene, isLocal: boolean) {
    this.scene = scene;
    const geom = new BoxGeometry(2, 1, 3);
    const mat = new MeshStandardMaterial({
      // Local player gets a different tint so you can tell which is you.
      color: isLocal ? new Color(0x60ff90) : new Color(0x6080ff),
      emissive: isLocal ? new Color(0x153a20) : new Color(0x1a2540),
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.3,
    });
    this.mesh = new Mesh(geom, mat);
    this.scene.add(this.mesh);
  }

  applySnapshot(snap: { x: number; y: number; z: number; yaw: number }): void {
    this.mesh.position.set(snap.x, snap.y, snap.z);
    this.mesh.rotation.y = snap.yaw;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
  }
}