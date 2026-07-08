import { CoreLogger } from '@aios/core';
import { STTRequest, STTResult, TTSRequest, TTSResult, TranscriptChunk, AudioChunk } from '@aios/types';
import { LocalModelRegistry } from './model-registry';
import { EventEmitter } from 'events';
/**
 * WhisperSTT — Local speech-to-text service using Whisper-compatible models.
 *
 * Spawns a local Whisper.cpp binary or ONNX session to perform offline
 * speech recognition. Supports language detection, segment-level timestamps,
 * confidence scores, and real-time streaming chunks.
 */
export declare class WhisperSTT extends EventEmitter {
    private logger;
    private registry;
    private defaultModelId;
    private initialized;
    private whisperBinaryPath;
    constructor(logger: CoreLogger, registry: LocalModelRegistry);
    init(): Promise<void>;
    /**
     * Transcribe a single audio buffer (PCM or WAV).
     */
    transcribe(request: STTRequest): Promise<STTResult>;
    /**
     * Real-time streaming transcription chunks as audio chunks arrive.
     */
    transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncGenerator<TranscriptChunk, void, unknown>;
    isReady(): boolean;
    private generateMockTranscription;
}
/**
 * LocalTTS — Local text-to-speech service using Piper TTS.
 *
 * Generates natural-sounding speech from text using local ONNX voice models.
 * Supports SSML-style rate, pitch, and emotion prosody control.
 */
export declare class LocalTTS {
    private logger;
    private registry;
    private defaultModelId;
    private initialized;
    private piperBinaryPath;
    constructor(logger: CoreLogger, registry: LocalModelRegistry);
    init(): Promise<void>;
    /**
     * Synthesize speech to a full audio buffer (WAV).
     */
    synthesize(request: TTSRequest): Promise<TTSResult>;
    /**
     * Synthesize speech progressively in real-time chunks.
     */
    synthesizeStream(text: string, speed?: number): AsyncGenerator<AudioChunk, void, unknown>;
    getAvailableVoices(): Array<{
        id: string;
        name: string;
        language: string;
    }>;
    isReady(): boolean;
    private addWavHeader;
    private generateMockWav;
}
//# sourceMappingURL=speech-services.d.ts.map