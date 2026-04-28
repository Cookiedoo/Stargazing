import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Color,
} from 'three';

export class PlaceholderShipView {
  private mesh: Mesh;
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;

    const geom = new BoxGeometry(2, 1, 3);
    const mat = new MeshStandardMaterial({
      color: new Color(0x6080ff),
      emissive: new Color(0x1a2540),
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.3,
    });

    this.mesh = new Mesh(geom, mat);
    this.scene.add(this.mesh);
  }

  update(_dt: number, elapsed: number): void {
    this.mesh.rotation.y = elapsed * 0.5;
    this.mesh.position.y = Math.sin(elapsed * 1.5) * 0.3;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
  }
}