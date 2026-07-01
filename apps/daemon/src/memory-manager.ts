import { ConfigManager } from '@aios/config';
import { MemoryService, CoreLogger } from '@aios/core';
import { MemoryRecord } from '@aios/memory';

export class MemoryManager {
  private memoryService: MemoryService;
  private config: any;
  private logger!: any;

  constructor() {
    this.config = ConfigManager.get('memory');
    this.memoryService = new MemoryService();
  }

  async init(): Promise<void> {
    await this.memoryService.init();
    this.logger.info('Memory manager initialized');
  }

  async addRecord(record: MemoryRecord): Promise<void> {
    await this.memoryService.addRecord(record);
  }

  async searchMemory(options: any): Promise<MemoryRecord[]> {
    return this.memoryService.searchMemory(options);
  }

  async addMany(records: MemoryRecord[]): Promise<void> {
    await this.memoryService.addMany(records);
  }

  async updateRecord(recordId: string, updates: any): Promise<void> {
    await this.memoryService.updateRecord(recordId, updates);
  }

  async deleteRecord(recordId: string): Promise<void> {
    await this.memoryService.deleteRecord(recordId);
  }

  async getById(recordId: string): Promise<MemoryRecord | null> {
    return this.memoryService.getById(recordId);
  }

  async getStats(): Promise<Record<string, any>> {
    return this.memoryService.getStats();
  }

  async clear(): Promise<void> {
    await this.memoryService.clear();
  }

  private initLogger() {
    this.logger = CoreLogger.getInstance();
  }

  async start(): Promise<void> {
    this.initLogger();
    await this.init();
  }
}