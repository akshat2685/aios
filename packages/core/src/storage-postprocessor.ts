import { IDocumentContext, IPostprocessor, IMemoryClient, MemoryStoredEvent, IndexUpdatedEvent } from '@aios/types';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class MemoryStoragePostprocessor implements IPostprocessor {
  public name = 'MemoryStoragePostprocessor';
  
  constructor(private memoryClient: IMemoryClient, private eventEmitter: EventEmitter) {}

  async process(context: IDocumentContext): Promise<void> {
    if (!context.chunks || context.chunks.length === 0) {
      return;
    }

    const records = context.chunks.map(chunk => ({
      id: chunk.id,
      type: context.metadata.type || 'document',
      content: chunk.content,
      metadata: {
        ...context.metadata,
        ...chunk.metadata,
        documentId: context.id,
        version: context.versionInfo.version,
        checksum: context.versionInfo.checksum,
      },
      createdAt: context.versionInfo.createdAt,
      updatedAt: context.versionInfo.updatedAt,
      vector: chunk.vector
    }));

    const storageStartTime = Date.now();
    let storageErrorCount = 0;
    try {
      await this.memoryClient.addMany(records);
    } catch (e) {
      storageErrorCount++;
      throw e;
    }
    const storageDurationMs = Date.now() - storageStartTime;
    const recordIds = records.map(r => r.id);

    // Emit Storage Event
    this.eventEmitter.emit('MemoryStored', {
      id: uuidv4(),
      type: 'MemoryStored',
      timestamp: Date.now(),
      correlationId: context.correlationId,
      payload: {
        documentId: context.id,
        recordIds,
        collection: 'aios_memory'
      },
      metrics: {
        durationMs: storageDurationMs,
        errorCount: storageErrorCount,
        retryCount: 0
      }
    } as MemoryStoredEvent);

    // Real logic for Index Updated Event
    const indexStartTime = Date.now();
    let indexErrorCount = 0;
    let retryCount = 0;
    try {
      let stats = await this.memoryClient.getStats();
      // Poll until the index status is 'green' (or equivalent 'ok' state)
      while (stats && stats.status !== 'green' && stats.status !== 'unreachable' && retryCount < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        stats = await this.memoryClient.getStats();
        retryCount++;
      }
    } catch (e) {
      indexErrorCount++;
    }
    const indexDurationMs = Date.now() - indexStartTime;

    this.eventEmitter.emit('IndexUpdated', {
      id: uuidv4(),
      type: 'IndexUpdated',
      timestamp: Date.now(),
      correlationId: context.correlationId,
      payload: {
        documentId: context.id,
        recordIds
      },
      metrics: {
        durationMs: indexDurationMs,
        errorCount: indexErrorCount,
        retryCount
      }
    } as IndexUpdatedEvent);
  }
}
