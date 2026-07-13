import { DocumentVersionInfo, ObservabilityMetrics } from './events';

export interface IDocumentContext {
  id: string;
  correlationId: string;
  source: string;
  rawContent: string;
  normalizedContent?: string;
  language?: string;
  metadata: Record<string, any>;
  versionInfo: DocumentVersionInfo;
  chunks?: IChunk[];
  metrics: Partial<ObservabilityMetrics>;
  abortSignal: AbortSignal;
}

export interface IChunk {
  id: string;
  sequence: number;
  content: string;
  vector?: number[];
  metadata: Record<string, any>;
}

export interface IPreprocessor {
  name: string;
  process(context: IDocumentContext): Promise<void>;
}

export interface IChunker {
  name: string;
  chunk(context: IDocumentContext): Promise<void>;
}

export interface IEmbeddingProvider {
  name: string;
  embed(context: IDocumentContext): Promise<void>;
}

export interface IPostprocessor {
  name: string;
  process(context: IDocumentContext): Promise<void>;
}

export interface IDocumentPipeline {
  addPreprocessor(preprocessor: IPreprocessor): void;
  setChunker(chunker: IChunker): void;
  setEmbeddingProvider(provider: IEmbeddingProvider): void;
  addPostprocessor(postprocessor: IPostprocessor): void;
  
  process(context: IDocumentContext): Promise<void>;
}

export interface IDocumentIngester {
  ingest(source: string, content: string, metadata: Record<string, any>, signal?: AbortSignal): Promise<string>;
}

export interface IMemoryClient {
  init(): Promise<void>;
  add(record: any): Promise<void>;
  addMany(records: any[]): Promise<void>;
  update(recordId: string, updates: any): Promise<void>;
  delete(recordId: string): Promise<void>;
  deleteByMetadata(key: string, value: any): Promise<void>;
  getById(recordId: string): Promise<any>;
  search(options: any): Promise<any[]>;
  clear(): Promise<void>;
  getStats(): Promise<Record<string, any>>;
}
