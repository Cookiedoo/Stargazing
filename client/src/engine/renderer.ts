import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Color,
  FogExp2,
  ACESFilmicToneMapping,
} from "three";
import type { PlatformInfo } from "./platform.js";

export class Renderer {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly gl: WebGLRenderer;

  private container: HTMLElement;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, platform: PlatformInfo) {
    this.container = container;

    this.scene = new Scene();
    this.scene.background = new Color(0x05070d);
    this.scene.fog = new FogExp2(0x05070d, 0.0008);

    this.camera = new PerspectiveCamera(60, 1, 0.1, 8000);
    this.camera.position.set(0, 8, 25);
    this.camera.lookAt(0, 0, 0);

    this.gl = new WebGLRenderer({
      antialias: platform.gpuTier !== "low",
      powerPreference: "high-performance",
    });
    this.gl.setPixelRatio(platform.pixelRatio);
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.0;

    container.appendChild(this.gl.domElement);
    Object.assign(this.gl.domElement.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });

    const ambient = new AmbientLight(0x404860, 0.6);
    this.scene.add(ambient);

    const keyLight = new DirectionalLight(0xfff4e0, 1.2); // warm sun
    keyLight.position.set(5, 10, 7);
    this.scene.add(keyLight);

    const rimLight = new DirectionalLight(0x6080ff, 0.4); // cool rim
    rimLight.position.set(-8, 4, -6);
    this.scene.add(rimLight);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.handleResize();
  }

  private handleResize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.gl.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.gl.dispose();
    this.gl.domElement.remove();
  }
}
