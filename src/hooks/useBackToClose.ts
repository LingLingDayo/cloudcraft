import { useEffect, useRef } from 'react';

interface UseBackToCloseOptions {
  onClose: () => void;
  enabled?: boolean;
}

/**
 * A hook that closes a dialog/modal when the user clicks the browser or phone's back button.
 * It uses the HTML5 History API to push a history entry, preventing the page from navigating
 * away or closing when the back button is pressed, and instead triggers the onClose callback.
 * 
 * @param options configuration options containing the onClose callback and whether the hook is enabled
 */
export function useBackToClose({ onClose, enabled = true }: UseBackToCloseOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!enabled) return;

    // Create a unique identifier for this dialog state
    const stateId = `dialog-${Math.random().toString(36).substring(2, 11)}`;
    const originalState = typeof window.history.state === 'object' ? window.history.state : null;

    let poppedBySystem = false;

    // Push state to history stack to intercept the back button action
    window.history.pushState(
      { ...originalState, type: 'dialog', stateId },
      ''
    );

    const handlePopState = (event: PopStateEvent) => {
      // If the state popped does not match our stateId, it means our state is no longer active.
      // E.g. we popped back past it (user clicked back button).
      if (!event.state || event.state.stateId !== stateId) {
        poppedBySystem = true;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // If the component is unmounting but it wasn't popped by the browser/system (i.e. manual close),
      // we must pop the state we pushed to clean up history stack.
      if (!poppedBySystem) {
        if (window.history.state && window.history.state.stateId === stateId) {
          window.history.back();
        }
      }
    };
  }, [enabled]);
}
