import { EventEmitter } from 'events';
import { 
  IDocumentContext, 
  IPreprocessor, 
  IChunker, 
  IEmbeddingProvider, 
  IPostprocessor, 
  IDocumentPipeline,
  IDocumentIngester,
  IMemoryClient,
  IngestionError,
  DocumentReceivedEvent,
  DocumentNormalizedEvent,
  ChunksCreatedEvent,
  MemoryStoredEvent
} from '@aios/types';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { performance } from 'perf_hooks';

export class DocumentPipeline extends EventEmitter implements IDocumentPipeline, IDocumentIngester {
  private preprocessors: IPreprocessor[] = [];
  private chunker?: IChunker;
  private embeddingProvider?: IEmbeddingProvider;
  private postprocessors: IPostprocessor[] = [];
  private memoryClient: IMemoryClient;

  constructor(memoryClient: IMemoryClient) {
    super();
    this.memoryClient = memoryClient;
  }

  addPreprocessor(preprocessor: IPreprocessor): void {
    this.preprocessors.push(preprocessor);
  }

  setChunker(chunker: IChunker): void {
    this.chunker = chunker;
  }

  setEmbeddingProvider(provider: IEmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  addPostprocessor(postprocessor: IPostprocessor): void {
    this.postprocessors.push(postprocessor);
  }

  async ingest(source: string, content: string, metadata: Record<string, any>, signal?: AbortSignal): Promise<string> {
    const docId = uuidv4();
    const correlationId = uuidv4();
    const startTime = performance.now();

    const context: IDocumentContext = {
      id: docId,
      correlationId,
      source,
      rawContent: content,
      metadata,
      versionInfo: {
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        checksum: crypto.createHash('sha256').update(content).digest('hex'),
        sourceConnector: source
      },
      metrics: {
        errorCount: 0,
        retryCount: 0,
        documentSizeBytes: Buffer.byteLength(content, 'utf8')
      },
      abortSignal: signal || new AbortController().signal
    };

    try {
      // 1. Document Received Event
      this.emitEvent<DocumentReceivedEvent>('DocumentReceived', {
        id: uuidv4(),
        type: 'DocumentReceived',
        timestamp: Date.now(),
        correlationId,
        payload: { source, content, metadata, versionInfo: context.versionInfo },
        metrics: this.finalizeMetrics(context, startTime)
      });

      // Execute pipeline
      await this.process(context);
      return docId;
    } catch (err: any) {
      context.metrics.errorCount = (context.metrics.errorCount || 0) + 1;
      throw new IngestionError(`Pipeline failed for ${source}: ${err.message}`, err);
    }
  }

  async process(context: IDocumentContext): Promise<void> {
    const startTime = performance.now();
    this.checkAbort(context);

    // 2. Preprocessing (Normalization, Deduplication, etc.)
    for (const preprocessor of this.preprocessors) {
      this.checkAbort(context);
      await preprocessor.process(context);
    }
    
    context.normalizedContent = context.normalizedContent || context.rawContent;

    this.emitEvent<DocumentNormalizedEvent>('DocumentNormalized', {
      id: uuidv4(),
      type: 'DocumentNormalized',
      timestamp: Date.now(),
      correlationId: context.correlationId,
      payload: {
        documentId: context.id,
        normalizedContent: context.normalizedContent,
        language: context.language || 'unknown',
        extractedMetadata: context.metadata
      },
      metrics: this.finalizeMetrics(context, startTime)
    });

    // 3. Chunking
    this.checkAbort(context);
    if (this.chunker) {
      await this.chunker.chunk(context);
    } else {
      // Default fallback
      context.chunks = [{ id: uuidv4(), sequence: 0, content: context.normalizedContent, metadata: context.metadata }];
    }

    this.emitEvent<ChunksCreatedEvent>('ChunksCreated', {
      id: uuidv4(),
      type: 'ChunksCreated',
      timestamp: Date.now(),
      correlationId: context.correlationId,
      payload: {
        documentId: context.id,
        chunks: context.chunks!
      },
      metrics: this.finalizeMetrics(context, startTime)
    });

    // 4. Embedding
    this.checkAbort(context);
    if (this.embeddingProvider) {
      await this.embeddingProvider.embed(context);
    }

    // 5. Postprocessing (e.g. Memory Storage & Indexing)
    this.checkAbort(context);
    for (const postprocessor of this.postprocessors) {
      this.checkAbort(context);
      await postprocessor.process(context);
    }
  }

  private checkAbort(context: IDocumentContext) {
    if (context.abortSignal.aborted) {
      throw new IngestionError('Ingestion pipeline aborted', { correlationId: context.correlationId });
    }
  }

  private emitEvent<T>(eventName: string, eventData: T) {
    this.emit(eventName, eventData);
  }

  private finalizeMetrics(context: IDocumentContext, startTime: number) {
    return {
      durationMs: performance.now() - startTime,
      documentSizeBytes: context.metrics.documentSizeBytes || 0,
      errorCount: context.metrics.errorCount || 0,
      retryCount: context.metrics.retryCount || 0
    };
  }
}
