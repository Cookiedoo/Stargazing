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
import { VIEW } from '@stargazing/shared';

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
    const geometry = new IcosahedronGeometry(
      VIEW.STARFIELD.DOME_RADIUS,
      VIEW.STARFIELD.DOME_DETAIL,
    );
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const bottomColor = new Color(VIEW.STARFIELD.DOME_BOTTOM_COLOR);
    const topColor = new Color(VIEW.STARFIELD.DOME_TOP_COLOR);
    const vertexColor = new Color();

    for (let i = 0; i < count; i++) {
      const y = geometry.attributes.position.getY(i);
      const t =
        (y + VIEW.STARFIELD.DOME_RADIUS) / (VIEW.STARFIELD.DOME_RADIUS * 2);
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
    const r = VIEW.STARFIELD.DOME_RADIUS * VIEW.STARFIELD.STAR_RADIUS_FACTOR;
    const positions = new Float32Array(VIEW.STARFIELD.STAR_COUNT * 3);

    let i = 0;
    while (i < VIEW.STARFIELD.STAR_COUNT) {
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
      color: VIEW.STARFIELD.STAR_COLOR,
      size: VIEW.STARFIELD.STAR_SIZE,
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
