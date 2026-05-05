import { PerspectiveCamera, Vector3, Quaternion, Euler } from 'three';

export interface ChaseTarget {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
}

export class ChaseCamera {
  private camera: PerspectiveCamera;

  private offset: Vector3 = new Vector3(0, 20, 50);
  private lookAtOffset: Vector3 = new Vector3(0, 8, 0);

  private positionLag: number = 0.08;
  private lookAtLag: number = 0.18;

  private smoothLook: Vector3 = new Vector3();
  private initialized: boolean = false;

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

  setSmoothing(positionLag: number, lookAtLag: number): void {
    this.positionLag = positionLag;
    this.lookAtLag = lookAtLag;
  }

  reset(): void {
    this.initialized = false;
  }

  snapTo(target: ChaseTarget): void {
    this.computeTargetQuat(target);
    this._targetPos.set(target.x, target.y, target.z);

    this._desiredPos.copy(this.offset).applyQuaternion(this._targetQuat).add(this._targetPos);
    this._desiredLook.copy(this.lookAtOffset).applyQuaternion(this._targetQuat).add(this._targetPos);

    this.camera.position.copy(this._desiredPos);
    this.smoothLook.copy(this._desiredLook);
    this.camera.lookAt(this.smoothLook);
    this.initialized = true;
  }

  update(_dt: number, target: ChaseTarget): void {
    this.computeTargetQuat(target);
    this._targetPos.set(target.x, target.y, target.z);

    this._desiredPos.copy(this.offset).applyQuaternion(this._targetQuat).add(this._targetPos);
    this._desiredLook.copy(this.lookAtOffset).applyQuaternion(this._targetQuat).add(this._targetPos);

    if (!this.initialized) {
      this.camera.position.copy(this._desiredPos);
      this.smoothLook.copy(this._desiredLook);
      this.initialized = true;
    } else {
      this.camera.position.lerp(this._desiredPos, this.positionLag);
      this.smoothLook.lerp(this._desiredLook, this.lookAtLag);
    }

    this.camera.lookAt(this.smoothLook);
  }

  private computeTargetQuat(target: ChaseTarget): void {
    this._targetEuler.set(target.pitch, target.heading, 0, 'YXZ');
    this._targetQuat.setFromEuler(this._targetEuler);
  }
}