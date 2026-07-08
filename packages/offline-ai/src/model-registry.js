"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalModelRegistry = void 0;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * LocalModelRegistry — Local model discovery and lifecycle management
 * for the AIOS Offline Personal Intelligence stack.
 *
 * Scans the models directory for downloaded model files, tracks metadata,
 * manages download progress, and handles model warmup/unload lifecycle.
 */
class LocalModelRegistry {
    logger;
    modelsDir;
    models = new Map();
    loadedModels = new Set();
    constructor(logger, modelsDir) {
        this.logger = logger;
        this.modelsDir = modelsDir || path.join(os.homedir(), '.aios', 'models');
        this.logger.info(`LocalModelRegistry initialized: ${this.modelsDir}`);
    }
    /**
     * Scan the models directory for available model files.
     */
    async scanModels() {
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
    getModel(modelId) {
        return this.models.get(modelId);
    }
    /**
     * Get all registered models.
     */
    getAllModels() {
        return Array.from(this.models.values());
    }
    /**
     * Get models by type.
     */
    getModelsByType(type) {
        return Array.from(this.models.values()).filter(m => m.type === type);
    }
    /**
     * Register a model descriptor manually.
     */
    registerModel(model) {
        this.models.set(model.id, model);
        this.logger.debug(`Registered model: ${model.name} (${model.id})`);
    }
    /**
     * Update a model's status.
     */
    updateModelStatus(modelId, status) {
        const model = this.models.get(modelId);
        if (model) {
            model.status = status;
            if (status === 'loaded') {
                this.loadedModels.add(modelId);
                model.lastUsedAt = Date.now();
            }
            else if (status === 'ready') {
                this.loadedModels.delete(modelId);
            }
            this.logger.debug(`Model ${modelId} status: ${status}`);
        }
    }
    /**
     * Load a model into memory (warmup).
     */
    async loadModel(modelId) {
        const model = this.models.get(modelId);
        if (!model)
            throw new Error(`Model ${modelId} not found`);
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
    async unloadModel(modelId) {
        const model = this.models.get(modelId);
        if (!model)
            return;
        this.logger.info(`Unloading model: ${model.name}`);
        model.status = 'ready';
        this.loadedModels.delete(modelId);
        // Stub: Release ONNX session or free model memory
    }
    /**
     * Get currently loaded models and their memory usage.
     */
    getLoadedModels() {
        return Array.from(this.loadedModels)
            .map(id => this.models.get(id))
            .filter(Boolean)
            .map(model => ({
            model: model,
            estimatedMemoryMb: Math.round(model.fileSize / 1024 / 1024),
        }));
    }
    /**
     * Update download progress for a model.
     */
    updateDownloadProgress(modelId, progress) {
        const model = this.models.get(modelId);
        if (model) {
            model.downloadProgress = Math.min(1.0, Math.max(0, progress));
            model.status = progress >= 1.0 ? 'ready' : 'downloading';
        }
    }
    /**
     * Remove a model from the registry and optionally delete its files.
     */
    async removeModel(modelId, deleteFiles = false) {
        const model = this.models.get(modelId);
        if (!model)
            return;
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
    registerDefaultModels() {
        const defaults = [
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
exports.LocalModelRegistry = LocalModelRegistry;
//# sourceMappingURL=model-registry.js.map