import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceManager } from '../src/manager';
import { CoreLogger } from '@aios/core';
import { SQLiteStorage } from '@aios/storage';

describe('WorkspaceManager', () => {
  let mockLogger: any;
  let mockDb: any;
  let manager: WorkspaceManager;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
    };

    mockDb = {
      run: vi.fn(),
      query: vi.fn(),
    };

    manager = new WorkspaceManager(mockLogger as unknown as CoreLogger, mockDb as unknown as SQLiteStorage);
  });

  it('should initialize schema in constructor', () => {
    expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS workspaces'));
  });

  it('should create a workspace', async () => {
    await manager.createWorkspace('ws-1', 'My Workspace', '/path/to/ws');
    expect(mockLogger.info).toHaveBeenCalledWith('Creating workspace: My Workspace at /path/to/ws');
    expect(mockDb.run).toHaveBeenCalledWith(
      'INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)',
      ['ws-1', 'My Workspace', '/path/to/ws']
    );
  });

  it('should return active workspace when found', async () => {
    mockDb.query.mockReturnValue([
      {
        columns: ['id', 'name', 'path', 'is_active'],
        values: [['ws-2', 'Active WS', '/path/to/active', 1]]
      }
    ]);

    const result = await manager.getActiveWorkspace();
    expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM workspaces WHERE is_active = 1');
    expect(result).toEqual({
      id: 'ws-2',
      name: 'Active WS',
      path: '/path/to/active',
      isActive: true
    });
  });

  it('should return null when no active workspace found', async () => {
    // Empty results array
    mockDb.query.mockReturnValue([]);
    let result = await manager.getActiveWorkspace();
    expect(result).toBeNull();

    // Results array with empty values array
    mockDb.query.mockReturnValue([{ columns: ['id', 'name', 'path', 'is_active'], values: [] }]);
    result = await manager.getActiveWorkspace();
    expect(result).toBeNull();
  });
});
