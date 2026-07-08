import { vi } from 'vitest';

/**
 * Deterministic LLM Mock for Testing.
 * Predictable outputs, error simulations, and token tracking.
 */
export const createMockLLM = (overrides = {}) => {
  return {
    complete: vi.fn(async (prompt: string) => {
      if (prompt.includes('error')) throw new Error('Simulated LLM Error');
      return 'Mocked LLM Response for: ' + prompt;
    }),
    chat: vi.fn(async (messages: any[]) => {
      const lastMsg = messages[messages.length - 1]?.content || '';
      if (lastMsg.includes('error')) throw new Error('Simulated LLM Error');
      return {
        message: 'Mocked chat response for: ' + lastMsg,
        done: true
      };
    }),
    generateStream: vi.fn(async function* (prompt: string) {
      yield 'Mocked ';
      yield 'stream ';
      yield 'response.';
    }),
    ...overrides
  };
};
