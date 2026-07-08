import { vi } from 'vitest';

// Define global helpers for running tests
(global as any).testUtils = {
  mockAudioBuffer: (durationMs: number = 1000) => {
    const sampleRate = 16000;
    const samples = (durationMs / 1000) * sampleRate;
    return Buffer.alloc(samples * 2); // 16-bit PCM
  },
  
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Suppress console outputs to keep test runs clean
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
