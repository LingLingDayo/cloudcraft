import * as THREE from 'three';

export class Controls {
  public domElement: HTMLElement;
  private camera: THREE.Camera;

  public keys: Record<string, boolean> = {
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    Space: false,
    ShiftLeft: false,
  };

  public mouseSensitivity = 0.0022;
  public pitch = 0; // vertical rotation
  public yaw = 0;   // horizontal rotation

  public isLocked = false;

  private onLockChangeCallbacks: ((locked: boolean) => void)[] = [];

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.initListeners();
  }

  private initListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.domElement.addEventListener('click', this.requestLock);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  public dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('click', this.requestLock);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.isLocked) return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.KeyW = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.KeyS = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.KeyA = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.KeyD = true;
    if (e.code === 'Space') this.keys.Space = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.ShiftLeft = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.KeyW = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.KeyS = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.KeyA = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.KeyD = false;
    if (e.code === 'Space') this.keys.Space = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.ShiftLeft = false;
  };

  private requestLock = () => {
    if (!this.isLocked) {
      this.domElement.requestPointerLock();
    }
  };

  private onPointerLockChange = () => {
    this.isLocked = document.pointerLockElement === this.domElement;
    this.onLockChangeCallbacks.forEach((cb) => cb(this.isLocked));
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isLocked) return;

    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;

    this.yaw -= movementX * this.mouseSensitivity;
    this.pitch -= movementY * this.mouseSensitivity;

    // Clamp pitch (look up/down) to avoid flipping camera upsidedown
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Create a Euler rotation and apply to camera
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
  };

  public addLockChangeListener(cb: (locked: boolean) => void) {
    this.onLockChangeCallbacks.push(cb);
  }

  public getMovementDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();

    if (!this.isLocked) return direction;

    const zMove = (this.keys.KeyW ? -1 : 0) + (this.keys.KeyS ? 1 : 0);
    const xMove = (this.keys.KeyA ? -1 : 0) + (this.keys.KeyD ? 1 : 0);

    if (xMove === 0 && zMove === 0) return direction;

    // Forward and Right vectors projected onto horizontal XZ plane
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    direction.addScaledVector(forward, -zMove);
    direction.addScaledVector(right, xMove);
    direction.normalize();

    return direction;
  }
}
