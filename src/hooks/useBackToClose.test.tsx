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

  it('should not call onClose and should push state again to history when popstate occurs', () => {
    const onClose = vi.fn();
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const { unmount } = render(<TestComponent onClose={onClose} enabled={true} />);

    // Initial push on mount
    expect(pushStateSpy).toHaveBeenCalledTimes(1);

    // Simulate clicking back button (triggers popstate)
    window.history.replaceState(null, '');
    const popEvent = new PopStateEvent('popstate', { state: null });
    window.dispatchEvent(popEvent);

    // onClose should not be called
    expect(onClose).not.toHaveBeenCalled();

    // Should pushState again to intercept the back action next time
    expect(pushStateSpy).toHaveBeenCalledTimes(2);

    pushStateSpy.mockRestore();
    unmount();
  });

  it('should call history.back() on unmount if manually closed', () => {
    const onClose = vi.fn();
    const backSpy = vi.spyOn(window.history, 'back');

    const { unmount } = render(<TestComponent onClose={onClose} enabled={true} />);

    unmount();

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('should call history.back() on unmount even after popstate occurred and was intercepted', () => {
    const onClose = vi.fn();
    const backSpy = vi.spyOn(window.history, 'back');

    const { unmount } = render(<TestComponent onClose={onClose} enabled={true} />);

    // Simulate clicking back button
    window.history.replaceState(null, '');
    const popEvent = new PopStateEvent('popstate', { state: null });
    window.dispatchEvent(popEvent);

    // Unmounting should still trigger history.back() because the state was pushed back
    unmount();

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });
});
