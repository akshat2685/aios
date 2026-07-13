import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalSearchEngine } from '../src/engine';
import { CoreLogger } from '@aios/core';
import { IMemoryClient } from '@aios/types';

describe('GlobalSearchEngine', () => {
  let logger: CoreLogger;
  let memoryClient: IMemoryClient;
  let engine: GlobalSearchEngine;

  beforeEach(() => {
    logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as CoreLogger;
    memoryClient = {
      search: vi.fn(),
      add: vi.fn(),
      delete: vi.fn(),
    } as unknown as IMemoryClient;
    engine = new GlobalSearchEngine(logger, memoryClient);
  });

  it('should return semantic search results, map them correctly, and rank by score', async () => {
    vi.mocked(memoryClient.search).mockResolvedValue([
      { id: '1', score: 0.8, content: 'test 1', metadata: { type: 'NOTE', title: 'Note 1' } },
      { id: '2', score: 0.9, content: 'test 2', metadata: { type: 'MEMORY', title: 'Memory 1' } },
    ]);

    const results = await engine.search('test query', { limit: 2, useCache: false });

    expect(memoryClient.search).toHaveBeenCalledWith({ query: 'test query', limit: 4 }); // limit * 2 inside the class
    expect(results.length).toBe(2);
    // Should be sorted by score descending
    expect(results[0].id).toBe('2');
    expect(results[1].id).toBe('1');
  });

  it('should cache search results', async () => {
    vi.mocked(memoryClient.search).mockResolvedValue([
      { id: '1', score: 0.8, content: 'test 1', metadata: { type: 'NOTE' } },
    ]);

    await engine.search('cached query', { limit: 10, useCache: true });
    expect(memoryClient.search).toHaveBeenCalledTimes(1);

    // Second call should hit cache
    await engine.search('cached query', { limit: 10, useCache: true });
    expect(memoryClient.search).toHaveBeenCalledTimes(1); // Still 1
  });

  it('should clear cache successfully', async () => {
    vi.mocked(memoryClient.search).mockResolvedValue([]);
    await engine.search('query', { useCache: true });
    expect(memoryClient.search).toHaveBeenCalledTimes(1);
    
    engine.clearCache();
    await engine.search('query', { useCache: true });
    expect(memoryClient.search).toHaveBeenCalledTimes(2);
  });
});
