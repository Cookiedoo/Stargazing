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

  private positionSharpness = VIEW.CAMERA.POSITION_SHARPNESS;
  private lookAtSharpness = VIEW.CAMERA.LOOK_AT_SHARPNESS;
  private targetSharpness = VIEW.CAMERA.TARGET_SHARPNESS;

  private initialized = false;

  private smoothTargetPos: Vector3 = new Vector3();
  private smoothLook: Vector3 = new Vector3();
  private smoothHeading = 0;
  private smoothPitch = 0;

  private _desiredPos: Vector3 = new Vector3();
  private _desiredLook: Vector3 = new Vector3();
  private _targetQuat: Quaternion = new Quaternion();
  private _targetEuler: Euler = new Euler();
  private _targetPos: Vector3 = new Vector3();

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

  setTargetSmoothing(targetSharpness: number): void {
    this.targetSharpness = Math.max(VIEW.CAMERA.MIN_SHARPNESS, targetSharpness);
  }

  reset(): void {
    this.initialized = false;
  }

  snapTo(target: ChaseTarget): void {
    this.smoothTargetPos.set(target.x, target.y, target.z);
    this.smoothHeading = target.heading;
    this.smoothPitch = target.pitch;

    this.computeTargetQuat(this.smoothHeading, this.smoothPitch);
    this._desiredPos
      .copy(this.offset)
      .applyQuaternion(this._targetQuat)
      .add(this.smoothTargetPos);
    this._desiredLook
      .copy(this.lookAtOffset)
      .applyQuaternion(this._targetQuat)
      .add(this.smoothTargetPos);

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

    const targetAlpha = dampingAlpha(this.targetSharpness, dt);
    const positionAlpha = dampingAlpha(this.positionSharpness, dt);
    const lookAlpha = dampingAlpha(this.lookAtSharpness, dt);

    this._targetPos.set(target.x, target.y, target.z);
    this.smoothTargetPos.lerp(this._targetPos, targetAlpha);
    this.smoothHeading += angleDelta(this.smoothHeading, target.heading) * targetAlpha;
    this.smoothPitch += angleDelta(this.smoothPitch, target.pitch) * targetAlpha;

    this.computeTargetQuat(this.smoothHeading, this.smoothPitch);
    this._desiredPos
      .copy(this.offset)
      .applyQuaternion(this._targetQuat)
      .add(this.smoothTargetPos);
    this._desiredLook
      .copy(this.lookAtOffset)
      .applyQuaternion(this._targetQuat)
      .add(this.smoothTargetPos);

    this.camera.position.lerp(this._desiredPos, positionAlpha);
    this.smoothLook.lerp(this._desiredLook, lookAlpha);
    this.camera.lookAt(this.smoothLook);
  }

  private computeTargetQuat(heading: number, pitch: number): void {
    this._targetEuler.set(pitch, heading, 0, "YXZ");
    this._targetQuat.setFromEuler(this._targetEuler);
  }
}

function dampingAlpha(sharpness: number, dt: number): number {
  return 1 - Math.exp(-sharpness * Math.max(0, dt));
}

function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
