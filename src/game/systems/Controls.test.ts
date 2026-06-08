import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { Controls } from './Controls';
import { useGameStore } from '@store/useGameStore';
import { GameState } from '@type';

describe('Controls view control and security filters', () => {
  let camera: THREE.PerspectiveCamera;
  let domElement: HTMLDivElement;
  let controls: Controls;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    domElement = document.createElement('div');
    document.body.appendChild(domElement);

    // Default game state store values
    useGameStore.setState({
      gameState: GameState.PLAYING,
      isInventoryOpen: false,
      isSettingsOpen: false,
      activeChest: null,
    });

    controls = new Controls(camera, domElement);
  });

  afterEach(() => {
    controls.dispose();
    document.body.removeChild(domElement);
  });

  test('canControlView should return false by default in PC mode when not pointer locked', () => {
    expect(controls.isMobile).toBe(false);
    expect(controls.canControlView).toBe(false);
  });

  test('canControlView should return true when actually pointer locked and game is playing without menus', () => {
    // Mock document.pointerLockElement
    Object.defineProperty(document, 'pointerLockElement', {
      value: domElement,
      configurable: true,
    });

    expect(controls.canControlView).toBe(true);

    // Restore pointerLockElement mock
    Object.defineProperty(document, 'pointerLockElement', {
      value: null,
      configurable: true,
    });
  });

  test('canControlView should return false when UI elements like settings are open, even if pointerLockElement is set', () => {
    Object.defineProperty(document, 'pointerLockElement', {
      value: domElement,
      configurable: true,
    });

    useGameStore.setState({ isSettingsOpen: true });
    expect(controls.canControlView).toBe(false);

    useGameStore.setState({ isSettingsOpen: false, isInventoryOpen: true });
    expect(controls.canControlView).toBe(false);

    useGameStore.setState({ isInventoryOpen: false, activeChest: { x: 0, y: 0, z: 0 } });
    expect(controls.canControlView).toBe(false);

    // Restore
    Object.defineProperty(document, 'pointerLockElement', {
      value: null,
      configurable: true,
    });
  });

  test('onMouseMove should change camera rotation under normal movementX/Y when locked', () => {
    Object.defineProperty(document, 'pointerLockElement', {
      value: domElement,
      configurable: true,
    });

    // Trigger pointerlockchange to sync isLocked state
    const lockEvent = new Event('pointerlockchange');
    document.dispatchEvent(lockEvent);

    expect(controls.isLocked).toBe(true);

    const initialYaw = controls.yaw;
    const initialPitch = controls.pitch;

    // Simulate normal mousemove
    const moveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(moveEvent, 'movementX', { value: 10 });
    Object.defineProperty(moveEvent, 'movementY', { value: 5 });

    document.dispatchEvent(moveEvent);

    expect(controls.yaw).toBeLessThan(initialYaw); // yaw -= movementX * sensitivity
    expect(controls.pitch).toBeLessThan(initialPitch); // pitch -= movementY * sensitivity

    // Restore
    Object.defineProperty(document, 'pointerLockElement', {
      value: null,
      configurable: true,
    });
  });

  test('onMouseMove should ignore huge movementX/Y (transition spikes) even when locked', () => {
    Object.defineProperty(document, 'pointerLockElement', {
      value: domElement,
      configurable: true,
    });

    const lockEvent = new Event('pointerlockchange');
    document.dispatchEvent(lockEvent);
    expect(controls.isLocked).toBe(true);

    const initialYaw = controls.yaw;
    const initialPitch = controls.pitch;

    // Simulate huge jump (e.g. 400px movement)
    const moveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(moveEvent, 'movementX', { value: 400 });
    Object.defineProperty(moveEvent, 'movementY', { value: 400 });

    document.dispatchEvent(moveEvent);

    // Values should remain unchanged
    expect(controls.yaw).toBe(initialYaw);
    expect(controls.pitch).toBe(initialPitch);

    // Restore
    Object.defineProperty(document, 'pointerLockElement', {
      value: null,
      configurable: true,
    });
  });
});
