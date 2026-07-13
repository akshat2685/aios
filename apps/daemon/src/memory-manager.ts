import { ConfigManager } from '@aios/config';
import { CoreLogger } from '@aios/core';
import { MemoryClient, MemoryRecord } from '@aios/memory';

export class MemoryManager {
  private memoryClient: MemoryClient;
  private config: any;
  private logger!: any;

  constructor() {
    this.config = ConfigManager.get('memory');
    this.memoryClient = new MemoryClient();
  }

  async init(): Promise<void> {
    await this.memoryClient.init();
    this.logger.info('Memory manager initialized');
  }

  async addRecord(record: MemoryRecord): Promise<void> {
    await this.memoryClient.add(record);
  }

  async searchMemory(options: any): Promise<MemoryRecord[]> {
    return this.memoryClient.search(options);
  }

  async addMany(records: MemoryRecord[]): Promise<void> {
    await this.memoryClient.addMany(records);
  }

  async updateRecord(recordId: string, updates: any): Promise<void> {
    await this.memoryClient.update(recordId, updates);
  }

  async deleteRecord(recordId: string): Promise<void> {
    await this.memoryClient.delete(recordId);
  }

  async getById(recordId: string): Promise<MemoryRecord | null> {
    return this.memoryClient.getById(recordId);
  }

  async getStats(): Promise<Record<string, any>> {
    return this.memoryClient.getStats();
  }

  async clear(): Promise<void> {
    await this.memoryClient.clear();
  }

  private initLogger() {
    this.logger = CoreLogger.getInstance();
  }

  async start(): Promise<void> {
    this.initLogger();
    await this.init();
  }
}