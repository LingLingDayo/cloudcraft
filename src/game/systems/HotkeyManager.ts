import { getSystemSettings, saveSystemSetting } from '@utils/settings';

export const GameAction = {
  MOVE_FORWARD: 'MOVE_FORWARD',
  MOVE_BACKWARD: 'MOVE_BACKWARD',
  MOVE_LEFT: 'MOVE_LEFT',
  MOVE_RIGHT: 'MOVE_RIGHT',
  JUMP: 'JUMP',
  SNEAK: 'SNEAK',
  TOGGLE_DEBUG: 'TOGGLE_DEBUG',
  TOGGLE_FLY: 'TOGGLE_FLY',
  HOTBAR_1: 'HOTBAR_1',
  HOTBAR_2: 'HOTBAR_2',
  HOTBAR_3: 'HOTBAR_3',
  HOTBAR_4: 'HOTBAR_4',
  HOTBAR_5: 'HOTBAR_5',
  HOTBAR_6: 'HOTBAR_6',
  HOTBAR_7: 'HOTBAR_7',
  HOTBAR_8: 'HOTBAR_8',
  HOTBAR_9: 'HOTBAR_9',
  OPEN_INVENTORY: 'OPEN_INVENTORY',
} as const;

export type GameAction = typeof GameAction[keyof typeof GameAction];

export const DEFAULT_KEY_BINDINGS: Record<GameAction, string[]> = {
  [GameAction.MOVE_FORWARD]: ['KeyW', 'ArrowUp'],
  [GameAction.MOVE_BACKWARD]: ['KeyS', 'ArrowDown'],
  [GameAction.MOVE_LEFT]: ['KeyA', 'ArrowLeft'],
  [GameAction.MOVE_RIGHT]: ['KeyD', 'ArrowRight'],
  [GameAction.JUMP]: ['Space'],
  [GameAction.SNEAK]: ['ShiftLeft', 'ShiftRight'],
  [GameAction.TOGGLE_DEBUG]: ['F3'],
  [GameAction.TOGGLE_FLY]: ['F4'],
  [GameAction.HOTBAR_1]: ['Digit1'],
  [GameAction.HOTBAR_2]: ['Digit2'],
  [GameAction.HOTBAR_3]: ['Digit3'],
  [GameAction.HOTBAR_4]: ['Digit4'],
  [GameAction.HOTBAR_5]: ['Digit5'],
  [GameAction.HOTBAR_6]: ['Digit6'],
  [GameAction.HOTBAR_7]: ['Digit7'],
  [GameAction.HOTBAR_8]: ['Digit8'],
  [GameAction.HOTBAR_9]: ['Digit9'],
  [GameAction.OPEN_INVENTORY]: ['KeyE'],
};

type ActionCallback = () => void;

export class HotkeyManager {
  private bindings: Record<GameAction, string[]> = { ...DEFAULT_KEY_BINDINGS };
  private keyToActions: Record<string, GameAction[]> = {};
  
  // Track currently pressed physical keys
  private pressedKeys: Set<string> = new Set();
  
  // Callback lists
  private downCallbacks: Record<string, ActionCallback[]> = {};
  private upCallbacks: Record<string, ActionCallback[]> = {};
  
  private enabled = true;

  constructor() {
    this.loadBindings();
    this.rebuildReverseLookup();
    this.initListeners();
  }

