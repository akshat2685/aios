export class AIOSError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConnectorError extends AIOSError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTOR_ERROR', details);
  }
}

export class IngestionError extends AIOSError {
  constructor(message: string, details?: any) {
    super(message, 'INGESTION_ERROR', details);
  }
}

export class EmbeddingError extends AIOSError {
  constructor(message: string, details?: any) {
    super(message, 'EMBEDDING_ERROR', details);
  }
}

export class StorageError extends AIOSError {
  constructor(message: string, details?: any) {
    super(message, 'STORAGE_ERROR', details);
  }
}

export class ValidationError extends AIOSError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}
