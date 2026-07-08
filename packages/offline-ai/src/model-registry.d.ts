import { CoreLogger } from '@aios/core';
import { LocalModelDescriptor, LocalModelType, ModelStatus } from '@aios/types';
/**
 * LocalModelRegistry — Local model discovery and lifecycle management
 * for the AIOS Offline Personal Intelligence stack.
 *
 * Scans the models directory for downloaded model files, tracks metadata,
 * manages download progress, and handles model warmup/unload lifecycle.
 */
export declare class LocalModelRegistry {
    private logger;
    private modelsDir;
    private models;
    private loadedModels;
    constructor(logger: CoreLogger, modelsDir?: string);
    /**
     * Scan the models directory for available model files.
     */
    scanModels(): Promise<LocalModelDescriptor[]>;
    /**
     * Get a model descriptor by ID.
     */
    getModel(modelId: string): LocalModelDescriptor | undefined;
    /**
     * Get all registered models.
     */
    getAllModels(): LocalModelDescriptor[];
    /**
     * Get models by type.
     */
    getModelsByType(type: LocalModelType): LocalModelDescriptor[];
    /**
     * Register a model descriptor manually.
     */
    registerModel(model: LocalModelDescriptor): void;
    /**
     * Update a model's status.
     */
    updateModelStatus(modelId: string, status: ModelStatus): void;
    /**
     * Load a model into memory (warmup).
     */
    loadModel(modelId: string): Promise<void>;
    /**
     * Unload a model from memory.
     */
    unloadModel(modelId: string): Promise<void>;
    /**
     * Get currently loaded models and their memory usage.
     */
    getLoadedModels(): Array<{
        model: LocalModelDescriptor;
        estimatedMemoryMb: number;
    }>;
    /**
     * Update download progress for a model.
     */
    updateDownloadProgress(modelId: string, progress: number): void;
    /**
     * Remove a model from the registry and optionally delete its files.
     */
    removeModel(modelId: string, deleteFiles?: boolean): Promise<void>;
    private registerDefaultModels;
}
//# sourceMappingURL=model-registry.d.ts.map