import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
(globalThis as any).React = React;
import { StatusBar } from '../../../../src/renderer/components/layout/status-bar';

let effectCallback: any = null;
let effectCleanup: any = null;
let stateCallback: any = null;

vi.mock('react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useEffect: (cb: any) => {
      effectCallback = cb;
    },
    useState: (init: any) => {
      return [init, (val: any) => { stateCallback = val; }];
    }
  };
});

let mockCloudMode = 'local';
let mockOllamaStatus = 'online';
vi.mock('../../../../src/renderer/stores/app-store', () => ({
  useAppStore: () => ({
    ollamaStatus: mockOllamaStatus,
    cloudMode: mockCloudMode,
  })
}));

const mockSystemMetrics = vi.fn(() => Promise.resolve({ cpuUsage: 85 }));
const mockWorkflowList = vi.fn(() => Promise.resolve([1, 2]));
const mockPluginsList = vi.fn(() => Promise.resolve([{ status: 'running' }]));
vi.mock('../../../../src/renderer/lib/electron-api', () => ({
  getElectronAPI: () => ({
    system: { metrics: mockSystemMetrics },
    workflow: { list: mockWorkflowList },
    plugins: { list: mockPluginsList }
  })
}));

vi.mock('lucide-react', () => ({
  Zap: () => <svg data-testid="zap" />,
  Activity: () => <svg data-testid="activity" />,
  HardDrive: () => <svg data-testid="harddrive" />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => {
      const { whileHover, ...rest } = props;
      return <div data-testid="motion-div" {...rest} />;
    },
  }
}));

vi.mock('../../../../src/renderer/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    effectCallback = null;
    effectCleanup = null;
    stateCallback = null;
    mockCloudMode = 'local';
    mockOllamaStatus = 'online';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders online and local modes', () => {
    const el = (StatusBar as any)({});
    expect(el.type).toBe('div');
  });

  it('renders cloud mode', () => {
    mockCloudMode = 'online';
    mockOllamaStatus = 'offline';
    (StatusBar as any)({});
  });

  it('runs interval in useEffect', async () => {
    (StatusBar as any)({});
    effectCleanup = effectCallback();
    
    // Fast forward interval
    await vi.advanceTimersByTimeAsync(5000);
    
    expect(mockSystemMetrics).toHaveBeenCalled();
    expect(mockWorkflowList).toHaveBeenCalled();
    expect(mockPluginsList).toHaveBeenCalled();
    
    expect(stateCallback).toEqual({ cpu: 85, workflows: 2, plugins: 1 });
    
    effectCleanup(); // cleanup interval
  });

  it('handles api errors gracefully', async () => {
    mockSystemMetrics.mockRejectedValueOnce(new Error('test'));
    (StatusBar as any)({});
    effectCleanup = effectCallback();
    
    await vi.advanceTimersByTimeAsync(5000);
    
    effectCleanup();
  });
});
