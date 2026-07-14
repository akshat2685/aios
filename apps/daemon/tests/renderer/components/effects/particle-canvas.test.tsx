import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
(globalThis as any).React = React;
import { ParticleCanvas } from '../../../../src/renderer/components/effects/particle-canvas';

// Mock dependencies
let effectCallback: any = null;
let cleanupCallback: any = null;
let mockCanvas: any = null;

vi.mock('react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useRef: (initVal: any) => {
      if (initVal === null) return { current: mockCanvas };
      return { current: initVal };
    },
    useEffect: (cb: any, deps: any) => {
      effectCallback = cb;
    },
  };
});

describe('ParticleCanvas', () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
    };

    mockCanvas = {
      getContext: vi.fn(() => mockCtx),
      width: 800,
      height: 600,
    };

    (globalThis as any).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      innerWidth: 1024,
      innerHeight: 768,
    };
    let rAFCount = 0;
    globalThis.requestAnimationFrame = vi.fn((cb) => {
      if (rAFCount < 2) {
        rAFCount++;
        cb();
      }
      return 1;
    });
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    effectCallback = null;
    cleanupCallback = null;
  });

  it('renders canvas element', () => {
    const el = (ParticleCanvas as any)({});
    expect(el.type).toBe('canvas');
  });

  it('runs effect and cleans up', () => {
    // Render to set effectCallback
    (ParticleCanvas as any)({});
    
    expect(effectCallback).not.toBeNull();
    
    // Run the effect
    cleanupCallback = effectCallback();
    
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    expect(globalThis.window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    
    // Simulate resize event
    const resizeHandler = (globalThis.window.addEventListener as any).mock.calls[0][1];
    resizeHandler();
    expect(mockCanvas.width).toBe(1024);
    
    // Run cleanup
    if (cleanupCallback) cleanupCallback();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
    expect(globalThis.window.removeEventListener).toHaveBeenCalledWith('resize', resizeHandler);
  });

  it('handles particle bounds', () => {
    // Override Math.random to make particles go out of bounds
    let count = 0;
    const origRandom = Math.random;
    Math.random = () => {
      count++;
      if (count % 2 === 0) return 1.5; // Will make x, y large
      return -0.5; // Will make x, y negative
    };
    
    (ParticleCanvas as any)({});
    effectCallback();
    
    Math.random = origRandom;
  });

  it('handles reduced motion', () => {
    globalThis.window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    (ParticleCanvas as any)({});
    effectCallback();
    expect(mockCanvas.getContext).not.toHaveBeenCalled();
  });

  it('handles null canvas', () => {
    mockCanvas = null;
    (ParticleCanvas as any)({});
    effectCallback();
    // getContext should not throw
  });
  
  it('handles null context', () => {
    mockCanvas.getContext = vi.fn(() => null);
    (ParticleCanvas as any)({});
    effectCallback();
    // should return early
  });
});
