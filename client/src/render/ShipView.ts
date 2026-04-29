import { BoxGeometry, Mesh, MeshStandardMaterial, Scene, Color } from 'three';

export class ShipView {
  private mesh: Mesh;
  private scene: Scene;

  constructor(scene: Scene, color: number = 0x6080ff) {
    this.scene = scene;
    const geom = new BoxGeometry(2, 1, 3);
    const mat = new MeshStandardMaterial({
      color: new Color(color),
      emissive: new Color(color).multiplyScalar(0.15),
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