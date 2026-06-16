import * as THREE from 'three';
import { hotkeyManager, GameAction } from './HotkeyManager';
import { isMobileDevice, getRealDeviceType } from '@utils/device';
import { useGameStore } from '@store/useGameStore';
import { ItemRegistry } from '@game/item/ItemRegistry';
import { GameState } from '@type';

export interface IGameInstance {
  animals?: {
    getAnimalMeshes(): THREE.Object3D[];
  };
  camera: THREE.Camera;
}

export class Controls {
  public domElement: HTMLElement;
  private camera: THREE.Camera;
  private game?: IGameInstance;

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
    return isMobileDevice();
  }

  public get canControlView(): boolean {
    const store = useGameStore.getState();
    const isPlaying = store.gameState === GameState.PLAYING;
    const isUIOpen = store.isInventoryOpen || store.isSettingsOpen || store.activeChest !== null || store.isWorldLoading;

    if (!isPlaying || isUIOpen) {
      return false;
    }

    const isActuallyLocked = document.pointerLockElement === this.domElement || document.pointerLockElement === document.body;
    if (this.isMobile) {
      return true;
    }
    return isActuallyLocked;
  }

  public mouseSensitivity = 0.0022;
  public pitch = 0; // vertical rotation
  public yaw = 0;   // horizontal rotation

  public isLocked = false;

  private onLockChangeCallbacks: ((locked: boolean) => void)[] = [];
  private unsubscribers: (() => void)[] = [];

  // Mobile Mouse Drag States
  private isMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

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
  private longPressButtonTriggered: number | null = null;

  constructor(camera: THREE.Camera, domElement: HTMLElement, game?: IGameInstance) {
    this.camera = camera;
    this.domElement = domElement;
    this.game = game;

    this.initListeners();
    this.initHotkeys();

    // If the pointer lock was already initiated (e.g. on document.body during the menu click gesture),
    // transfer the pointer lock to this canvas element programmatically.
    if (document.pointerLockElement && document.pointerLockElement !== this.domElement) {
      try {
        this.domElement.requestPointerLock();
      } catch (err) {
        console.warn('Failed to transfer pointer lock to canvas:', err);
      }
    }
  }

  private initListeners() {
    this.domElement.addEventListener('click', this.requestLock);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);

    this.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.domElement.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
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
    this.domElement.removeEventListener('click', this.requestLock);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);

    this.domElement.removeEventListener('touchstart', this.onTouchStart);
    this.domElement.removeEventListener('touchmove', this.onTouchMove);
    this.domElement.removeEventListener('touchend', this.onTouchEnd);
    this.domElement.removeEventListener('touchcancel', this.onTouchEnd);
    if (this.miningTimeout) {
      window.clearTimeout(this.miningTimeout);
    }
    
    // Unsubscribe hotkey listeners
    this.unsubscribers.forEach((unsub) => unsub());
  }

  public onF3Pressed?: () => void;
  public onF4Pressed?: () => void;

  public requestLock = () => {
    if (getRealDeviceType() === 'mobile') return;
    if (!this.isLocked) {
      this.domElement.requestPointerLock();
    }
  };

  private onPointerLockChange = () => {
    this.isLocked = document.pointerLockElement === this.domElement || document.pointerLockElement === document.body;
    this.onLockChangeCallbacks.forEach((cb) => cb(this.isLocked));
  };

  private updateCameraRotation() {
    // Clamp pitch (look up/down) to avoid flipping camera upsidedown
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Create a Euler rotation and apply to camera
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
  }

  private onMouseDown = (e: MouseEvent) => {
    if (!this.canControlView) return;
    if (this.isMobile && !this.isLocked) {
      this.isMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private onMouseUp = () => {
    this.isMouseDown = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    const isActuallyLocked = document.pointerLockElement === this.domElement || document.pointerLockElement === document.body;
    if (isActuallyLocked !== this.isLocked) {
      this.isLocked = isActuallyLocked;
    }

    if (!this.canControlView) {
      this.isMouseDown = false;
      return;
    }

    if (this.isLocked) {
      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      // 过滤进入或退出指针锁定瞬间由浏览器产生的异常巨大偏移量（例如数百至数千像素的坐标跃变）
      if (Math.abs(movementX) > 300 || Math.abs(movementY) > 300) {
        return;
      }

      this.yaw -= movementX * this.mouseSensitivity;
      this.pitch -= movementY * this.mouseSensitivity;

      this.updateCameraRotation();
    } else if (this.isMobile && this.isMouseDown) {
      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;

      if (Math.abs(deltaX) > 300 || Math.abs(deltaY) > 300) {
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        return;
      }

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      this.yaw -= deltaX * this.touchSensitivity;
      this.pitch -= deltaY * this.touchSensitivity;

      this.updateCameraRotation();
    }
  };

  // Mobile Touch Callbacks
  private onTouchStart = (e: TouchEvent) => {
    if (!this.canControlView) return;
    if (this.activeTouchId !== null) return;

    const touch = e.changedTouches[0];
    this.activeTouchId = touch.identifier;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
    this.startTouchX = touch.clientX;
    this.startTouchY = touch.clientY;
    this.isMoved = false;
    this.touchStartTime = performance.now();
    this.longPressButtonTriggered = null;

    // Start a 200ms timer. If no big movement occurs, trigger digging or eating action
    this.miningTimeout = window.setTimeout(() => {
      if (!this.isMoved && this.activeTouchId === touch.identifier) {
        const store = useGameStore.getState();
        const heldItem = store.hotbar[store.activeSlot];
        const item = heldItem ? ItemRegistry.get(heldItem.type) : null;
        const isFood = item && item.category === 'food';
        
        const button = isFood ? 2 : 0;
        this.longPressButtonTriggered = button;
        this.triggerMouseEvent('mousedown', button);
      }
    }, 200);
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.canControlView) {
      this.activeTouchId = null;
      if (this.miningTimeout) {
        window.clearTimeout(this.miningTimeout);
        this.miningTimeout = null;
      }
      return;
    }
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
    if (dist > 25) {
      this.isMoved = true;
    }

    this.yaw -= deltaX * this.touchSensitivity;
    this.pitch -= deltaY * this.touchSensitivity;

    this.updateCameraRotation();
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
            // Tap: Attack/Break if looking at an animal or in creative mode, otherwise place/use
            const game = this.game || (window as unknown as { gameInstance?: IGameInstance }).gameInstance;
            let button = 2; // Default: Right Click (Place/Use)
            if (game) {
              const isCreative = useGameStore.getState().gameMode === 'creative';
              
              // If looking at an animal or in creative mode, tap triggers attack/break (Left Click)
              const hasAnimalTarget = game.animals && game.animals.getAnimalMeshes().length > 0 && (() => {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(0, 0), game.camera);
                const intersects = raycaster.intersectObjects(game.animals.getAnimalMeshes(), true);
                return intersects.length > 0 && intersects[0].distance < 5.2;
              })();
              
              if (hasAnimalTarget || isCreative) {
                button = 0; // Left Click (Attack/Break)
              }
            }

            this.triggerMouseEvent('mousedown', button);
            setTimeout(() => {
              this.triggerMouseEvent('mouseup', button);
            }, 50);
          } else {
            // Long Press End: Release whatever button was triggered
            if (this.longPressButtonTriggered !== null) {
              this.triggerMouseEvent('mouseup', this.longPressButtonTriggered);
              this.longPressButtonTriggered = null;
            } else {
              this.triggerMouseEvent('mouseup', 0);
            }
          }
        } else {
          // If swipe ends, clear status just in case
          if (this.longPressButtonTriggered !== null) {
            this.triggerMouseEvent('mouseup', this.longPressButtonTriggered);
            this.longPressButtonTriggered = null;
          } else {
            this.triggerMouseEvent('mouseup', 0);
          }
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
