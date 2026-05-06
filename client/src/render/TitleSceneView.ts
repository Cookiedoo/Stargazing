import {
  AmbientLight,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  Color,
  BoxGeometry,
} from "three";
import { assets } from "../engine/assetLoader.js";
import { DEBUG } from "@stargazing/shared";

const ROTATION_SPEED = 0.3;

export class TitleSceneView {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private container: HTMLElement;

  private displayBase: Group;
  private rocketRoot: Group;
  private placeholderRoot: Group;
  private rotationY: number = 0;

  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0e1f, 1);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.scene = new Scene();
    this.scene.background = new Color(0x0a0e1f);

    this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 4, 9);
    this.camera.lookAt(0, 1.2, 0);

    const ambient = new AmbientLight(0xb0c4ff, 0.5);
    this.scene.add(ambient);

    const key = new DirectionalLight(0xffffff, 1.2);
    key.position.set(4, 8, 6);
    this.scene.add(key);

    const rim = new DirectionalLight(0x6080ff, 0.6);
    rim.position.set(-5, 2, -4);
    this.scene.add(rim);

    this.displayBase = new Group();
    this.scene.add(this.displayBase);

    const pedestalGeo = new CylinderGeometry(2.4, 2.6, 0.8, 32);
    const pedestalMat = new MeshStandardMaterial({
      color: 0x2a3050,
      metalness: 0.3,
      roughness: 0.5,
      emissive: 0x4060a0,
      emissiveIntensity: 0.15,
    });
    const pedestal = new Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.4;
    this.displayBase.add(pedestal);

    this.rocketRoot = new Group();
    this.rocketRoot.position.set(-1.0, 0.8, 0);
    this.rocketRoot.scale.setScalar(0.45);
    this.displayBase.add(this.rocketRoot);

    this.placeholderRoot = new Group();
    this.placeholderRoot.position.set(1.0, 0.8, 0);
    this.displayBase.add(this.placeholderRoot);

    this.loadRocket();
    this.buildAstronautPlaceholder();

    this.handleResize();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  private async loadRocket(): Promise<void> {
    try {
      const model = await assets.loadGLB(`${import.meta.env.BASE_URL}RocketFLY.glb`);
      const orient = new Group();
      orient.rotation.x = -Math.PI / 2;
      orient.rotation.y = Math.PI;
      orient.add(model);
      this.rocketRoot.add(orient);

      if (DEBUG.PLAYER_GLOW) {
        model.traverse((obj) => {
          if (obj instanceof Mesh && obj.material instanceof MeshStandardMaterial) {
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

  // PLACEHOLDER for Astronaut.glb. Replace with assets.loadGLB('Astronaut.glb') when model is exported into client/public/.
  private buildAstronautPlaceholder(): void {
    const bodyGeo = new BoxGeometry(0.7, 1.2, 0.6);
    const bodyMat = new MeshStandardMaterial({
      color: 0xc4d0e8,
      metalness: 0.2,
      roughness: 0.6,
      emissive: 0x2a3050,
      emissiveIntensity: 0.3,
    });
    const body = new Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    this.placeholderRoot.add(body);

    const visorGeo = new BoxGeometry(0.55, 0.4, 0.05);
    const visorMat = new MeshStandardMaterial({
      color: 0x1a1010,
      emissive: 0x6040a0,
      emissiveIntensity: 0.4,
    });
    const visor = new Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.95, 0.3);
    this.placeholderRoot.add(visor);
  }

  update(dt: number): void {
    this.rotationY += dt * ROTATION_SPEED;
    this.displayBase.rotation.y = this.rotationY;
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
    this.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof MeshStandardMaterial) obj.material.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}