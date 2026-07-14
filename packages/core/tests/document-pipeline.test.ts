import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentPipeline } from '../src/document-pipeline';
import { IMemoryClient, IPreprocessor, IDocumentContext } from '@aios/types';
import { EventEmitter } from 'events';

describe('DocumentPipeline', () => {
  let mockMemoryClient: IMemoryClient;
  let pipeline: DocumentPipeline;

  beforeEach(() => {
    mockMemoryClient = {
      init: vi.fn(),
      add: vi.fn(),
      addMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByMetadata: vi.fn(),
      getById: vi.fn(),
      search: vi.fn(),
      clear: vi.fn(),
      getStats: vi.fn(),
    };
    pipeline = new DocumentPipeline(mockMemoryClient);
  });

  it('should process a document and emit events', async () => {
    const emitSpy = vi.spyOn(pipeline, 'emit');

    const mockPreprocessor: IPreprocessor = {
      name: 'MockPreprocessor',
      process: async (context: IDocumentContext) => {
        context.normalizedContent = context.rawContent.toLowerCase();
      }
    };
    pipeline.addPreprocessor(mockPreprocessor);

    const docId = await pipeline.ingest('test-source', 'TEST CONTENT', { type: 'test' });

    expect(docId).toBeDefined();
    
    // Check events
    expect(emitSpy).toHaveBeenCalledWith('DocumentReceived', expect.objectContaining({
      type: 'DocumentReceived',
      payload: expect.objectContaining({
        source: 'test-source',
        content: 'TEST CONTENT'
      })
    }));

    expect(emitSpy).toHaveBeenCalledWith('DocumentNormalized', expect.objectContaining({
      type: 'DocumentNormalized',
      payload: expect.objectContaining({
        normalizedContent: 'test content'
      })
    }));

    expect(emitSpy).toHaveBeenCalledWith('ChunksCreated', expect.anything());
  });

  it('should handle cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    const mockPreprocessor: IPreprocessor = {
      name: 'SlowPreprocessor',
      process: async (context: IDocumentContext) => {
        controller.abort(); // Abort during processing
      }
    };
    pipeline.addPreprocessor(mockPreprocessor);

    await expect(
      pipeline.ingest('test-source', 'TEST CONTENT', {}, controller.signal)
    ).rejects.toThrow('Pipeline failed for test-source: Ingestion pipeline aborted');
  });

  it('should call embeddingProvider and postprocessors when provided', async () => {
    const mockEmbeddingProvider = {
      name: 'TestEmbedder',
      embed: vi.fn().mockResolvedValue(undefined)
    };
    const mockPostprocessor = {
      name: 'TestPostprocessor',
      process: vi.fn().mockResolvedValue(undefined)
    };

    pipeline.setEmbeddingProvider(mockEmbeddingProvider);
    pipeline.addPostprocessor(mockPostprocessor);

    await pipeline.ingest('source', 'content', {});

    expect(mockEmbeddingProvider.embed).toHaveBeenCalledTimes(1);
    expect(mockPostprocessor.process).toHaveBeenCalledTimes(1);
  });

  it('should call chunker when setChunker is used', async () => {
    const mockChunker = {
      name: 'TestChunker',
      chunk: vi.fn().mockResolvedValue(undefined)
    };

    pipeline.setChunker(mockChunker);

    await pipeline.ingest('source', 'content', {});

    expect(mockChunker.chunk).toHaveBeenCalledTimes(1);
  });

  it('should handle empty content resulting in 0 documentSizeBytes', async () => {
    const docId = await pipeline.ingest('empty-source', '', {});
    expect(docId).toBeDefined();
  });
});
