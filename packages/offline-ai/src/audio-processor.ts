import { CoreLogger } from '@aios/core';

/**
 * AudioProcessor — Local audio noise filtering and voice activity detection (VAD).
 *
 * Implements RMS-energy frame tracking to filter out background noise,
 * trigger speech start/stop boundaries, and trim silence edges.
 */
export class AudioProcessor {
  private logger: CoreLogger;
  private sampleRate: number;
  private frameDurationMs: number = 10; // 10ms frame size
  private bytesPerSample: number = 2; // 16-bit
  private frameSize: number;
  private thresholdRms: number = 0.02; // Energy threshold for speech detection
  private silenceHangoverFrames: number = 20; // 200ms of silence allowed before stopping
  private speechStreakFrames: number = 5; // 50ms of speech required to trigger

  constructor(logger: CoreLogger, sampleRate: number = 16000) {
    this.logger = logger;
    this.sampleRate = sampleRate;
    this.frameSize = Math.floor((this.sampleRate * this.frameDurationMs) / 1000) * this.bytesPerSample;
    this.logger.info(`AudioProcessor initialized: frameSize=${this.frameSize} bytes`);
  }

  /**
   * Set speech detection threshold sensitivity (0.0 to 1.0).
   */
  public setSensitivity(level: number): void {
    // Mapping: 0.0 is very sensitive (low threshold), 1.0 is very quiet (high threshold)
    this.thresholdRms = 0.005 + (1 - level) * 0.05;
    this.logger.info(`VAD Sensitivity threshold updated: rms=${this.thresholdRms}`);
  }

  /**
   * Simple spectral noise gate: Suppress low energy frames by zeroing them.
   */
  public suppressNoise(buffer: Buffer): Buffer {
    const result = Buffer.alloc(buffer.length);
    buffer.copy(result);

    for (let offset = 0; offset < result.length; offset += this.frameSize) {
      const length = Math.min(this.frameSize, result.length - offset);
      const rms = this.calculateRms(result, offset, length);

      if (rms < this.thresholdRms) {
        // Zero out silence/noise frames
        result.fill(0, offset, offset + length);
      }
    }
    return result;
  }

  /**
   * Voice Activity Detection (VAD) streaming parser.
   * Processes a stream of audio buffers and yields speech activity flags.
   */
  public async *detectActivity(audioStream: AsyncIterable<Buffer>): AsyncGenerator<boolean, void, unknown> {
    let silenceStreak = 0;
    let speechStreak = 0;
    let isSpeaking = false;

    let remainder = Buffer.alloc(0);

    for await (const chunk of audioStream) {
      const combined = Buffer.concat([remainder, chunk]);
      let offset = 0;

      while (offset + this.frameSize <= combined.length) {
        const rms = this.calculateRms(combined, offset, this.frameSize);
        const speechDetected = rms >= this.thresholdRms;

        if (speechDetected) {
          speechStreak++;
          silenceStreak = 0;
        } else {
          silenceStreak++;
          speechStreak = 0;
        }

        if (!isSpeaking && speechStreak >= this.speechStreakFrames) {
          isSpeaking = true;
          this.logger.info('VAD: Speech start detected');
        } else if (isSpeaking && silenceStreak >= this.silenceHangoverFrames) {
          isSpeaking = false;
          this.logger.info('VAD: Speech end detected');
        }

        yield isSpeaking;
        offset += this.frameSize;
      }

      remainder = combined.slice(offset);
    }
  }

  /**
   * Helper to trim trailing silence from PCM audio buffer.
   */
  public trimSilence(audioBuffer: Buffer): Buffer {
    let startOffset = 0;
    let endOffset = audioBuffer.length;

    // Find start offset (first frame above threshold)
    for (let offset = 0; offset < audioBuffer.length; offset += this.frameSize) {
      const length = Math.min(this.frameSize, audioBuffer.length - offset);
      if (this.calculateRms(audioBuffer, offset, length) >= this.thresholdRms) {
        startOffset = offset;
        break;
      }
    }

    // Find end offset (last frame above threshold)
    for (let offset = audioBuffer.length - this.frameSize; offset >= 0; offset -= this.frameSize) {
      const length = Math.min(this.frameSize, audioBuffer.length - offset);
      if (this.calculateRms(audioBuffer, offset, length) >= this.thresholdRms) {
        endOffset = offset + length;
        break;
      }
    }

    if (startOffset >= endOffset) {
      return Buffer.alloc(0);
    }

    return audioBuffer.slice(startOffset, endOffset);
  }

  private calculateRms(buffer: Buffer, offset: number, length: number): number {
    let sumSquares = 0;
    const count = length / 2; // 16-bit samples

    for (let i = 0; i < length; i += 2) {
      if (offset + i + 1 >= buffer.length) break;
      const sample = buffer.readInt16LE(offset + i) / 32768.0;
      sumSquares += sample * sample;
    }

    return count > 0 ? Math.sqrt(sumSquares / count) : 0;
  }
}
