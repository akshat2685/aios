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
      // Pass vector directly if it exists, Qdrant memory client might accept it or need it in a specific format
      // In qdrant-client.ts addMany, it fetches embedding if it doesn't exist. If we pass vector, we'll need to adapt it.
      vector: chunk.vector
    }));

    await this.memoryClient.addMany(records);

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
        durationMs: 0,
        errorCount: 0,
        retryCount: 0
      }
    } as MemoryStoredEvent);

    // Emit Index Event (simulated)
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
        durationMs: 0,
        errorCount: 0,
        retryCount: 0
      }
    } as IndexUpdatedEvent);
  }
}
