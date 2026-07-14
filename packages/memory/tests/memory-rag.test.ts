import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunkText } from '../src/chunker';
import { MemoryClient } from '../src/qdrant-client';

// Mock Qdrant Client module
const mockRequestFn = vi.fn();


vi.mock('@qdrant/js-client-rest', () => {
  return {
    QdrantClient: class {
      getCollections() { return Promise.resolve({ collections: [] }); }
      getCollection(name: any) { return mockRequestFn({ path: '/collections/{collection_name}', method: 'GET', collectionName: name }); }
      createCollection(name: any, data: any) { return mockRequestFn({ path: '/collections/{collection_name}', method: 'PUT', collectionName: name, body: data }); }
      upsert(name: any, data: any) { return mockRequestFn({ path: '/collections/{collection_name}/points', method: 'PUT', collectionName: name, body: data }); }
      search(name: any, data: any) { return mockRequestFn({ path: '/collections/{collection_name}/points/search', method: 'POST', collectionName: name, body: data }); }
      scroll(name: any, data: any) { return mockRequestFn({ path: '/collections/{collection_name}/points/scroll', method: 'POST', collectionName: name, body: data }); }
      delete(name: any, data: any) { return mockRequestFn({ path: '/collections/{collection_name}/points/delete', method: 'POST', collectionName: name, body: data }); }
      retrieve(name: any, data: any) { return mockRequestFn({ path: '/collections/{collection_name}/points', method: 'POST', collectionName: name, body: data }); }
      deleteCollection(name: any) { return mockRequestFn({ path: '/collections/{collection_name}', method: 'DELETE', collectionName: name }); }
      createPayloadIndex(name: any, data: any) { return mockRequestFn({ path: '/collections/{collection_name}/index', method: 'PUT', collectionName: name, body: data }); }
    }
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
    mockRequestFn.mockReset();
    mockFetch.mockReset();
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

      expect(mockRequestFn).toHaveBeenCalledTimes(4);
      
      // First call (getCollection)
      expect(mockRequestFn.mock.calls[0][0].path).toBe('/collections/{collection_name}');
      expect(mockRequestFn.mock.calls[0][0].method).toBe('GET');

      // Second call (createCollection)
      expect(mockRequestFn.mock.calls[1][0].path).toBe('/collections/{collection_name}');
      expect(mockRequestFn.mock.calls[1][0].method).toBe('PUT');
      
      // Third call (createPayloadIndex)
      expect(mockRequestFn.mock.calls[2][0].path).toBe('/collections/{collection_name}/index');
      expect(mockRequestFn.mock.calls[2][0].method).toBe('PUT');
      
      // Fourth call (createPayloadIndex)
      expect(mockRequestFn.mock.calls[3][0].path).toBe('/collections/{collection_name}/index');
      expect(mockRequestFn.mock.calls[3][0].method).toBe('PUT');
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
      // Mock getCollection for init()
      mockRequestFn.mockResolvedValueOnce({ data: { result: { status: 'green' } } });
      // Mock upsert response
      mockRequestFn.mockResolvedValueOnce({ data: { result: { status: 'completed' } } });

      const client = new MemoryClient();
      await client.init();
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
      expect(mockRequestFn).toHaveBeenCalledTimes(2);
      expect(mockRequestFn.mock.calls[1][0].path).toBe('/collections/{collection_name}/points');
      expect(mockRequestFn.mock.calls[1][0].method).toBe('PUT');
      expect(mockRequestFn.mock.calls[1][0].body).toEqual({
        points: [
          {
            id: record.id,
            vector: expect.any(Object),
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
      
      // Mock getCollection for init()
      mockRequestFn.mockResolvedValueOnce({ data: { result: { status: 'green' } } });
      // Mock search response
      mockRequestFn.mockResolvedValueOnce([
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
      ]);

      const client = new MemoryClient();
      await client.init();
      const results = await client.search({ query: 'Search test term', limit: 5 });

      expect(results.length).toBe(1);
      expect(results[0].content).toBe('Found text');
      expect(mockRequestFn.mock.calls[1][0].path).toBe('/collections/{collection_name}/points/search');
      expect(mockRequestFn.mock.calls[1][0].method).toBe('POST');
      expect(mockRequestFn.mock.calls[1][0].body).toEqual({
        vector: expect.any(Array),
        filter: undefined,
        limit: 5,
        offset: 0,
        with_payload: true
      });
    });
  });
});
