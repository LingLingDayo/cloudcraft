import { useEffect } from 'react';

interface UseBackToCloseOptions {
  onClose?: () => void;
  enabled?: boolean;
}

/**
 * A hook that blocks the browser or phone's back button action when a dialog/modal is open.
 * It uses the HTML5 History API to push a history entry, preventing the page from navigating
 * away or closing when the back button is pressed.
 * 
 * @param options configuration options containing the optional onClose callback and whether the hook is enabled
 */
export function useBackToClose({ enabled = true }: UseBackToCloseOptions) {
  useEffect(() => {
    if (!enabled) return;

    // Create a unique identifier for this dialog state
    const stateId = `dialog-${Math.random().toString(36).substring(2, 11)}`;
    const originalState = typeof window.history.state === 'object' ? window.history.state : null;

    // Push state to history stack to intercept the back button action
    window.history.pushState(
      { ...originalState, type: 'dialog', stateId },
      ''
    );

    const handlePopState = (event: PopStateEvent) => {
      // If the state popped does not match our stateId, it means our state is no longer active.
      // E.g. we popped back past it (user clicked back button).
      // We push the state back to block the navigation without closing the dialog.
      if (!event.state || event.state.stateId !== stateId) {
        window.history.pushState(
          { ...originalState, type: 'dialog', stateId },
          ''
        );
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // Clean up the history state we pushed to clean up history stack.
      if (window.history.state && window.history.state.stateId === stateId) {
        window.history.back();
      }
    };
  }, [enabled]);
}
