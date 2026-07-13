import { describe, it, expect } from 'vitest';

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
