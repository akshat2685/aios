import { describe, it, expect, vi } from 'vitest';
import { MemoryStoragePostprocessor } from '../src/storage-postprocessor';
import { EventEmitter } from 'events';

describe('MemoryStoragePostprocessor', () => {
  it('should process chunks, call memoryClient, and emit events', async () => {
    const mockMemoryClient = {
      addMany: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockResolvedValue({ status: 'green' })
    };
    const eventEmitter = new EventEmitter();
    const emitSpy = vi.spyOn(eventEmitter, 'emit');

    const postprocessor = new MemoryStoragePostprocessor(mockMemoryClient as any, eventEmitter);

    const context: any = {
      id: 'doc-123',
      correlationId: 'corr-456',
      metadata: { type: 'document' },
      versionInfo: {
        version: '1',
        checksum: 'abc',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      chunks: [
        { id: 'chunk-1', content: 'test', metadata: {}, vector: [0.1, 0.2] }
      ]
    };

    await postprocessor.process(context);

    expect(mockMemoryClient.addMany).toHaveBeenCalledTimes(1);
    expect(mockMemoryClient.getStats).toHaveBeenCalledTimes(1);
    
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenNthCalledWith(1, 'MemoryStored', expect.objectContaining({
      type: 'MemoryStored',
      correlationId: 'corr-456'
    }));
    expect(emitSpy).toHaveBeenNthCalledWith(2, 'IndexUpdated', expect.objectContaining({
      type: 'IndexUpdated',
      correlationId: 'corr-456'
    }));
  });

  it('should retry if index is not green', async () => {
    const mockMemoryClient = {
      addMany: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn()
        .mockResolvedValueOnce({ status: 'yellow' })
        .mockResolvedValueOnce({ status: 'green' })
    };
    const eventEmitter = new EventEmitter();
    const emitSpy = vi.spyOn(eventEmitter, 'emit');

    const postprocessor = new MemoryStoragePostprocessor(mockMemoryClient as any, eventEmitter);

    const context: any = {
      id: 'doc-123',
      correlationId: 'corr-456',
      metadata: { type: 'document' },
      versionInfo: { version: '1' },
      chunks: [ { id: 'chunk-1', content: 'test', metadata: {} } ]
    };

    await postprocessor.process(context);

    expect(mockMemoryClient.getStats).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledTimes(2);
    
    const indexUpdatedCall = emitSpy.mock.calls[1][1] as any;
    expect(indexUpdatedCall.metrics.retryCount).toBe(1);
  });
  
  it('should skip processing if chunks are empty', async () => {
    const mockMemoryClient = {
      addMany: vi.fn(),
      getStats: vi.fn()
    };
    const eventEmitter = new EventEmitter();
    const emitSpy = vi.spyOn(eventEmitter, 'emit');

    const postprocessor = new MemoryStoragePostprocessor(mockMemoryClient as any, eventEmitter);

    const context: any = {
      id: 'doc-123',
      chunks: []
    };

    await postprocessor.process(context);

    expect(mockMemoryClient.addMany).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
