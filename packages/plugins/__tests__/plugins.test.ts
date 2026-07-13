import { describe, it, expect } from 'vitest';

describe('Plugins Package', () => {
  it('should load a valid plugin', () => {
    const plugin = { name: 'test-plugin', init: () => true };
    expect(plugin.init()).toBe(true);
  });

  it('should handle plugin initialization failures gracefully', () => {
    const badPlugin = { init: () => { throw new Error('fail'); } };
    expect(() => badPlugin.init()).toThrow();
  });
});
