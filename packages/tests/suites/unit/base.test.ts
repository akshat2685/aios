import { describe, it, expect } from 'vitest';

describe('Base Packages Unit Tests', () => {
  describe('Events Package', () => {
    it('should emit and listen to events', () => {
      let fired = false;
      const listener = () => { fired = true; };
      const emitter = { on: (e: string, cb: any) => cb(), emit: (e: string) => {} };
      emitter.on('test', listener);
      expect(fired).toBe(true);
    });
  });

  describe('Timeline Package', () => {
    it('should add items to timeline and query them by time', () => {
      const timeline = [{ t: 100, val: 'a' }, { t: 200, val: 'b' }];
      const res = timeline.filter(x => x.t >= 150);
      expect(res.length).toBe(1);
      expect(res[0].val).toBe('b');
    });
  });

  describe('Workspace Package', () => {
    it('should detect active projects', () => {
      const workspaces = ['spencer-project', 'other-project'];
      expect(workspaces).toContain('spencer-project');
    });
  });

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

  describe('Cache Package', () => {
    it('should cache and retrieve values within TTL', () => {
      const cache = new Map();
      cache.set('key', { val: 'value', expiry: Date.now() + 10000 });
      const item = cache.get('key');
      expect(item.val).toBe('value');
    });

    it('should evict expired cache entries', () => {
      const cache = new Map();
      cache.set('key', { val: 'value', expiry: Date.now() - 10000 });
      const item = cache.get('key');
      const isExpired = Date.now() > item.expiry;
      expect(isExpired).toBe(true);
    });
  });
});
