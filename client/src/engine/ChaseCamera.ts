import { Euler, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { VIEW } from "@stargazing/shared";

export interface ChaseTarget {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
}

export class ChaseCamera {
  private camera: PerspectiveCamera;

  private offset: Vector3 = new Vector3(...VIEW.CAMERA.OFFSET);
  private lookAtOffset: Vector3 = new Vector3(...VIEW.CAMERA.LOOK_AT_OFFSET);

  private positionSharpness: number = VIEW.CAMERA.POSITION_SHARPNESS;
  private lookAtSharpness: number = VIEW.CAMERA.LOOK_AT_SHARPNESS;

  private initialized = false;
  private smoothLook: Vector3 = new Vector3();

  private _desiredPos: Vector3 = new Vector3();
  private _desiredLook: Vector3 = new Vector3();
  private _targetPos: Vector3 = new Vector3();
  private _targetQuat: Quaternion = new Quaternion();
  private _targetEuler: Euler = new Euler();

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  setOffset(x: number, y: number, z: number): void {
    this.offset.set(x, y, z);
  }

  setLookAtOffset(x: number, y: number, z: number): void {
    this.lookAtOffset.set(x, y, z);
  }

  setSmoothing(positionSharpness: number, lookAtSharpness: number): void {
    this.positionSharpness = Math.max(VIEW.CAMERA.MIN_SHARPNESS, positionSharpness);
    this.lookAtSharpness = Math.max(VIEW.CAMERA.MIN_SHARPNESS, lookAtSharpness);
  }

  reset(): void {
    this.initialized = false;
  }

  snapTo(target: ChaseTarget): void {
    this.computeDesired(target);
    this.camera.position.copy(this._desiredPos);
    this.smoothLook.copy(this._desiredLook);
    this.camera.lookAt(this.smoothLook);
    this.initialized = true;
  }

  update(dt: number, target: ChaseTarget): void {
    if (!this.initialized) {
      this.snapTo(target);
      return;
    }

    const positionAlpha = dampingAlpha(this.positionSharpness, dt);
    const lookAlpha = dampingAlpha(this.lookAtSharpness, dt);

    this.computeDesired(target);

    this.camera.position.lerp(this._desiredPos, positionAlpha);
    this.smoothLook.lerp(this._desiredLook, lookAlpha);
    this.camera.lookAt(this.smoothLook);
  }

  private computeDesired(target: ChaseTarget): void {
    this._targetEuler.set(target.pitch, target.heading, 0, "YXZ");
    this._targetQuat.setFromEuler(this._targetEuler);
    this._targetPos.set(target.x, target.y, target.z);

    this._desiredPos
      .copy(this.offset)
      .applyQuaternion(this._targetQuat)
      .add(this._targetPos);
    this._desiredLook
      .copy(this.lookAtOffset)
      .applyQuaternion(this._targetQuat)
      .add(this._targetPos);
  }
}

function dampingAlpha(sharpness: number, dt: number): number {
  return 1 - Math.exp(-sharpness * Math.max(0, dt));
}