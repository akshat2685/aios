import { CoreLogger } from '@aios/core';
import { LocalModelDescriptor, LocalModelType, ModelStatus } from '@aios/types';
import * as path from 'path';
import * as os from 'os';

/**
 * LocalModelRegistry — Local model discovery and lifecycle management
 * for the AIOS Offline Personal Intelligence stack.
 *
 * Scans the models directory for downloaded model files, tracks metadata,
 * manages download progress, and handles model warmup/unload lifecycle.
 */
export class LocalModelRegistry {
  private logger: CoreLogger;
  private modelsDir: string;
  private models: Map<string, LocalModelDescriptor> = new Map();
  private loadedModels: Set<string> = new Set();

  constructor(logger: CoreLogger, modelsDir?: string) {
    this.logger = logger;
    this.modelsDir = modelsDir || path.join(os.homedir(), '.aios', 'models');
    this.logger.info(`LocalModelRegistry initialized: ${this.modelsDir}`);
  }

  /**
   * Scan the models directory for available model files.
   */
  public async scanModels(): Promise<LocalModelDescriptor[]> {
    this.logger.info(`Scanning models directory: ${this.modelsDir}`);

    // Stub: In production, this would:
    // 1. Recursively scan this.modelsDir for model files
    // 2. Detect format from extension (.onnx, .gguf, .safetensors)
    // 3. Read model metadata (config.json, tokenizer.json, etc.)
    // 4. Register each discovered model

    // Register default model stubs for the 5 capabilities
    this.registerDefaultModels();

    const models = Array.from(this.models.values());
    this.logger.info(`Found ${models.length} models`);
    return models;
  }

  /**
   * Get a model descriptor by ID.
   */
  public getModel(modelId: string): LocalModelDescriptor | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all registered models.
   */
  public getAllModels(): LocalModelDescriptor[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models by type.
   */
  public getModelsByType(type: LocalModelType): LocalModelDescriptor[] {
    return Array.from(this.models.values()).filter(m => m.type === type);
  }

  /**
   * Register a model descriptor manually.
   */
  public registerModel(model: LocalModelDescriptor): void {
    this.models.set(model.id, model);
    this.logger.debug(`Registered model: ${model.name} (${model.id})`);
  }

  /**
   * Update a model's status.
   */
  public updateModelStatus(modelId: string, status: ModelStatus): void {
    const model = this.models.get(modelId);
    if (model) {
      model.status = status;
      if (status === 'loaded') {
        this.loadedModels.add(modelId);
        model.lastUsedAt = Date.now();
      } else if (status === 'ready') {
        this.loadedModels.delete(modelId);
      }
      this.logger.debug(`Model ${modelId} status: ${status}`);
    }
  }

  /**
   * Load a model into memory (warmup).
   */
  public async loadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);

    if (model.status === 'loaded') {
      this.logger.debug(`Model ${modelId} already loaded`);
      return;
    }

    this.logger.info(`Loading model: ${model.name}`);
    model.status = 'loaded';
    model.lastUsedAt = Date.now();
    this.loadedModels.add(modelId);

    // Stub: In production, this would initialize the ONNX runtime session
    // or load the GGUF model into memory
  }

  /**
   * Unload a model from memory.
   */
  public async unloadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    this.logger.info(`Unloading model: ${model.name}`);
    model.status = 'ready';
    this.loadedModels.delete(modelId);

    // Stub: Release ONNX session or free model memory
  }

  /**
   * Get currently loaded models and their memory usage.
   */
  public getLoadedModels(): Array<{ model: LocalModelDescriptor; estimatedMemoryMb: number }> {
    return Array.from(this.loadedModels)
      .map(id => this.models.get(id))
      .filter(Boolean)
      .map(model => ({
        model: model!,
        estimatedMemoryMb: Math.round(model!.fileSize / 1024 / 1024),
      }));
  }

  /**
   * Update download progress for a model.
   */
  public updateDownloadProgress(modelId: string, progress: number): void {
    const model = this.models.get(modelId);
    if (model) {
      model.downloadProgress = Math.min(1.0, Math.max(0, progress));
      model.status = progress >= 1.0 ? 'ready' : 'downloading';
    }
  }

  /**
   * Remove a model from the registry and optionally delete its files.
   */
  public async removeModel(modelId: string, deleteFiles: boolean = false): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    if (this.loadedModels.has(modelId)) {
      await this.unloadModel(modelId);
    }

    if (deleteFiles) {
      // Stub: Delete the model files from disk
      this.logger.info(`Deleting model files: ${model.filePath}`);
    }

    this.models.delete(modelId);
    this.logger.info(`Removed model: ${model.name}`);
  }

  // ─── Private ───────────────────────────────────────────────

  private registerDefaultModels(): void {
    const defaults: LocalModelDescriptor[] = [
      {
        id: 'all-minilm-l6-v2',
        name: 'all-MiniLM-L6-v2',
        type: 'embedding',
        filePath: 'embeddings/all-MiniLM-L6-v2.onnx',
        fileSize: 90_000_000,
        quantization: 'f32',
        format: 'onnx',
        status: 'not_downloaded',
        downloadProgress: 0,
        metadata: { dimensions: 384, maxTokens: 256 },
      },
      {
        id: 'whisper-base-en',
        name: 'Whisper Base (English)',
        type: 'stt',
        filePath: 'stt/whisper-base-en.onnx',
        fileSize: 142_000_000,
        format: 'onnx',
        status: 'not_downloaded',
        downloadProgress: 0,
        metadata: { language: 'en', sampleRate: 16000 },
      },
      {
        id: 'piper-en-amy',
        name: 'Piper TTS (Amy)',
        type: 'tts',
        filePath: 'tts/en-amy-medium.onnx',
        fileSize: 63_000_000,
        format: 'onnx',
        status: 'not_downloaded',
        downloadProgress: 0,
        metadata: { voice: 'amy', language: 'en' },
      },
      {
        id: 'tesseract-eng',
        name: 'Tesseract OCR (English)',
        type: 'ocr',
        filePath: 'ocr/tesseract-eng.traineddata',
        fileSize: 12_000_000,
        format: 'onnx',
        status: 'not_downloaded',
        downloadProgress: 0,
        metadata: { language: 'eng' },
      },
      {
        id: 'moondream-v2',
        name: 'Moondream v2 (Vision)',
        type: 'vision',
        filePath: 'vision/moondream-v2.gguf',
        fileSize: 1_700_000_000,
        quantization: 'q4_0',
        format: 'gguf',
        status: 'not_downloaded',
        downloadProgress: 0,
        metadata: { maxResolution: '1024x1024' },
      },
    ];

    for (const model of defaults) {
      if (!this.models.has(model.id)) {
        this.models.set(model.id, model);
      }
    }
  }
}
