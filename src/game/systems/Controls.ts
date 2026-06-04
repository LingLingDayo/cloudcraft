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

  public get isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0);
  }

  public mouseSensitivity = 0.0022;
  public pitch = 0; // vertical rotation
  public yaw = 0;   // horizontal rotation

  public isLocked = false;

  private onLockChangeCallbacks: ((locked: boolean) => void)[] = [];
  private unsubscribers: (() => void)[] = [];

  // Mobile Touch States
  private activeTouchId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private startTouchX = 0;
  private startTouchY = 0;
  private isMoved = false;
  private touchStartTime = 0;
  private touchSensitivity = 0.005;
  private miningTimeout: number | null = null;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.initListeners();
    this.initHotkeys();
  }

  private initListeners() {
    if (!this.isMobile) {
      this.domElement.addEventListener('click', this.requestLock);
      document.addEventListener('pointerlockchange', this.onPointerLockChange);
      document.addEventListener('mousemove', this.onMouseMove);
    } else {
      this.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
      this.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
      this.domElement.addEventListener('touchend', this.onTouchEnd, { passive: false });
    }
  }

  private initHotkeys() {
    this.unsubscribers.push(
      hotkeyManager.onActionDown(GameAction.TOGGLE_DEBUG, () => {
        if ((this.isLocked || this.isMobile) && this.onF3Pressed) this.onF3Pressed();
      }),
      hotkeyManager.onActionDown(GameAction.TOGGLE_FLY, () => {
        if ((this.isLocked || this.isMobile) && this.onF4Pressed) this.onF4Pressed();
      })
    );
  }

  public dispose() {
    if (!this.isMobile) {
      this.domElement.removeEventListener('click', this.requestLock);
      document.removeEventListener('pointerlockchange', this.onPointerLockChange);
      document.removeEventListener('mousemove', this.onMouseMove);
    } else {
      this.domElement.removeEventListener('touchstart', this.onTouchStart);
      this.domElement.removeEventListener('touchmove', this.onTouchMove);
      this.domElement.removeEventListener('touchend', this.onTouchEnd);
      if (this.miningTimeout) {
        window.clearTimeout(this.miningTimeout);
      }
    }
    
    // Unsubscribe hotkey listeners
    this.unsubscribers.forEach((unsub) => unsub());
  }

  public onF3Pressed?: () => void;
  public onF4Pressed?: () => void;

  public requestLock = () => {
    if (this.isMobile) return;
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

  // Mobile Touch Callbacks
  private onTouchStart = (e: TouchEvent) => {
    if (this.activeTouchId !== null) return;

    const touch = e.changedTouches[0];
    this.activeTouchId = touch.identifier;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
    this.startTouchX = touch.clientX;
    this.startTouchY = touch.clientY;
    this.isMoved = false;
    this.touchStartTime = performance.now();

    // Start a 200ms timer. If no big movement occurs, trigger digging action (mousedown button 0)
    this.miningTimeout = window.setTimeout(() => {
      if (!this.isMoved && this.activeTouchId === touch.identifier) {
        this.triggerMouseEvent('mousedown', 0);
      }
    }, 200);
  };

  private onTouchMove = (e: TouchEvent) => {
    if (this.activeTouchId === null) return;

    let activeTouch: Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === this.activeTouchId) {
        activeTouch = e.touches[i];
        break;
      }
    }

    if (!activeTouch) return;

    const deltaX = activeTouch.clientX - this.lastTouchX;
    const deltaY = activeTouch.clientY - this.lastTouchY;

    this.lastTouchX = activeTouch.clientX;
    this.lastTouchY = activeTouch.clientY;

    const dist = Math.hypot(activeTouch.clientX - this.startTouchX, activeTouch.clientY - this.startTouchY);
    if (dist > 15) {
      this.isMoved = true;
      if (this.miningTimeout) {
        window.clearTimeout(this.miningTimeout);
        this.miningTimeout = null;
      }
    }

    this.yaw -= deltaX * this.touchSensitivity;
    this.pitch -= deltaY * this.touchSensitivity;

    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (this.activeTouchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.activeTouchId) {
        if (this.miningTimeout) {
          window.clearTimeout(this.miningTimeout);
          this.miningTimeout = null;
        }

        const duration = performance.now() - this.touchStartTime;

        if (!this.isMoved) {
          if (duration < 200) {
            // Tap: Place block or interact (Right Click)
            this.triggerMouseEvent('mousedown', 2);
            setTimeout(() => {
              this.triggerMouseEvent('mouseup', 2);
            }, 50);
          } else {
            // Long Press End: End mining (Left Release)
            this.triggerMouseEvent('mouseup', 0);
          }
        } else {
          // If swipe ends, clear mining status just in case
          this.triggerMouseEvent('mouseup', 0);
        }

        this.activeTouchId = null;
        break;
      }
    }
  };

  private triggerMouseEvent(type: 'mousedown' | 'mouseup', button: number) {
    const event = new MouseEvent(type, {
      button: button,
      bubbles: true,
      cancelable: true
    });
    this.domElement.dispatchEvent(event);
  }

  public addLockChangeListener(cb: (locked: boolean) => void) {
    this.onLockChangeCallbacks.push(cb);
  }

  public isActionPressed(action: GameAction): boolean {
    return hotkeyManager.isActionPressed(action);
  }

  public getMovementDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();

    if (!this.isLocked && !this.isMobile) return direction;

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
