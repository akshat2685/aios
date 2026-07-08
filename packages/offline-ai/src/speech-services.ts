import { CoreLogger } from '@aios/core';
import { STTRequest, STTResult, TTSRequest, TTSResult } from '@aios/types';
import { LocalModelRegistry } from './model-registry';

/**
 * WhisperSTT — Local speech-to-text service using Whisper-compatible models.
 *
 * Wraps a local Whisper ONNX model or whisper.cpp binary for offline
 * speech recognition. Supports language detection, segment-level timestamps,
 * and confidence scores.
 */
export class WhisperSTT {
  private logger: CoreLogger;
  private registry: LocalModelRegistry;
  private defaultModelId: string = 'whisper-base-en';
  private initialized: boolean = false;

  constructor(logger: CoreLogger, registry: LocalModelRegistry) {
    this.logger = logger;
    this.registry = registry;
    this.logger.info('WhisperSTT initialized');
  }

  /**
   * Initialize the STT service by loading the Whisper model.
   */
  public async init(): Promise<void> {
    const model = this.registry.getModel(this.defaultModelId);
    if (model && (model.status === 'ready' || model.status === 'loaded')) {
      await this.registry.loadModel(this.defaultModelId);
      this.initialized = true;
      this.logger.info(`Whisper model loaded: ${model.name}`);
    } else {
      this.logger.warn('Whisper model not available for loading');
    }
  }

  /**
   * Transcribe audio to text.
   */
  public async transcribe(request: STTRequest): Promise<STTResult> {
    const modelId = request.modelId || this.defaultModelId;
    const startTime = Date.now();

    this.logger.info(`Transcribing audio (${request.audioBuffer.length} bytes, model: ${modelId})`);

    // Stub: In production, this would:
    // 1. Convert audio buffer to the required format (16kHz mono PCM)
    // 2. Run Whisper inference (via ONNX or whisper.cpp)
    // 3. Extract text, segments with timestamps, and confidence

    return {
      text: '',
      language: request.language || 'en',
      confidence: 0,
      segments: [],
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Check if the STT service is ready.
   */
  public isReady(): boolean {
    return this.initialized;
  }
}

/**
 * LocalTTS — Local text-to-speech service using Piper TTS or similar.
 *
 * Generates speech audio from text using a locally-running TTS model.
 * Supports multiple voices and speed control.
 */
export class LocalTTS {
  private logger: CoreLogger;
  private registry: LocalModelRegistry;
  private defaultModelId: string = 'piper-en-amy';
  private initialized: boolean = false;

  constructor(logger: CoreLogger, registry: LocalModelRegistry) {
    this.logger = logger;
    this.registry = registry;
    this.logger.info('LocalTTS initialized');
  }

  /**
   * Initialize the TTS service by loading the voice model.
   */
  public async init(): Promise<void> {
    const model = this.registry.getModel(this.defaultModelId);
    if (model && (model.status === 'ready' || model.status === 'loaded')) {
      await this.registry.loadModel(this.defaultModelId);
      this.initialized = true;
      this.logger.info(`TTS model loaded: ${model.name}`);
    } else {
      this.logger.warn('TTS model not available for loading');
    }
  }

  /**
   * Synthesize speech from text.
   */
  public async synthesize(request: TTSRequest): Promise<TTSResult> {
    const modelId = request.modelId || this.defaultModelId;
    const startTime = Date.now();

    this.logger.info(`Synthesizing speech: "${request.text.substring(0, 50)}..." (model: ${modelId})`);

    // Stub: In production, this would:
    // 1. Tokenize/phonemize the input text
    // 2. Run the TTS model inference (Piper ONNX)
    // 3. Apply speed adjustment if requested
    // 4. Return WAV audio buffer

    return {
      audioBuffer: Buffer.alloc(0),
      sampleRate: 22050,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * List available voices.
   */
  public getAvailableVoices(): Array<{ id: string; name: string; language: string }> {
    return this.registry
      .getModelsByType('tts')
      .map(m => ({
        id: m.id,
        name: m.name,
        language: m.metadata?.language || 'en',
      }));
  }

  /**
   * Check if the TTS service is ready.
   */
  public isReady(): boolean {
    return this.initialized;
  }
}
