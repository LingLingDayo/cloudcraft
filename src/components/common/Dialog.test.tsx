import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from './Dialog';

// Mock translation hook
vi.mock('@i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        'common.close': 'Close',
      };
      return keys[key] || key;
    },
  }),
}));

describe('Dialog component', () => {
  it('should render dialog content when open', () => {
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} title="Test Dialog">
        <div>Dialog Content</div>
      </Dialog>
    );

    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByText('Dialog Content')).toBeInTheDocument();
  });

  it('should trigger onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} title="Test Dialog">
        <div>Dialog Content</div>
      </Dialog>
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should trigger onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} title="Test Dialog">
        <div>Dialog Content</div>
      </Dialog>
    );

    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
