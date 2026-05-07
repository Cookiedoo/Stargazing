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
import { VIEW } from "@stargazing/shared";

export class Renderer {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly gl: WebGLRenderer;

  private container: HTMLElement;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, platform: PlatformInfo) {
    this.container = container;

    this.scene = new Scene();
    this.scene.background = new Color(VIEW.RENDERER.BACKGROUND_COLOR);
    this.scene.fog = new FogExp2(
      VIEW.RENDERER.BACKGROUND_COLOR,
      VIEW.RENDERER.FOG_DENSITY,
    );

    this.camera = new PerspectiveCamera(
      VIEW.RENDERER.CAMERA_FOV,
      1,
      VIEW.RENDERER.CAMERA_NEAR,
      VIEW.RENDERER.CAMERA_FAR,
    );
    this.camera.position.set(...VIEW.RENDERER.CAMERA_POSITION);
    this.camera.lookAt(...VIEW.RENDERER.CAMERA_LOOK_AT);

    this.gl = new WebGLRenderer({
      antialias: platform.gpuTier !== "low",
      powerPreference: "high-performance",
    });
    this.gl.setPixelRatio(platform.pixelRatio);
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = VIEW.RENDERER.TONE_MAPPING_EXPOSURE;

    container.appendChild(this.gl.domElement);
    Object.assign(this.gl.domElement.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });

    const ambient = new AmbientLight(
      VIEW.RENDERER.AMBIENT_COLOR,
      VIEW.RENDERER.AMBIENT_INTENSITY,
    );
    this.scene.add(ambient);

    const keyLight = new DirectionalLight(
      VIEW.RENDERER.KEY_LIGHT_COLOR,
      VIEW.RENDERER.KEY_LIGHT_INTENSITY,
    );
    keyLight.position.set(...VIEW.RENDERER.KEY_LIGHT_POSITION);
    this.scene.add(keyLight);

    const rimLight = new DirectionalLight(
      VIEW.RENDERER.RIM_LIGHT_COLOR,
      VIEW.RENDERER.RIM_LIGHT_INTENSITY,
    );
    rimLight.position.set(...VIEW.RENDERER.RIM_LIGHT_POSITION);
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
