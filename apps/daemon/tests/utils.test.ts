import { describe, it, expect } from 'vitest';
import { cn } from '../src/renderer/lib/utils';

describe('utils cn()', () => {
  it('should merge classes correctly', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('should handle conditional classes', () => {
    expect(cn('p-4', true && 'm-2', false && 'hidden')).toBe('p-4 m-2');
  });

  it('should merge tailwind classes gracefully', () => {
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
  });

  it('should handle arrays of classes', () => {
    expect(cn(['bg-blue-500', 'flex'], 'items-center')).toBe('bg-blue-500 flex items-center');
  });
});
