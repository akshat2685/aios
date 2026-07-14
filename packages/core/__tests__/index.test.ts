import { describe, it, expect } from 'vitest';
import * as index from '../src/index';

describe('index', () => {
  it('should export modules correctly', () => {
    expect(index.CoreLogger).toBeDefined();
    expect(index.MemoryOperations).toBeDefined();
    expect(index.DocumentPipeline).toBeDefined();
    expect(index.MemoryStoragePostprocessor).toBeDefined();
    expect(index.TelemetryEngine).toBeDefined();
    expect(index.MetricsCollector).toBeDefined();
  });
});
