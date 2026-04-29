import { PerspectiveCamera, Vector3 } from "three";

export interface ChaseTarget {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export class ChaseCamera {
  private camera: PerspectiveCamera;
  private offsetUp: number = 6;
  private offsetBack: number = 22;
  private lookAtUp: number = 8;
  private positionLag: number = 0.08;
  private lookAtLag: number = 0.18;
  private currentLookAt: Vector3 = new Vector3();
  private _desiredPos: Vector3 = new Vector3();
  private _desiredLookAt: Vector3 = new Vector3();

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  setOffset(_sideways: number, up: number, back: number): void {
    this.offsetUp = up;
    this.offsetBack = back;
  }

  setSmoothing(positionLag: number, lookAtLag: number): void {
    this.positionLag = positionLag;
    this.lookAtLag = lookAtLag;
  }

  snapTo(target: ChaseTarget): void {
    const forwardX = Math.sin(target.yaw);
    const forwardZ = Math.cos(target.yaw);

    this.camera.position.set(
      target.x - forwardX * this.offsetBack,
      target.y + this.offsetUp,
      target.z - forwardZ * this.offsetBack,
    );

    this.currentLookAt.set(
      target.x,
      target.y + this.lookAtUp,
      target.z,
    );

    this.camera.lookAt(this.currentLookAt);
  }

  update(dt: number, target: ChaseTarget): void {
    const forwardX = Math.sin(target.yaw);
    const forwardZ = Math.cos(target.yaw);

    this._desiredPos.set(
      target.x - forwardX * this.offsetBack,
      target.y + this.offsetUp,
      target.z - forwardZ * this.offsetBack,
    );

    this._desiredLookAt.set(
      target.x,
      target.y + this.lookAtUp,
      target.z,
    );

    const posFactor = 1 - Math.pow(1 - this.positionLag, dt * 60);
    this.camera.position.lerp(this._desiredPos, posFactor);

    const lookFactor = 1 - Math.pow(1 - this.lookAtLag, dt * 60);
    this.currentLookAt.lerp(this._desiredLookAt, lookFactor);

    this.camera.lookAt(this.currentLookAt);
  }
}