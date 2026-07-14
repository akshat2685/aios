import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
(globalThis as any).React = React;
import { Titlebar } from '../../../../src/renderer/components/layout/titlebar';

// Mocks
let mockCloudMode = 'local';
const mockSetCloudMode = vi.fn((mode) => { mockCloudMode = mode; });
vi.mock('../../../../src/renderer/stores/app-store', () => ({
  useAppStore: () => ({
    cloudMode: mockCloudMode,
    setCloudMode: mockSetCloudMode,
  })
}));

const mockMinimize = vi.fn();
const mockQuit = vi.fn();
const mockConfigSet = vi.fn();
vi.mock('../../../../src/renderer/lib/electron-api', () => ({
  getElectronAPI: () => ({
    app: { minimize: mockMinimize, quit: mockQuit },
    config: { set: mockConfigSet }
  })
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => {
      const { layout, ...rest } = props;
      return <div data-testid="motion-div" {...rest} />;
    },
    button: (props: any) => {
      const { whileHover, whileTap, ...rest } = props;
      return <button data-testid="motion-button" {...rest} />;
    },
  }
}));

vi.mock('lucide-react', () => ({
  Minus: () => <svg data-testid="minus" />,
  X: () => <svg data-testid="x" />,
  Cloud: () => <svg data-testid="cloud" />,
  Server: () => <svg data-testid="server" />,
}));

vi.mock('../../../../src/renderer/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('Titlebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCloudMode = 'local';
  });

  it('renders correctly', () => {
    const el = (Titlebar as any)({});
    expect(el.type).toBe('div');
  });

  it('toggles mode to online', () => {
    const el = (Titlebar as any)({});
    // Find the toggle button
    const container = el.props.children;
    const hudText = container[0].props.children.props.children;
    const toggleBtn = hudText[1]; // button

    toggleBtn.props.onClick();

    expect(mockSetCloudMode).toHaveBeenCalledWith('online');
    expect(mockConfigSet).toHaveBeenCalledWith('cloudMode', 'online');
  });
  
  it('toggles mode to local when online', () => {
    mockCloudMode = 'online';
    const el = (Titlebar as any)({});
    // Find the toggle button
    const container = el.props.children;
    const hudText = container[0].props.children.props.children;
    const toggleBtn = hudText[1]; // button

    toggleBtn.props.onClick();

    expect(mockSetCloudMode).toHaveBeenCalledWith('local');
    expect(mockConfigSet).toHaveBeenCalledWith('cloudMode', 'local');
  });

  it('calls minimize', () => {
    const el = (Titlebar as any)({});
    const buttons = el.props.children[1].props.children;
    const minimizeBtn = buttons[0];

    minimizeBtn.props.onClick();

    expect(mockMinimize).toHaveBeenCalled();
  });

  it('calls quit', () => {
    const el = (Titlebar as any)({});
    const buttons = el.props.children[1].props.children;
    const quitBtn = buttons[1];

    quitBtn.props.onClick();

    expect(mockQuit).toHaveBeenCalled();
  });
});
