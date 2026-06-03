import * as THREE from 'three';
import { hotkeyManager, GameAction } from './HotkeyManager';

export class Controls {
  public domElement: HTMLElement;
  private camera: THREE.Camera;

  // Keep keys property for backwards compatibility, using getters
  public get keys() {
    return {
      KeyW: hotkeyManager.isActionPressed(GameAction.MOVE_FORWARD),
      KeyS: hotkeyManager.isActionPressed(GameAction.MOVE_BACKWARD),
      KeyA: hotkeyManager.isActionPressed(GameAction.MOVE_LEFT),
      KeyD: hotkeyManager.isActionPressed(GameAction.MOVE_RIGHT),
      Space: hotkeyManager.isActionPressed(GameAction.JUMP),
      ShiftLeft: hotkeyManager.isActionPressed(GameAction.SNEAK),
    };
  }

  public mouseSensitivity = 0.0022;
  public pitch = 0; // vertical rotation
  public yaw = 0;   // horizontal rotation

  public isLocked = false;

  private onLockChangeCallbacks: ((locked: boolean) => void)[] = [];
  private unsubscribers: (() => void)[] = [];

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.initListeners();
    this.initHotkeys();
  }

  private initListeners() {
    this.domElement.addEventListener('click', this.requestLock);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  private initHotkeys() {
    this.unsubscribers.push(
      hotkeyManager.onActionDown(GameAction.TOGGLE_DEBUG, () => {
        if (this.isLocked && this.onF3Pressed) this.onF3Pressed();
      }),
      hotkeyManager.onActionDown(GameAction.TOGGLE_FLY, () => {
        if (this.isLocked && this.onF4Pressed) this.onF4Pressed();
      })
    );
  }

  public dispose() {
    this.domElement.removeEventListener('click', this.requestLock);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    
    // Unsubscribe hotkey listeners
    this.unsubscribers.forEach((unsub) => unsub());
  }

  public onF3Pressed?: () => void;
  public onF4Pressed?: () => void;

  public requestLock = () => {
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

  public isActionPressed(action: GameAction): boolean {
    return hotkeyManager.isActionPressed(action);
  }

  public getMovementDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();

    if (!this.isLocked) return direction;

    const zMove = (hotkeyManager.isActionPressed(GameAction.MOVE_FORWARD) ? -1 : 0) + 
                  (hotkeyManager.isActionPressed(GameAction.MOVE_BACKWARD) ? 1 : 0);
    const xMove = (hotkeyManager.isActionPressed(GameAction.MOVE_LEFT) ? -1 : 0) + 
                  (hotkeyManager.isActionPressed(GameAction.MOVE_RIGHT) ? 1 : 0);

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
