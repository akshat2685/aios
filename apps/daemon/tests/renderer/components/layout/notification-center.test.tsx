import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
(globalThis as any).React = React;
import { NotificationCenter } from '../../../../src/renderer/components/layout/notification-center';

const mockRemoveToast = vi.fn();
let mockToasts: any[] = [];

vi.mock('../../../../src/renderer/stores/toast-store', () => ({
  useToastStore: () => ({
    toasts: mockToasts,
    removeToast: mockRemoveToast,
  })
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: (props: any) => <div data-testid="animate-presence" {...props} />,
  motion: {
    div: (props: any) => {
      const { layout, initial, animate, exit, transition, ...rest } = props;
      return <div data-testid="motion-div" {...rest} />;
    },
  }
}));

vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="x" />,
  Info: () => <svg data-testid="info" />,
  CheckCircle2: () => <svg data-testid="check" />,
  AlertTriangle: () => <svg data-testid="alert" />,
  XCircle: () => <svg data-testid="xcircle" />,
}));

vi.mock('../../../../src/renderer/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToasts = [];
  });

  it('renders correctly with no toasts', () => {
    const el = (NotificationCenter as any)({});
    expect(el.type).toBe('div');
  });

  it('renders various toast types and removes them', () => {
    mockToasts = [
      { id: '1', type: 'info', title: 'Info Toast', message: 'info msg' },
      { id: '2', type: 'success', title: 'Success Toast' },
      { id: '3', type: 'warning', title: 'Warn Toast' },
      { id: '4', type: 'error', title: 'Error Toast' }
    ];
    const el = (NotificationCenter as any)({});
    const presence = el.props.children;
    const toastElements = presence.props.children;
    expect(toastElements.length).toBe(4);

    // Click remove on the first toast
    const firstToast = toastElements[0];
    const removeBtn = firstToast.props.children[2];
    removeBtn.props.onClick();

    expect(mockRemoveToast).toHaveBeenCalledWith('1');
  });
});
