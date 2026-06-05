import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useBackToClose } from './useBackToClose';

const TestComponent = ({ onClose, enabled }: { onClose: () => void; enabled?: boolean }) => {
  useBackToClose({ onClose, enabled });
  return <div>Test Dialog</div>;
};

describe('useBackToClose hook', () => {
  beforeEach(() => {
    // Clear history state and reset
    window.history.replaceState(null, '');
  });

  it('should push state to history stack on mount if enabled is true', () => {
    const onClose = vi.fn();
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    render(<TestComponent onClose={onClose} enabled={true} />);

    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual(
      expect.objectContaining({
        type: 'dialog',
        stateId: expect.any(String),
      })
    );

    pushStateSpy.mockRestore();
  });

  it('should not push state to history stack on mount if enabled is false', () => {
    const onClose = vi.fn();
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    render(<TestComponent onClose={onClose} enabled={false} />);

    expect(pushStateSpy).not.toHaveBeenCalled();
    pushStateSpy.mockRestore();
  });

  it('should call onClose when history popstate occurs and the state does not match', () => {
    const onClose = vi.fn();
    const { unmount } = render(<TestComponent onClose={onClose} enabled={true} />);

    // Simulate clicking back button
    // In actual browser, going back triggers popstate. In JSDOM, we can trigger the event.
    // We mock going back: we set history state to null and dispatch popstate.
    window.history.replaceState(null, '');
    const popEvent = new PopStateEvent('popstate', { state: null });
    window.dispatchEvent(popEvent);

    expect(onClose).toHaveBeenCalledTimes(1);

    // Unmounting after popstate should NOT trigger history.back()
    const backSpy = vi.spyOn(window.history, 'back');
    unmount();
    expect(backSpy).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });

  it('should call history.back() on unmount if manually closed (not popped by system)', () => {
    const onClose = vi.fn();
    const backSpy = vi.spyOn(window.history, 'back');

    const { unmount } = render(<TestComponent onClose={onClose} enabled={true} />);

    // Simulate manual unmount (which happens when dialog is closed by user)
    unmount();

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });
});
