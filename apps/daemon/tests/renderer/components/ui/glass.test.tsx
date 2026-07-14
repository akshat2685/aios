import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { cn, GlassContainer, GlassButton, GlassPanel, GlassNavItem } from '@aios/ui';

vi.mock('react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      forwardRef: vi.fn((render) => render),
    },
    forwardRef: vi.fn((render) => render),
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => <div data-testid="motion-div" {...props} />,
    button: (props: any) => <button data-testid="motion-button" {...props} />,
  }
}));

describe('glass component utils', () => {
  it('cn should merge classes correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
    expect(cn('p-4', 'p-6')).toBe('p-6'); // tailwind-merge logic
  });
});

describe('GlassContainer', () => {
  it('should render subtle intensity', () => {
    const result = (GlassContainer as any)({ intensity: 'subtle', className: 'test-class' }, null);
    expect(result.props.className).toContain('glass-subtle');
    expect(result.props.className).toContain('test-class');
  });

  it('should render interactive container', () => {
    const result = (GlassContainer as any)({ interactive: true }, null);
    expect(result.props.className).toContain('glass-interactive cursor-pointer');
    expect(result.props.whileHover).toEqual({ scale: 1.02 });
    expect(result.props.whileTap).toEqual({ scale: 0.98 });
  });
});

describe('GlassButton', () => {
  it('should render with default props', () => {
    const result = (GlassButton as any)({}, null);
    expect(result.props.className).toContain('hover:bg-white/10');
    expect(result.props.className).toContain('px-4 py-2');
  });

  it('should render accent and lg size', () => {
    const result = (GlassButton as any)({ variant: 'accent', size: 'lg' }, null);
    expect(result.props.className).toContain('bg-blue-500/20');
    expect(result.props.className).toContain('px-6 py-3 text-lg');
  });
  
  it('should render danger, success, warning variants and sm, icon sizes', () => {
    let result = (GlassButton as any)({ variant: 'danger', size: 'sm' }, null);
    expect(result.props.className).toContain('bg-red-500/20');
    expect(result.props.className).toContain('px-3 py-1.5 text-sm');

    result = (GlassButton as any)({ variant: 'success', size: 'icon' }, null);
    expect(result.props.className).toContain('bg-green-500/20');
    expect(result.props.className).toContain('p-2');

    result = (GlassButton as any)({ variant: 'warning' }, null);
    expect(result.props.className).toContain('bg-yellow-500/20');
  });
});

describe('GlassPanel', () => {
  it('should render correctly', () => {
    const result = (GlassPanel as any)({ className: 'custom' }, null);
    // Since GlassPanel renders GlassContainer, which is mocked to be a function call, wait... GlassContainer is a function because forwardRef returns the function itself due to our mock!
    // But GlassContainer is a React element in GlassPanel: <GlassContainer ... />
    // In React 18, JSX compiles to react/jsx-runtime, so it returns an object `{ type: GlassContainer, props: ... }`.
    expect(result.type).toBe(GlassContainer);
    expect(result.props.className).toContain('p-6 rounded-2xl');
    expect(result.props.className).toContain('custom');
  });
});

describe('GlassNavItem', () => {
  it('should render active item', () => {
    const result = (GlassNavItem as any)({ active: true, children: 'Test' }, null);
    expect(result.props.className).toContain('text-white glass-strong shadow-purple-glow');
    expect(result.props.whileHover).toEqual({ x: 0 });
    
    // Check for the indicator
    const indicator = result.props.children[0];
    expect(indicator.props.layoutId).toBe('nav-indicator');
  });

  it('should render inactive item', () => {
    const result = (GlassNavItem as any)({ active: false, children: 'Test' }, null);
    expect(result.props.className).toContain('text-white/60');
    expect(result.props.whileHover).toEqual({ x: 4 });
  });
});
