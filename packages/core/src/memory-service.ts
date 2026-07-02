import { MemoryClient, MemoryRecord } from '@aios/memory';
import { CoreLogger } from './logger';
import { ConfigManager } from '@aios/config';
import { IngestionPayload } from '@aios/types';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export type MemoryType = 'preference' | 'note' | 'project' | 'person' | 'document' | 'conversation';

export class MemoryService {
  private client: MemoryClient;
  private config: any;
  private logger: ReturnType<typeof CoreLogger.getInstance>;

  constructor() {
    this.logger = CoreLogger.getInstance();
    this.config = ConfigManager.get('memory') || {};
    this.client = new MemoryClient();
  }

  async init(): Promise<void> {
    this.logger.info('Initializing memory service');
    await this.client.init();
  }

  async addRecord(record: MemoryRecord): Promise<void> {
    this.logger.info('Adding memory record', { type: record.type });
    await this.client.add(record);
  }

  async searchMemory(options: any): Promise<MemoryRecord[]> {
    this.logger.info('Searching memory', options);
    return this.client.search(options);
  }

  async addMany(records: MemoryRecord[]): Promise<void> {
    this.logger.info(`Adding ${records.length} records`);
    await this.client.addMany(records);
  }

  async updateRecord(recordId: string, updates: any): Promise<void> {
    this.logger.info('Updating record', { id: recordId });
    await this.client.update(recordId, updates);
  }

  async deleteRecord(recordId: string): Promise<void> {
    this.logger.info('Deleting record', { id: recordId });
    await this.client.delete(recordId);
  }

  async deleteByPath(path: string): Promise<void> {
    this.logger.info(`Deleting memory records for path: ${path}`);
    await this.client.deleteByMetadata('path', path);
  }

  async getById(recordId: string): Promise<MemoryRecord | null> {
    this.logger.info('Getting record by ID', { id: recordId });
    return this.client.getById(recordId);
  }

  async getStats(): Promise<Record<string, any>> {
    this.logger.info('Getting memory stats');
    return this.client.getStats();
  }

  async clear(): Promise<void> {
    this.logger.info('Clearing memory');
    await this.client.clear();
  }

  async initialize(): Promise<void> {
    await this.init();
  }

  // --- Typed Memory Domain ---

  async saveTypedMemory(type: MemoryType, content: string, metadata: Record<string, any> = {}): Promise<string> {
    const id = uuidv4();
    const record: MemoryRecord = {
      id,
      type,
      content,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.addRecord(record);
    return id;
  }

  async searchTyped(type: MemoryType, query: string, limit: number = 10): Promise<MemoryRecord[]> {
    return this.searchMemory({
      query,
      filter: {
        must: [
          {
            key: 'type',
            match: {
              value: type,
            },
          },
        ],
      },
      limit,
    });
  }

  async savePreference(key: string, value: string): Promise<string> {
    await this.client.deleteByMetadata('key', key);
    return this.saveTypedMemory('preference', value, { key });
  }

  async saveNote(topic: string, text: string): Promise<string> {
    return this.saveTypedMemory('note', text, { topic });
  }

  async saveProjectContext(projectId: string, text: string): Promise<string> {
    return this.saveTypedMemory('project', text, { projectId });
  }

  async savePersonInfo(name: string, info: string): Promise<string> {
    return this.saveTypedMemory('person', info, { name });
  }

  async getGlobalPreferences(): Promise<MemoryRecord[]> {
    return this.searchTyped('preference', 'user preferences', 50);
  }

  // --- Ingestion ---

  async ingest(payload: IngestionPayload): Promise<void> {
    try {
      this.logger.info(`Ingesting payload into memory from source: ${payload.source}`);
      
      const { chunkText } = require('@aios/memory');
      const chunkSize = this.config.chunkSize || 500;
      const chunkOverlap = this.config.chunkOverlap || 50;

      const chunks = chunkText(payload.content, { chunkSize, chunkOverlap });
      this.logger.info(`Split content into ${chunks.length} chunks`);

      // Delete any existing entries for this path to avoid duplicate entries upon re-saves
      const sourcePath = payload.metadata?.path;
      if (sourcePath) {
        await this.deleteByPath(sourcePath);
      }

      const records: MemoryRecord[] = chunks.map((chunk: string, index: number) => {
        // Generate deterministic UUID for each chunk based on source path/identifier
        const sourceId = sourcePath || payload.source;
        const hash = crypto.createHash('sha256')
          .update(`${sourceId}_chunk_${index}`)
          .digest('hex');
        
        // Convert the 32-char sha256 hex into standard 8-4-4-4-12 UUID format
        const id = hash.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12}).*$/, '$1-$2-$3-$4-$5');

        return {
          id,
          type: payload.metadata?.type || 'unknown',
          content: chunk,
          metadata: {
            ...payload.metadata,
            chunkIndex: index,
            totalChunks: chunks.length,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      });

      if (records.length > 0) {
        await this.client.addMany(records);
      }
      this.logger.info(`Successfully ingested ${records.length} chunks into memory database`);
    } catch (error: any) {
      this.logger.error(`Memory ingestion failed: ${error.message}`);
      throw error;
    }
  }
}