import { vi } from 'vitest';

/**
 * In-memory Vector Database Stub.
 */
export const createMockQdrant = (overrides = {}) => {
  return {
    search: vi.fn(async (collectionName, vector, limit = 5) => {
      return [
        { id: 1, score: 0.99, payload: { content: 'mocked memory 1', type: 'text' } },
        { id: 2, score: 0.85, payload: { content: 'mocked memory 2', type: 'text' } }
      ];
    }),
    upsert: vi.fn(async (collectionName, points) => {
      return { status: 'ok', operationId: 12345 };
    }),
    delete: vi.fn(async (collectionName, filter) => {
      return { status: 'ok' };
    }),
    createCollection: vi.fn(async (name) => {
      return true;
    }),
    ...overrides
  };
};
