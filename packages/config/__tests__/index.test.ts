import { describe, it, expect } from 'vitest';
import * as index from '../src/index';

describe('index', () => {
  it('should export config items', () => {
    expect(index.ConfigManager).toBeDefined();
    expect(index.configManager).toBeDefined();
    expect(index.ConfigSchema).toBeDefined();
  });
});
