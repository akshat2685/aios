import { describe, it, expect } from 'vitest';

describe('Timeline Package', () => {
  it('should add items to timeline and query them by time', () => {
    const timeline = [{ t: 100, val: 'a' }, { t: 200, val: 'b' }];
    const res = timeline.filter(x => x.t >= 150);
    expect(res.length).toBe(1);
    expect(res[0].val).toBe('b');
  });
});
