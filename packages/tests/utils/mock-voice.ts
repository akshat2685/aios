import { vi } from 'vitest';

/**
 * Synthetic PCM audio and speech mocks for Voice Tests.
 */
export const createMockAudioStream = async function* () {
  yield Buffer.alloc(3200); // chunk 1
  yield Buffer.alloc(3200); // chunk 2
};

export const createMockSTT = (overrides = {}) => {
  return {
    initialize: vi.fn(async () => {}),
    transcribeStream: vi.fn(async function* (stream) {
      yield {
        text: "Mocked transcription chunk",
        isFinal: true,
        confidence: 0.95,
        language: "en",
        timestamp: new Date(),
        startTime: 0,
        endTime: 1000
      };
    }),
    transcribe: vi.fn(async (buffer) => ({
      text: "Mocked full transcription",
      confidence: 0.99,
      language: "en"
    })),
    ...overrides
  };
};

export const createMockTTS = (overrides = {}) => {
  return {
    initialize: vi.fn(async () => {}),
    synthesizeStream: vi.fn(async function* (text) {
      yield {
        data: Buffer.alloc(1024),
        timestamp: new Date(),
        isComplete: true
      };
    }),
    synthesize: vi.fn(async (text) => Buffer.alloc(4096)),
    ...overrides
  };
};
