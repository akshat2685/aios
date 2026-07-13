export interface AIOSDomainEvent {
  id: string;
  type: string;
  timestamp: number;
  correlationId: string;
}

export interface DocumentVersionInfo {
  version: number;
  createdAt: number;
  updatedAt: number;
  checksum: string;
  sourceConnector: string;
}

export interface ObservabilityMetrics {
  durationMs: number;
  memoryUsageBytes?: number;
  latencyMs?: number;
  errorCount: number;
  retryCount: number;
  documentSizeBytes?: number;
}

export interface DocumentReceivedEvent extends AIOSDomainEvent {
  type: 'DocumentReceived';
  payload: {
    source: string;
    content: string;
    metadata: Record<string, any>;
    versionInfo: DocumentVersionInfo;
  };
  metrics: ObservabilityMetrics;
}

export interface DocumentNormalizedEvent extends AIOSDomainEvent {
  type: 'DocumentNormalized';
  payload: {
    documentId: string;
    normalizedContent: string;
    language: string;
    extractedMetadata: Record<string, any>;
  };
  metrics: ObservabilityMetrics;
}

export interface ChunksCreatedEvent extends AIOSDomainEvent {
  type: 'ChunksCreated';
  payload: {
    documentId: string;
    chunks: { id: string; content: string; sequence: number }[];
  };
  metrics: ObservabilityMetrics;
}

export interface EmbeddingCreatedEvent extends AIOSDomainEvent {
  type: 'EmbeddingCreated';
  payload: {
    documentId: string;
    chunkIds: string[];
    // We do not pass actual embeddings in the event to save memory
  };
  metrics: ObservabilityMetrics;
}

export interface MemoryStoredEvent extends AIOSDomainEvent {
  type: 'MemoryStored';
  payload: {
    documentId: string;
    recordIds: string[];
    collection: string;
  };
  metrics: ObservabilityMetrics;
}

export interface IndexUpdatedEvent extends AIOSDomainEvent {
  type: 'IndexUpdated';
  payload: {
    documentId: string;
    recordIds: string[];
  };
  metrics: ObservabilityMetrics;
}

export type IngestionEvent = 
  | DocumentReceivedEvent
  | DocumentNormalizedEvent
  | ChunksCreatedEvent
  | EmbeddingCreatedEvent
  | MemoryStoredEvent
  | IndexUpdatedEvent;
