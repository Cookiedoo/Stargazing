import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Color,
  Scene,
  Vector3,
  Quaternion,
  Euler,
  Sphere,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
  CanvasTexture,
  NearestFilter,
  AdditiveBlending,
} from "three";
import { assets } from "../engine/assetLoader.js";
import { SHIP, VIEW } from "@stargazing/shared";
import { DEBUG } from "@stargazing/shared";

interface Particle {
  position: Vector3;
  velocity: Vector3;
  life: number;
  maxLife: number;
}

export class ShipView {
  private scene: Scene;
  private color: number;

  private currentVx: number = 0;
  private currentVy: number = 0;
  private currentVz: number = 0;

  private root: Group;
  private orientGroup: Group;
  private model: Group | null = null;

  private exhaust: Points | null = null;
  private particles: Particle[] = [];

  private currentThrustLevel: number = 0;

  private _quat: Quaternion = new Quaternion();
  private _euler: Euler = new Euler();

  constructor(scene: Scene, color: number = VIEW.DEFAULT_SHIP_COLOR) {
    this.scene = scene;
    this.color = color;

    this.root = new Group();
    this.orientGroup = new Group();
    this.orientGroup.rotation.x = VIEW.SHIP_VIEW.ORIENT_ROTATION_X;
    this.orientGroup.rotation.y = VIEW.SHIP_VIEW.ORIENT_ROTATION_Y;
    this.root.add(this.orientGroup);
    this.root.scale.setScalar(VIEW.SHIP_VIEW.MODEL_SCALE);
    this.scene.add(this.root);

    this.loadModel();
    this.initExhaust();
  }

  private async loadModel(): Promise<void> {
    try {
      this.model = await assets.loadGLB(
        `${import.meta.env.BASE_URL}RocketFLY.glb`,
      );
      this.tintModel(this.model, this.color);
      this.orientGroup.add(this.model);
    } catch (err) {
      console.error("ShipView: failed to load /RocketFLY.glb", err);
    }
  }

  private tintModel(root: Group, color: number): void {
    const c = new Color(color);
    root.traverse((obj) => {
      if (obj instanceof Mesh && obj.material) {
        const mat = obj.material as MeshStandardMaterial;
        const cloned = mat.clone();
        cloned.color = c.clone();
        if (DEBUG.PLAYER_GLOW) {
          cloned.emissive = c.clone();
          cloned.emissiveIntensity = VIEW.SHIP_VIEW.GLOW_EMISSIVE_INTENSITY;
        } else {
          cloned.emissive = c
            .clone()
            .multiplyScalar(VIEW.SHIP_VIEW.NORMAL_EMISSIVE_SCALE);
          cloned.emissiveIntensity = VIEW.SHIP_VIEW.NORMAL_EMISSIVE_INTENSITY;
        }
        obj.material = cloned;
      }
    });
  }

