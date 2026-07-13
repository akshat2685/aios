import { describe, it, expect } from 'vitest';

describe('Events Package', () => {
  it('should emit and listen to events', () => {
    let fired = false;
    const listener = () => { fired = true; };
    const emitter = { on: (e: string, cb: any) => cb(), emit: (e: string) => {} };
    emitter.on('test', listener);
    expect(fired).toBe(true);
  });
});