  private initListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  public dispose() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }

  /**
   * Rebuilds the fast lookup map mapping from a physical key code to GameActions.
   */
  private rebuildReverseLookup() {
    this.keyToActions = {};
    for (const actionStr in this.bindings) {
      const action = actionStr as GameAction;
      const keys = this.bindings[action];
      for (const key of keys) {
        if (!this.keyToActions[key]) {
          this.keyToActions[key] = [];
        }
        this.keyToActions[key].push(action);
      }
    }
  }

  /**
   * Checks if an input field is currently focused to avoid triggering shortcuts while typing.
   */
  private shouldIgnoreInput(e: KeyboardEvent): boolean {
    if (!this.enabled) return true;
    
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.hasAttribute !== 'function') return false;
    
    const tagName = target.tagName;
    const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    const isContentEditable = target.hasAttribute('contenteditable') || target.isContentEditable;
    
    return isInput || isContentEditable;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.shouldIgnoreInput(e)) return;

    const key = e.code;
    
    // F3 / F4 default browser action prevention
    if (key === 'F3' || key === 'F4') {
      e.preventDefault();
    }

    if (!this.pressedKeys.has(key)) {
      this.pressedKeys.add(key);
      
      // Trigger callbacks for any action bound to this key
      const actions = this.keyToActions[key];
      if (actions) {
        for (const action of actions) {
          const callbacks = this.downCallbacks[action];
          if (callbacks) {
            // Copy array to prevent mutation issues during execution
            [...callbacks].forEach(cb => cb());
          }
        }
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (this.shouldIgnoreInput(e)) return;

    const key = e.code;
    
    if (this.pressedKeys.has(key)) {
      this.pressedKeys.delete(key);
      
      const actions = this.keyToActions[key];
      if (actions) {
        for (const action of actions) {
          const callbacks = this.upCallbacks[action];
          if (callbacks) {
            [...callbacks].forEach(cb => cb());
          }
        }
      }
    }
  };

  private handleBlur = () => {
    // Clear all pressed keys on window blur to avoid sticky keys
    this.pressedKeys.clear();
  };

  /**
   * Set whether the hotkey manager is active.
   */
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.pressedKeys.clear();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  // For virtual buttons (mobile)
  private virtualPressedActions: Set<GameAction> = new Set();

  public setActionPressed(action: GameAction, pressed: boolean) {
    if (pressed) {
      if (!this.virtualPressedActions.has(action)) {
        this.virtualPressedActions.add(action);
        // Trigger callbacks for down
        const callbacks = this.downCallbacks[action];
        if (callbacks) {
          [...callbacks].forEach(cb => cb());
        }
      }
    } else {
      if (this.virtualPressedActions.has(action)) {
        this.virtualPressedActions.delete(action);
        // Trigger callbacks for up
        const callbacks = this.upCallbacks[action];
        if (callbacks) {
          [...callbacks].forEach(cb => cb());
        }
      }
    }
  }

  /**
   * Checks whether the given game action is currently active (any of its bound keys is pressed).
   */
  public isActionPressed(action: GameAction): boolean {
    if (!this.enabled) return false;
    if (this.virtualPressedActions.has(action)) return true;
    const keys = this.bindings[action];
    if (!keys) return false;
    return keys.some(key => this.pressedKeys.has(key));
  }

  /**
   * Register a callback when the action is pressed.
   * Returns a cleanup unsubscribe function.
   */
  public onActionDown(action: GameAction, callback: ActionCallback): () => void {
    if (!this.downCallbacks[action]) {
      this.downCallbacks[action] = [];
    }
    this.downCallbacks[action].push(callback);
    
    return () => {
      this.downCallbacks[action] = (this.downCallbacks[action] || []).filter(cb => cb !== callback);
    };
  }

  /**
   * Register a callback when the action is released.
   * Returns a cleanup unsubscribe function.
   */
  public onActionUp(action: GameAction, callback: ActionCallback): () => void {
    if (!this.upCallbacks[action]) {
      this.upCallbacks[action] = [];
    }
    this.upCallbacks[action].push(callback);
    
    return () => {
      this.upCallbacks[action] = (this.upCallbacks[action] || []).filter(cb => cb !== callback);
    };
  }

  /**
   * Remap keys for a specific action.
   */
  public remapAction(action: GameAction, keys: string[]) {
    this.bindings[action] = [...keys];
    this.rebuildReverseLookup();
    this.saveBindings();
  }

  /**
   * Get the current key bindings map.
   */
  public getBindings(): Record<GameAction, string[]> {
    return { ...this.bindings };
  }

  /**
   * Reset key bindings to default.
   */
  public resetToDefault() {
    this.bindings = { ...DEFAULT_KEY_BINDINGS };
    this.rebuildReverseLookup();
    this.saveBindings();
  }

  /**
   * Load custom bindings from system settings.
   */
  public loadBindings() {
    try {
      const settings = getSystemSettings();
      const loaded = settings.keybindings || {};
      for (const actionStr in DEFAULT_KEY_BINDINGS) {
        const action = actionStr as GameAction;
        if (Array.isArray(loaded[action])) {
          this.bindings[action] = loaded[action];
        } else {
          this.bindings[action] = DEFAULT_KEY_BINDINGS[action];
        }
      }
    } catch (e) {
      console.warn('Failed to load keybindings:', e);
    }
  }

  /**
   * Save custom bindings to system settings.
   */
  private saveBindings() {
    try {
      saveSystemSetting('keybindings', this.bindings);
    } catch (e) {
      console.warn('Failed to save keybindings:', e);
    }
  }
}

// Global Single Instance
export const hotkeyManager = new HotkeyManager();
