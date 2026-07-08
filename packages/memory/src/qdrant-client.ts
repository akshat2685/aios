import { ConfigManager } from '@aios/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface MemoryRecord {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface MemorySearchOptions {
  query: string;
  filter?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export class MemoryClient {
  private client!: QdrantClient;
  private collectionName: string;
  private config: any;

  constructor() {
    this.config = ConfigManager.get('memory') || {};
    this.collectionName = this.config.collectionName || 'aios_memory';
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      // Just check if we can list collections
      await this.client.getCollections();
      return true;
    } catch (e) {
      return false;
    }
  }

  async init(): Promise<void> {
    try {
      this.client = new QdrantClient({
        url: this.config.qdrantUrl || 'http://127.0.0.1:6333',
        apiKey: this.config.qdrantApiKey
      });

      if (!(await this.healthCheck())) {
        this.warn('Qdrant memory database is unreachable. Will operate in degraded mode until it comes back.');
        return; // Don't crash, just operate in degraded mode
      }

      // Check if collection exists
      let collectionExists = false;
      try {
        await this.client.getCollection(this.collectionName);
        collectionExists = true;
      } catch (e) {
        // Not found
        this.info('Collection does not exist, creating new collection...');
      }

      if (!collectionExists) {
        const dim = this.config.embeddingDim || 384;
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: dim,
            distance: 'Cosine',
          },
        });
        this.info(`Created collection ${this.collectionName} with dimension ${dim}`);
      }
      this.info('Memory client initialized successfully');
    } catch (error: any) {
      this.error('Failed to initialize memory client', error);
      // We don't throw here to prevent bringing down the whole daemon
    }
  }

  async add(record: MemoryRecord): Promise<void> {
    try {
      const vector = await this.getEmbedding(record.content);
      await this.client.upsert(this.collectionName, {
        points: [
          {
            id: record.id,
            vector: vector,
            payload: {
              type: record.type,
              content: record.content,
              metadata: record.metadata,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
            },
          }
        ],
      });
      this.info('Memory record added', { id: record.id, type: record.type });
    } catch (error: any) {
      this.error('Failed to add memory record', error);
      throw error;
    }
  }

  async addMany(records: MemoryRecord[]): Promise<void> {
    try {
      const points = [];
      for (const record of records) {
        const vector = await this.getEmbedding(record.content);
        points.push({
          id: record.id,
          vector: vector,
          payload: {
            type: record.type,
            content: record.content,
            metadata: record.metadata,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        });
      }

      if (points.length > 0) {
        await this.client.upsert(this.collectionName, {
          points,
        });
      }
      this.info(`Successfully added ${records.length} memory records`);
    } catch (error: any) {
      this.error('Failed to add multiple memory records', error);
      throw error;
    }
  }

  async search(options: MemorySearchOptions): Promise<MemoryRecord[]> {
    try {
      const vector = await this.getEmbedding(options.query);
      const points = await this.client.search(this.collectionName, {
        vector: vector,
        filter: options.filter as any,
        limit: options.limit || 10,
        offset: options.offset || 0,
        with_payload: true,
      });

      return points.map((point: any) => ({
        id: point.id,
        type: point.payload?.type || 'unknown',
        content: point.payload?.content || '',
        metadata: point.payload?.metadata || {},
        createdAt: point.payload?.createdAt || Date.now(),
        updatedAt: point.payload?.updatedAt || Date.now(),
      }));
    } catch (error: any) {
      this.error('Memory search failed', error);
      throw error;
    }
  }

  async update(recordId: string, updates: Partial<MemoryRecord>): Promise<void> {
    try {
      const record = await this.getById(recordId);
      if (!record) {
        this.warn(`Record ${recordId} not found for update`);
        return;
      }
      const updatedRecord = { ...record, ...updates, updatedAt: Date.now() };
      await this.add(updatedRecord as MemoryRecord);
    } catch (error: any) {
      this.error('Failed to update memory record', error);
      throw error;
    }
  }

  async delete(recordId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        points: [recordId],
      });
      this.info('Memory record deleted', { id: recordId });
    } catch (error: any) {
      this.error('Failed to delete memory record', error);
      throw error;
    }
  }

  async deleteByMetadata(key: string, value: any): Promise<void> {
    try {
      const response = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            {
              key: `metadata.${key}`,
              match: {
                value: value,
              },
            },
          ],
        } as any,
        limit: 10000,
        with_payload: false,
        with_vector: false,
      });

      const points = response.points || [];
      const ids = points.map((p: any) => p.id);

      if (ids.length > 0) {
        await this.client.delete(this.collectionName, {
          points: ids,
        });
        this.info(`Deleted ${ids.length} old memory records for metadata ${key}=${value}`);
      }
    } catch (error: any) {
      this.error(`Failed to delete points by metadata ${key}=${value}`, error);
      throw error;
    }
  }

  async getById(recordId: string): Promise<MemoryRecord | null> {
    try {
      const points = await this.client.retrieve(this.collectionName, {
        ids: [recordId],
        with_payload: true,
      });
      if (points.length === 0) return null;
      const point = points[0];
      return {
        id: point.id as string,
        type: point.payload?.type as string || 'unknown',
        content: point.payload?.content as string || '',
        metadata: point.payload?.metadata as Record<string, any> || {},
        createdAt: point.payload?.createdAt as number || Date.now(),
        updatedAt: point.payload?.updatedAt as number || Date.now(),
      };
    } catch (error: any) {
      this.error('Failed to get memory record by ID', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.deleteCollection(this.collectionName);
      await this.init();
      this.info('Memory cleared');
    } catch (error: any) {
      this.error('Failed to clear memory', error);
      throw error;
    }
  }

  async getStats(): Promise<Record<string, any>> {
    try {
      if (!(await this.healthCheck())) {
        return { points: 0, vectors: 0, status: 'unreachable' };
      }
      const result = await this.client.getCollection(this.collectionName);
      if (!result) return { points: 0, vectors: 0, status: 'unknown' };
      return {
        points: result.points_count,
        vectors: (result as any).vectors_count || result.points_count,
        status: result.status,
      };
    } catch (error: any) {
      this.error('Failed to get memory stats', error);
      return { points: 0, vectors: 0, status: 'unreachable' };
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const dim = this.config.embeddingDim || 384;
    try {
      const llmConfig = ConfigManager.get('llm') || {};
      const ollamaHost = llmConfig.ollama?.host || 'http://localhost:11434';
      const model = this.config.embeddingModel || 'all-minilm';

      const response = await fetch(`${ollamaHost}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json() as any;
      if (json.embedding && Array.isArray(json.embedding)) {
        return json.embedding;
      }
      throw new Error('Invalid response structure');
    } catch (error: any) {
      this.warn(`Failed to fetch embedding from Ollama: ${error.message}. Using deterministic fallback.`);
      return this.stringToVector(text, dim);
    }
  }

  private stringToVector(text: string, dim: number): number[] {
    const vector = new Array(dim).fill(0);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
    }
    
    for (let j = 0; j < dim; j++) {
      hash = (1103515245 * hash + 12345) & 0x7fffffff;
      vector[j] = (hash / 0x7fffffff) * 2 - 1;
    }
    return vector;
  }

  private info(message: string, meta?: any): void {
    try {
      require('@aios/core').CoreLogger.getInstance().info(message, meta);
    } catch {
      console.log(`[INFO] ${message}`, meta || '');
    }
  }

  private warn(message: string, meta?: any): void {
    try {
      require('@aios/core').CoreLogger.getInstance().warn(message, meta);
    } catch {
      console.warn(`[WARN] ${message}`, meta || '');
    }
  }

  private error(message: string, meta?: any): void {
    try {
      require('@aios/core').CoreLogger.getInstance().error(message, meta);
    } catch {
      console.error(`[ERROR] ${message}`, meta || '');
    }
  }
}