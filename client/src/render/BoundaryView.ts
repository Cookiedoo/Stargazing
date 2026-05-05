import {
  Scene,
  Mesh,
  PlaneGeometry,
  CylinderGeometry,
  ShaderMaterial,
  Color,
  DoubleSide,
  BackSide,
  Vector3,
} from 'three';
import { MAP } from '@stargazing/shared';

const GRID_SIZE = 400;
const GRID_DIVISIONS = 80;
const GRID_FADE_DIST = 300;

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG_PLANE = `
  varying vec2 vUv;
  uniform float uDivisions;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFade;

  void main() {
    vec2 grid = abs(fract(vUv * uDivisions) - 0.5);
    float line = min(grid.x, grid.y);
    float gridAlpha = 1.0 - smoothstep(0.0, 0.04, line);

    float dist = length(vUv - 0.5) * 2.0;
    float radial = 1.0 - smoothstep(0.5, 1.0, dist);

    float pulse = 0.7 + 0.3 * sin(uTime * 2.0);
    float alpha = gridAlpha * uFade * pulse * radial;

    if (alpha < 0.01) discard;

    vec3 color = uColor * (1.0 + (1.0 - line * 25.0) * 0.5);
    gl_FragColor = vec4(color, alpha * 0.9);
  }
`;

const FRAG_CYL = `
  varying vec2 vUv;
  uniform float uDivisions;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFade;

  void main() {
    vec2 grid = abs(fract(vUv * uDivisions) - 0.5);
    float line = min(grid.x, grid.y);
    float gridAlpha = 1.0 - smoothstep(0.0, 0.04, line);
    float pulse = 0.7 + 0.3 * sin(uTime * 2.0);
    float alpha = gridAlpha * uFade * pulse;
    if (alpha < 0.01) discard;
    vec3 color = uColor * (1.0 + (1.0 - line * 25.0) * 0.5);
    gl_FragColor = vec4(color, alpha * 0.9);
  }
`;

export class BoundaryView {
  private scene: Scene;
  private gridBottom: Mesh;
  private gridTop: Mesh;
  private wallCyl: Mesh;
  private elapsed: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    const planeGeo = new PlaneGeometry(GRID_SIZE, GRID_SIZE);

    this.gridBottom = new Mesh(planeGeo, this.makePlaneMat());
    this.gridBottom.rotation.x = -Math.PI / 2;
    this.gridBottom.position.y = MAP.Y_MIN - 50;
    this.scene.add(this.gridBottom);

    this.gridTop = new Mesh(planeGeo, this.makePlaneMat());
    this.gridTop.rotation.x = -Math.PI / 2;
    this.gridTop.position.y = MAP.Y_MAX + 50;
    this.scene.add(this.gridTop);

    const cylGeo = new CylinderGeometry(
      MAP.BOUNDARY_RADIUS, MAP.BOUNDARY_RADIUS, 2200, 64, 1, true,
    );
    this.wallCyl = new Mesh(cylGeo, this.makeCylMat());
    this.scene.add(this.wallCyl);
  }

  private makePlaneMat(): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_PLANE,
      uniforms: {
        uDivisions: { value: GRID_DIVISIONS },
        uColor: { value: new Color(0xff2200) },
        uTime: { value: 0 },
        uFade: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
  }

  private makeCylMat(): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_CYL,
      uniforms: {
        uDivisions: { value: GRID_DIVISIONS },
        uColor: { value: new Color(0xff2200) },
        uTime: { value: 0 },
        uFade: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      side: BackSide,
    });
  }

  update(dt: number, shipPos: Vector3): void {
    this.elapsed += dt;

    const cellSize = GRID_SIZE / GRID_DIVISIONS;
    const sx = Math.round(shipPos.x / cellSize) * cellSize;
    const sz = Math.round(shipPos.z / cellSize) * cellSize;
    const sy = Math.round(shipPos.y / cellSize) * cellSize;

    this.gridBottom.position.x = sx;
    this.gridBottom.position.z = sz;
    this.gridTop.position.x = sx;
    this.gridTop.position.z = sz;

    const distToBottom = Math.abs(shipPos.y - MAP.Y_MIN);
    const distToTop = Math.abs(shipPos.y - MAP.Y_MAX);
    const distFromEdge = MAP.BOUNDARY_RADIUS -
      Math.sqrt(shipPos.x * shipPos.x + shipPos.z * shipPos.z);

    (this.gridBottom.material as ShaderMaterial).uniforms.uFade.value =
      Math.max(0, 1 - distToBottom / GRID_FADE_DIST);
    (this.gridTop.material as ShaderMaterial).uniforms.uFade.value =
      Math.max(0, 1 - distToTop / GRID_FADE_DIST);
    (this.wallCyl.material as ShaderMaterial).uniforms.uFade.value =
      Math.max(0, 1 - distFromEdge / GRID_FADE_DIST);

    (this.gridBottom.material as ShaderMaterial).uniforms.uTime.value = this.elapsed;
    (this.gridTop.material as ShaderMaterial).uniforms.uTime.value = this.elapsed;
    (this.wallCyl.material as ShaderMaterial).uniforms.uTime.value = this.elapsed;

    this.wallCyl.position.y = sy;
  }

  dispose(): void {
    this.scene.remove(this.gridBottom);
    this.scene.remove(this.gridTop);
    this.scene.remove(this.wallCyl);
    this.gridBottom.geometry.dispose();
    this.gridTop.geometry.dispose();
    this.wallCyl.geometry.dispose();
    (this.gridBottom.material as ShaderMaterial).dispose();
    (this.gridTop.material as ShaderMaterial).dispose();
    (this.wallCyl.material as ShaderMaterial).dispose();
  }
}