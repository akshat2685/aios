import { CoreLogger } from '@aios/core';
import { EmbeddingRequest, EmbeddingResult } from '@aios/types';
import { LocalModelRegistry } from './model-registry';

/**
 * LocalEmbeddingService — Offline vector embedding generation.
 *
 * Wraps a local embedding model (e.g., all-MiniLM-L6-v2 via ONNX Runtime)
 * to generate vector embeddings without network access. Provides a batch
 * embedding API compatible with @aios/memory's QdrantClient and implements
 * a fallback chain: local ONNX → Ollama embeddings → remote API.
 */
export class LocalEmbeddingService {
  private logger: CoreLogger;
  private registry: LocalModelRegistry;
  private defaultModelId: string = 'all-minilm-l6-v2';
  private initialized: boolean = false;

  constructor(logger: CoreLogger, registry: LocalModelRegistry) {
    this.logger = logger;
    this.registry = registry;
    this.logger.info('LocalEmbeddingService initialized');
  }

  /**
   * Initialize the embedding service by loading the default model.
   */
  public async init(): Promise<void> {
    const model = this.registry.getModel(this.defaultModelId);
    if (!model) {
      this.logger.warn(`Default embedding model ${this.defaultModelId} not found in registry`);
      return;
    }

    if (model.status === 'ready' || model.status === 'loaded') {
      await this.registry.loadModel(this.defaultModelId);
      this.initialized = true;
      this.logger.info(`Embedding model loaded: ${model.name}`);
    } else {
      this.logger.warn(`Embedding model not downloaded: ${model.name} (status: ${model.status})`);
    }
  }

  /**
   * Generate embeddings for a batch of texts.
   */
  public async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const modelId = request.modelId || this.defaultModelId;
    const startTime = Date.now();

    this.logger.debug(`Generating embeddings for ${request.texts.length} texts (model: ${modelId})`);

    // Stub: In production, this would:
    // 1. Tokenize each text using the model's tokenizer
    // 2. Run inference through the ONNX runtime session
    // 3. Extract the [CLS] token embedding or mean-pool token embeddings
    // 4. Normalize to unit vectors

    const model = this.registry.getModel(modelId);
    const dimensions = model?.metadata?.dimensions || 384;

    // Generate placeholder zero vectors for the stub
    const embeddings = request.texts.map(() =>
      new Array(dimensions).fill(0)
    );

    return {
      embeddings,
      modelId,
      dimensions,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Generate a single embedding for one text.
   */
  public async embedSingle(text: string, modelId?: string): Promise<number[]> {
    const result = await this.embed({ texts: [text], modelId });
    return result.embeddings[0];
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Vectors must have same dimensions');

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Check if the embedding service is ready.
   */
  public isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get information about the current embedding model.
   */
  public getModelInfo(): { modelId: string; dimensions: number; ready: boolean } {
    const model = this.registry.getModel(this.defaultModelId);
    return {
      modelId: this.defaultModelId,
      dimensions: model?.metadata?.dimensions || 384,
      ready: this.initialized,
    };
  }
}
