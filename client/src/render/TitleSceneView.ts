import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { assets } from "../engine/assetLoader.js";
import { DefaultSpaceScene } from "./DefaultSpaceScene.js";
import { DEBUG } from "@stargazing/shared";

const ROCKET_BASE_Y = -4.5;
const ASTRONAUT_BASE_Y = 0;

export class TitleSceneView {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private container: HTMLElement;

  private space: DefaultSpaceScene;
  private foreground: Group;
  private rocketRoot: Group;
  private astronautRoot: Group;
  private surface: Mesh;

  private elapsed: number = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000005, 1);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.scene = new Scene();
    this.scene.background = new Color(0x000005);

    this.camera = new PerspectiveCamera(50, 1, 0.1, 12000);
    this.camera.position.set(0, 5, 15);
    this.camera.lookAt(0, 2, 0);

    this.space = new DefaultSpaceScene(this.scene);

    const key = new DirectionalLight(0xffeac0, 1.0);
    key.position.set(-8, 10, 6);
    this.scene.add(key);

    const fill = new DirectionalLight(0x6080ff, 0.45);
    fill.position.set(8, 4, -4);
    this.scene.add(fill);

    this.foreground = new Group();
    this.scene.add(this.foreground);

    const surfaceGeo = new IcosahedronGeometry(34, 2);
    const surfacePositions = surfaceGeo.attributes.position;
    for (let i = 0; i < surfacePositions.count; i++) {
      const x = surfacePositions.getX(i);
      const y = surfacePositions.getY(i);
      const z = surfacePositions.getZ(i);
      const noise =
        (Math.sin(x * 0.5) + Math.cos(z * 0.5) + Math.sin(y * 0.7)) * 0.6;
      const len = Math.sqrt(x * x + y * y + z * z);
      const factor = (len + noise) / len;
      surfacePositions.setXYZ(i, x * factor, y * factor, z * factor);
    }
    surfacePositions.needsUpdate = true;

    const surfaceMat = new MeshStandardMaterial({
      color: 0x4a5a8a,
      emissive: 0x101830,
      emissiveIntensity: 0.2,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    this.surface = new Mesh(surfaceGeo, surfaceMat);
    this.surface.position.set(0, -35.5, 0);
    this.foreground.add(this.surface);

    this.rocketRoot = new Group();
    this.rocketRoot.position.set(-5, ROCKET_BASE_Y, 0);
    this.rocketRoot.scale.setScalar(1.5);
    this.foreground.add(this.rocketRoot);

    this.astronautRoot = new Group();
    this.astronautRoot.position.set(-3, ASTRONAUT_BASE_Y, 1);
    this.astronautRoot.scale.setScalar(0.5);
    this.astronautRoot.rotation.set(0, 0.1, 0);
    this.foreground.add(this.astronautRoot);

    this.loadRocket();
    this.loadAstronaut();

    this.handleResize();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  private async loadRocket(): Promise<void> {
    try {
      const model = await assets.loadGLB(
        `${import.meta.env.BASE_URL}RocketFLY.glb`,
      );
      this.rocketRoot.add(model);
      if (DEBUG.PLAYER_GLOW) {
        model.traverse((obj) => {
          if (
            obj instanceof Mesh &&
            obj.material instanceof MeshStandardMaterial
          ) {
            const cloned = obj.material.clone();
            cloned.emissive = new Color(0x6080ff);
            cloned.emissiveIntensity = 0.75;
            obj.material = cloned;
          }
        });
      }
    } catch (err) {
      console.error("TitleSceneView: failed to load RocketFLY.glb", err);
    }
  }

  private async loadAstronaut(): Promise<void> {
    try {
      const model = await assets.loadGLB(
        `${import.meta.env.BASE_URL}AstronautMkI.glb`,
      );
      this.astronautRoot.add(model);
    } catch (err) {
      console.error("TitleSceneView: failed to load AstronautMkI.glb", err);
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.space.update(dt);
    this.rocketRoot.position.y =
      ROCKET_BASE_Y + Math.sin(this.elapsed * 0.4) * 0.08;
    this.astronautRoot.position.y =
      ASTRONAUT_BASE_Y + Math.sin(this.elapsed * 0.5 + 1) * 0.05;
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.space.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof MeshStandardMaterial)
          obj.material.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
  }
}
