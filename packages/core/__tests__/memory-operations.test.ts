import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryOperations } from '../src/memory-operations';
import { IMemoryClient } from '@aios/types';

describe('MemoryOperations', () => {
  let mockClient: IMemoryClient;
  let memoryOps: MemoryOperations;

  beforeEach(() => {
    mockClient = {
      add: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      deleteByMetadata: vi.fn().mockResolvedValue(undefined),
    } as unknown as IMemoryClient;

    memoryOps = new MemoryOperations(mockClient);
    
    // Mock Date.now to have consistent timestamps in tests if needed
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('saveTypedMemory', () => {
    it('should generate a uuid and call client.add with the correct record format', async () => {
      const id = await memoryOps.saveTypedMemory('note', 'Test note', { key: 'value' });
      
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      
      expect(mockClient.add).toHaveBeenCalledTimes(1);
      const args = vi.mocked(mockClient.add).mock.calls[0][0];
      
      expect(args.id).toBe(id);
      expect(args.type).toBe('note');
      expect(args.content).toBe('Test note');
      expect(args.metadata).toEqual({ key: 'value' });
      expect(args.createdAt).toBe(Date.now());
      expect(args.updatedAt).toBe(Date.now());
    });

    it('should use empty metadata by default', async () => {
      await memoryOps.saveTypedMemory('preference', 'Pref value');
      const args = vi.mocked(mockClient.add).mock.calls[0][0];
      expect(args.metadata).toEqual({});
    });
  });

  describe('searchTyped', () => {
    it('should construct the correct search query and limit', async () => {
      vi.mocked(mockClient.search).mockResolvedValue([{ id: '123' }]);
      
      const results = await memoryOps.searchTyped('person', 'Alice', 5);
      
      expect(mockClient.search).toHaveBeenCalledWith({
        query: 'Alice',
        filter: {
          must: [{ key: 'type', match: { value: 'person' } }]
        },
        limit: 5
      });
      expect(results).toEqual([{ id: '123' }]);
    });

    it('should use default limit 10', async () => {
      await memoryOps.searchTyped('note', 'Test search');
      expect(mockClient.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    });
  });

  describe('savePreference', () => {
    it('should delete existing preference and save new one', async () => {
      const id = await memoryOps.savePreference('theme', 'dark');
      
      expect(mockClient.deleteByMetadata).toHaveBeenCalledWith('key', 'theme');
      expect(mockClient.add).toHaveBeenCalledTimes(1);
      
      const args = vi.mocked(mockClient.add).mock.calls[0][0];
      expect(args.id).toBe(id);
      expect(args.type).toBe('preference');
      expect(args.content).toBe('dark');
      expect(args.metadata).toEqual({ key: 'theme' });
    });
  });

  describe('saveNote', () => {
    it('should save note with topic', async () => {
      await memoryOps.saveNote('Meeting', 'Notes here');
      
      const args = vi.mocked(mockClient.add).mock.calls[0][0];
      expect(args.type).toBe('note');
      expect(args.content).toBe('Notes here');
      expect(args.metadata).toEqual({ topic: 'Meeting' });
    });
  });

  describe('saveProjectContext', () => {
    it('should save project context with projectId', async () => {
      await memoryOps.saveProjectContext('proj-123', 'Project desc');
      
      const args = vi.mocked(mockClient.add).mock.calls[0][0];
      expect(args.type).toBe('project');
      expect(args.content).toBe('Project desc');
      expect(args.metadata).toEqual({ projectId: 'proj-123' });
    });
  });

  describe('savePersonInfo', () => {
    it('should save person info with name', async () => {
      await memoryOps.savePersonInfo('Alice', 'Engineer');
      
      const args = vi.mocked(mockClient.add).mock.calls[0][0];
      expect(args.type).toBe('person');
      expect(args.content).toBe('Engineer');
      expect(args.metadata).toEqual({ name: 'Alice' });
    });
  });

  describe('getGlobalPreferences', () => {
    it('should search for global preferences', async () => {
      vi.mocked(mockClient.search).mockResolvedValue(['pref1', 'pref2']);
      
      const results = await memoryOps.getGlobalPreferences();
      
      expect(mockClient.search).toHaveBeenCalledWith({
        query: 'user preferences',
        filter: {
          must: [{ key: 'type', match: { value: 'preference' } }]
        },
        limit: 50
      });
      expect(results).toEqual(['pref1', 'pref2']);
    });
  });
});