  private initExhaust(): void {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = VIEW.SHIP_VIEW.EXHAUST_CANVAS_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(
      0,
      0,
      VIEW.SHIP_VIEW.EXHAUST_CANVAS_SIZE,
      VIEW.SHIP_VIEW.EXHAUST_CANVAS_SIZE,
    );
    ctx.fillStyle = "rgba(255,180,80,1)";
    ctx.beginPath();
    for (let i = 0; i < VIEW.SHIP_VIEW.EXHAUST_STAR_POINTS; i++) {
      const angle = (i / VIEW.SHIP_VIEW.EXHAUST_STAR_POINTS) * Math.PI * 2;
      const x =
        VIEW.SHIP_VIEW.EXHAUST_CANVAS_CENTER +
        Math.cos(angle) * VIEW.SHIP_VIEW.EXHAUST_CANVAS_RADIUS;
      const y =
        VIEW.SHIP_VIEW.EXHAUST_CANVAS_CENTER +
        Math.sin(angle) * VIEW.SHIP_VIEW.EXHAUST_CANVAS_RADIUS;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    const tex = new CanvasTexture(canvas);
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;

    const positions = new Float32Array(SHIP.EXHAUST_MAX * 3).fill(
      VIEW.SHIP_VIEW.EXHAUST_HIDDEN_POSITION,
    );
    const colors = new Float32Array(SHIP.EXHAUST_MAX * 3);

    for (let i = 0; i < SHIP.EXHAUST_MAX; i++) {
      const c = new Color(
        VIEW.SHIP_VIEW.EXHAUST_PALETTE[
          Math.floor(Math.random() * VIEW.SHIP_VIEW.EXHAUST_PALETTE.length)
        ],
      );
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      this.particles.push({
        position: new Vector3(
          VIEW.SHIP_VIEW.EXHAUST_HIDDEN_POSITION,
          VIEW.SHIP_VIEW.EXHAUST_HIDDEN_POSITION,
          VIEW.SHIP_VIEW.EXHAUST_HIDDEN_POSITION,
        ),
        velocity: new Vector3(),
        life: 0,
        maxLife: 0,
      });
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("color", new BufferAttribute(colors, 3));

    const mat = new PointsMaterial({
      color: 0xffffff,
      size: VIEW.SHIP_VIEW.EXHAUST_POINT_SIZE,
      sizeAttenuation: true,
      transparent: true,
      opacity: VIEW.SHIP_VIEW.EXHAUST_BASE_OPACITY,
      map: tex,
      alphaTest: VIEW.SHIP_VIEW.EXHAUST_ALPHA_TEST,
      depthWrite: false,
      fog: false,
      vertexColors: true,
      blending: AdditiveBlending,
    });

    this.exhaust = new Points(geo, mat);
    this.exhaust.frustumCulled = false;
    this.exhaust.geometry.boundingSphere = new Sphere(
      new Vector3(),
      VIEW.SHIP_VIEW.EXHAUST_HIDDEN_POSITION,
    );
    this.scene.add(this.exhaust);
  }

  applySnapshot(snap: {
    x: number;
    y: number;
    z: number;
    vx?: number;
    vy?: number;
    vz?: number;
    heading: number;
    pitch: number;
    bank: number;
    thrustLevel: number;
  }): void {
    this.root.position.set(snap.x, snap.y, snap.z);
    this._euler.set(snap.pitch, snap.heading, 0, "YXZ");
    this._quat.setFromEuler(this._euler);
    this.root.quaternion.copy(this._quat);

    if (this.model) this.model.rotation.y = snap.bank;

    this.currentThrustLevel = snap.thrustLevel;
    this.currentVx = snap.vx ?? 0;
    this.currentVy = snap.vy ?? 0;
    this.currentVz = snap.vz ?? 0;
  }

  update(dt: number): void {
    if (!this.exhaust) return;

    if (this.currentThrustLevel > VIEW.SHIP_VIEW.EXHAUST_ACTIVE_THRUST) {
      const back = new Vector3(...VIEW.SHIP_VIEW.EXHAUST_BACK_VECTOR)
        .applyQuaternion(this.root.quaternion);
      const nozzle = this.root.position
        .clone()
        .addScaledVector(
          back,
          VIEW.SHIP_VIEW.EXHAUST_NOZZLE_DISTANCE * VIEW.SHIP_VIEW.MODEL_SCALE,
        );

      const speed = Math.sqrt(
        this.currentVx * this.currentVx +
          this.currentVy * this.currentVy +
          this.currentVz * this.currentVz,
      );
      const speedT = Math.min(1, speed / SHIP.MAX_SPEED_FOR_EXHAUST);
      const activeCount = Math.floor(
        SHIP.EXHAUST_MIN + speedT * (SHIP.EXHAUST_MAX - SHIP.EXHAUST_MIN),
      );

      for (let i = 0; i < activeCount; i++) {
        const p = this.particles[i];
        if (p.life <= 0) {
          p.position.copy(nozzle);
          p.velocity
            .copy(back)
            .multiplyScalar(
              VIEW.SHIP_VIEW.EXHAUST_SPEED_BASE +
                Math.random() * VIEW.SHIP_VIEW.EXHAUST_SPEED_RANDOM,
            );
          p.velocity.x +=
            (Math.random() - 0.5) * VIEW.SHIP_VIEW.EXHAUST_DRIFT_XY;
          p.velocity.y +=
            (Math.random() - 0.5) * VIEW.SHIP_VIEW.EXHAUST_DRIFT_XY;
          p.velocity.z +=
            (Math.random() - 0.5) * VIEW.SHIP_VIEW.EXHAUST_DRIFT_Z;
          p.life =
            VIEW.SHIP_VIEW.EXHAUST_LIFE_BASE +
            Math.random() * VIEW.SHIP_VIEW.EXHAUST_LIFE_RANDOM;
          p.maxLife = p.life;
        }
      }
    }

    const pos = this.exhaust.geometry.attributes.position.array as Float32Array;
    let i = 0;
    for (const p of this.particles) {
      if (p.life > 0) {
        p.life -= dt;
        p.position.addScaledVector(p.velocity, dt);
        pos[i] = p.position.x;
        pos[i + 1] = p.position.y;
        pos[i + 2] = p.position.z;
      } else {
        pos[i] = pos[i + 1] = pos[i + 2] =
          VIEW.SHIP_VIEW.EXHAUST_HIDDEN_POSITION;
      }
      i += 3;
    }
    this.exhaust.geometry.attributes.position.needsUpdate = true;
    (this.exhaust.material as PointsMaterial).opacity = Math.min(
      1,
      this.currentThrustLevel * VIEW.SHIP_VIEW.EXHAUST_OPACITY_MULTIPLIER,
    );
  }

  dispose(): void {
    this.scene.remove(this.root);
    if (this.exhaust) {
      this.scene.remove(this.exhaust);
      this.exhaust.geometry.dispose();
      (this.exhaust.material as PointsMaterial).dispose();
    }
    if (this.model) {
      this.model.traverse((obj) => {
        if (obj instanceof Mesh) {
          obj.geometry?.dispose();
          (obj.material as MeshStandardMaterial)?.dispose();
        }
      });
    }
  }
}
