import { EventEmitter } from 'events';
import { CoreLogger } from '@aios/core';
/**
 * VoiceRecorder — Audio recording interface using native systems.
 *
 * Spawns Windows powershell, sox, or rec commands to record mono PCM 16kHz
 * audio from the default audio interface. Emits audio data events.
 */
export declare class VoiceRecorder extends EventEmitter {
    private logger;
    private recordingProcess;
    private isRecording;
    private sampleRate;
    constructor(logger: CoreLogger, sampleRate?: number);
    /**
     * Start recording audio stream.
     */
    start(): void;
    /**
     * Stop recording audio stream.
     */
    stop(): void;
    private runMockFeed;
}
//# sourceMappingURL=voice-recorder.d.ts.map