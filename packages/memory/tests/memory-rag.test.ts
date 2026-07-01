import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunkText } from '../src/chunker';
import { MemoryClient } from '../src/qdrant-client';

// Mock Qdrant Client module
const mockRequestFn = vi.fn();

vi.mock('qdrant-client', () => {
  class MockApi {
    public collections: any;
    constructor() {
      this.collections = {
        getCollection: (name: string) => mockRequestFn({ path: '/collections/{collection_name}', method: 'GET', collectionName: name }),
        createCollection: (name: string, data: any) => mockRequestFn({ path: '/collections/{collection_name}', method: 'PUT', collectionName: name, body: data }),
        upsertPoints: (name: string, data: any) => mockRequestFn({ path: '/collections/{collection_name}/points', method: 'PUT', collectionName: name, body: data }),
        searchPoints: (name: string, data: any) => mockRequestFn({ path: '/collections/{collection_name}/points/search', method: 'POST', collectionName: name, body: data }),
        scrollPoints: (name: string, data: any) => mockRequestFn({ path: '/collections/{collection_name}/points/scroll', method: 'POST', collectionName: name, body: data }),
        deletePoints: (name: string, data: any) => mockRequestFn({ path: '/collections/{collection_name}/points/delete', method: 'POST', collectionName: name, body: data }),
        getPoints: (name: string, data: any) => mockRequestFn({ path: '/collections/{collection_name}/points', method: 'POST', collectionName: name, body: data }),
      };
    }
  }
  return {
    Api: MockApi,
    default: MockApi
  };
});

// Mock config manager
vi.mock('@aios/config/config-manager', () => {
  return {
    ConfigManager: {
      get: vi.fn((key) => {
        if (key === 'memory') {
          return {
            collectionName: 'test_memory',
            embeddingModel: 'all-minilm',
            embeddingDim: 384,
            qdrantUrl: 'http://localhost:6333'
          };
        }
        if (key === 'llm') {
          return {
            ollama: { host: 'http://localhost:11434' }
          };
        }
        return null;
      })
    }
  };
});

// Mock Global Fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AIOS Memory & RAG Pipeline Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Recursive Character Chunker', () => {
    it('should split a long text into correct sized chunks with overlap', () => {
      const text = 'Paragraph one of text that is fairly long.\n\nParagraph two that has another sentence. Paragraph two continues here.';
      const chunks = chunkText(text, { chunkSize: 30, chunkOverlap: 5 });

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(30);
      });
    });

    it('should handle small texts without splitting', () => {
      const text = 'Short text';
      const chunks = chunkText(text, { chunkSize: 50, chunkOverlap: 5 });
      expect(chunks).toEqual(['Short text']);
    });
  });

  describe('Memory Client Qdrant Integration', () => {
    it('should create collection if it does not exist', async () => {
      // 1. Simulate getCollection failing (not found)
      mockRequestFn.mockRejectedValueOnce(new Error('Collection not found'));
      // 2. Simulate createCollection succeeding
      mockRequestFn.mockResolvedValueOnce({ data: { result: true } });

      const client = new MemoryClient();
      await client.init();

      expect(mockRequestFn).toHaveBeenCalledTimes(2);
      
      // First call (getCollection)
      expect(mockRequestFn.mock.calls[0][0].path).toBe('/collections/{collection_name}');
      expect(mockRequestFn.mock.calls[0][0].method).toBe('GET');

      // Second call (createCollection)
      expect(mockRequestFn.mock.calls[1][0].path).toBe('/collections/{collection_name}');
      expect(mockRequestFn.mock.calls[1][0].method).toBe('PUT');
      expect(mockRequestFn.mock.calls[1][0].body).toEqual({
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
    });

    it('should skip creation if collection already exists', async () => {
      mockRequestFn.mockResolvedValueOnce({ data: { result: { status: 'green' } } });

      const client = new MemoryClient();
      await client.init();

      expect(mockRequestFn).toHaveBeenCalledTimes(1);
      expect(mockRequestFn.mock.calls[0][0].path).toBe('/collections/{collection_name}');
      expect(mockRequestFn.mock.calls[0][0].method).toBe('GET');
    });

    it('should generate embeddings via Ollama and add records to Qdrant', async () => {
      // Mock Ollama embeddings response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: new Array(384).fill(0.1) })
      });
      // Mock upsertPoints response
      mockRequestFn.mockResolvedValueOnce({ data: { result: { status: 'completed' } } });

      const client = new MemoryClient();
      const record = {
        id: 'test-uuid-1',
        type: 'file',
        content: 'Test content to save',
        metadata: { path: 'C:\\test.txt' },
        createdAt: 1000,
        updatedAt: 1000
      };

      await client.add(record);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockRequestFn).toHaveBeenCalledTimes(1);
      expect(mockRequestFn.mock.calls[0][0].path).toBe('/collections/{collection_name}/points');
      expect(mockRequestFn.mock.calls[0][0].method).toBe('PUT');
      expect(mockRequestFn.mock.calls[0][0].body).toEqual({
        points: [
          {
            id: record.id,
            vector: expect.any(Array),
            payload: {
              type: record.type,
              content: record.content,
              metadata: record.metadata,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt
            }
          }
        ]
      });
    });

    it('should search memory using embeddings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: new Array(384).fill(0.1) })
      });
      
      mockRequestFn.mockResolvedValueOnce({
        data: {
          result: [
            {
              id: 'test-uuid-1',
              payload: {
                type: 'file',
                content: 'Found text',
                metadata: { path: 'C:\\test.txt' },
                createdAt: 1000,
                updatedAt: 1000
              }
            }
          ]
        }
      });

      const client = new MemoryClient();
      const results = await client.search({ query: 'Search test term', limit: 5 });

      expect(results.length).toBe(1);
      expect(results[0].content).toBe('Found text');
      expect(mockRequestFn.mock.calls[0][0].path).toBe('/collections/{collection_name}/points/search');
      expect(mockRequestFn.mock.calls[0][0].method).toBe('POST');
      expect(mockRequestFn.mock.calls[0][0].body).toEqual({
        vector: expect.any(Array),
        filter: undefined,
        limit: 5,
        offset: 0,
        with_payload: true
      });
    });
  });
});
