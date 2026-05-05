import {
  Scene,
  IcosahedronGeometry,
  BufferAttribute,
  BufferGeometry,
  MeshBasicMaterial,
  PointsMaterial,
  Color,
  Mesh,
  Points,
  BackSide,
} from 'three';

const STAR_COUNT = 500;
const DOME_RADIUS = 15000;
const DOME_DETAIL = 1;

export class StarfieldView {
  private scene: Scene;
  private dome: Mesh;
  private stars: Points;

  constructor(scene: Scene) {
    this.scene = scene;
    this.dome = this.createDome();
    this.stars = this.createStars();
    this.scene.add(this.dome);
    this.scene.add(this.stars);
  }

  private createDome(): Mesh {
    const geometry = new IcosahedronGeometry(DOME_RADIUS, DOME_DETAIL);
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const bottomColor = new Color(0x000000);
    const topColor = new Color(0x111111);
    const vertexColor = new Color();

    for (let i = 0; i < count; i++) {
      const y = geometry.attributes.position.getY(i);
      const t = (y + DOME_RADIUS) / (DOME_RADIUS * 2);
      vertexColor.copy(bottomColor);
      vertexColor.lerp(topColor, t);
      colors[i * 3] = vertexColor.r;
      colors[i * 3 + 1] = vertexColor.g;
      colors[i * 3 + 2] = vertexColor.b;
    }

    geometry.setAttribute('color', new BufferAttribute(colors, 3));

    const material = new MeshBasicMaterial({
      vertexColors: true,
      side: BackSide,
      fog: false,
    });

    return new Mesh(geometry, material);
  }

  private createStars(): Points {
    const r = DOME_RADIUS * 0.9;
    const positions = new Float32Array(STAR_COUNT * 3);

    let i = 0;
    while (i < STAR_COUNT) {
      const x = (Math.random() * 2 - 1) * r;
      const y = (Math.random() * 2 - 1) * r;
      const z = (Math.random() * 2 - 1) * r;
      if (x * x + y * y + z * z > r * r) continue;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      i++;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));

    const material = new PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      sizeAttenuation: true,
      fog: false,
    });

    return new Points(geometry, material);
  }

  update(_dt: number, _elapsed: number): void {}

  dispose(): void {
    this.scene.remove(this.dome);
    this.scene.remove(this.stars);
    this.dome.geometry.dispose();
    (this.dome.material as MeshBasicMaterial).dispose();
    this.stars.geometry.dispose();
    (this.stars.material as PointsMaterial).dispose();
  }
}