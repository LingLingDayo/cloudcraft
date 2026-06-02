import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameAction, HotkeyManager } from './HotkeyManager';

describe('HotkeyManager', () => {
  let manager: HotkeyManager;

  beforeEach(() => {
    // New instance for each test
    manager = new HotkeyManager();
    // Clear localStorage to prevent test leakage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    manager.dispose();
  });

  test('should initialize with default keybindings', () => {
    const bindings = manager.getBindings();
    expect(bindings[GameAction.MOVE_FORWARD]).toContain('KeyW');
    expect(bindings[GameAction.JUMP]).toContain('Space');
  });

  test('should detect keydown and keyup actions', () => {
    expect(manager.isActionPressed(GameAction.MOVE_FORWARD)).toBe(false);

    // Simulate keydown
    const eventDown = new KeyboardEvent('keydown', { code: 'KeyW' });
    window.dispatchEvent(eventDown);
    expect(manager.isActionPressed(GameAction.MOVE_FORWARD)).toBe(true);

    // Simulate keyup
    const eventUp = new KeyboardEvent('keyup', { code: 'KeyW' });
    window.dispatchEvent(eventUp);
    expect(manager.isActionPressed(GameAction.MOVE_FORWARD)).toBe(false);
  });

  test('should trigger action listeners', () => {
    const callbackDown = vi.fn();
    const callbackUp = vi.fn();

    const unsubscribeDown = manager.onActionDown(GameAction.JUMP, callbackDown);
    const unsubscribeUp = manager.onActionUp(GameAction.JUMP, callbackUp);

    // Trigger KeyDown
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(callbackDown).toHaveBeenCalledTimes(1);
    expect(callbackUp).not.toHaveBeenCalled();

    // Trigger KeyUp
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(callbackUp).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsubscribeDown();
    unsubscribeUp();

    // Trigger again, should not call callbacks
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(callbackDown).toHaveBeenCalledTimes(1);
    expect(callbackUp).toHaveBeenCalledTimes(1);
  });

  test('should support multiple actions on same key', () => {
    manager.remapAction(GameAction.MOVE_FORWARD, ['KeyW']);
    manager.remapAction(GameAction.JUMP, ['KeyW']); // Both bound to KeyW

    const forwardDown = vi.fn();
    const jumpDown = vi.fn();

    manager.onActionDown(GameAction.MOVE_FORWARD, forwardDown);
    manager.onActionDown(GameAction.JUMP, jumpDown);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(forwardDown).toHaveBeenCalledTimes(1);
    expect(jumpDown).toHaveBeenCalledTimes(1);
  });

  test('should remap key bindings and save to storage', () => {
    manager.remapAction(GameAction.JUMP, ['KeyX']);
    
    // Check custom binding
    expect(manager.getBindings()[GameAction.JUMP]).toEqual(['KeyX']);

    // Check if it registers
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
    expect(manager.isActionPressed(GameAction.JUMP)).toBe(true);

    // Test persistence
    const anotherManager = new HotkeyManager();
    expect(anotherManager.getBindings()[GameAction.JUMP]).toEqual(['KeyX']);
    anotherManager.dispose();
  });

  test('should disable and enable keybindings', () => {
    manager.setEnabled(false);
    
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(manager.isActionPressed(GameAction.MOVE_FORWARD)).toBe(false);

    manager.setEnabled(true);
    // KeyW was pressed while disabled, but we reset keys on enable, so it should be false
    expect(manager.isActionPressed(GameAction.MOVE_FORWARD)).toBe(false);
    
    // Press again while enabled
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(manager.isActionPressed(GameAction.MOVE_FORWARD)).toBe(true);
  });

  test('should ignore shortcuts when typing in inputs', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const forwardDown = vi.fn();
    manager.onActionDown(GameAction.MOVE_FORWARD, forwardDown);

    // Keyboard event inside input
    const event = new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    
    window.dispatchEvent(event);
    expect(forwardDown).not.toHaveBeenCalled();
    expect(manager.isActionPressed(GameAction.MOVE_FORWARD)).toBe(false);

    // Clean up
    document.body.removeChild(input);
  });
});
