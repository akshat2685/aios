import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Neo4jGraphService } from '../src/neo4j-service';
import neo4j from 'neo4j-driver';
import { CoreLogger } from '@aios/core';
import { IMemoryClient } from '@aios/types';
import { ConfigManager } from '@aios/config';

// Mock dependencies
vi.mock('neo4j-driver');
vi.mock('uuid', () => ({ v4: () => 'test-uuid' }));
vi.mock('@aios/config');

describe('Neo4jGraphService', () => {
  let mockDriver: any;
  let mockSession: any;
  let mockLogger: any;
  let mockMemoryClient: any;
  let service: Neo4jGraphService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSession = {
      run: vi.fn().mockResolvedValue({ records: [] }),
      close: vi.fn().mockResolvedValue(undefined)
    };

    mockDriver = {
      session: vi.fn().mockReturnValue(mockSession),
      close: vi.fn().mockResolvedValue(undefined)
    };

    (neo4j.driver as any).mockReturnValue(mockDriver);
    (neo4j.auth.basic as any).mockReturnValue('mocked-auth');

    (ConfigManager.get as any).mockReturnValue('mocked-config');

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as unknown as CoreLogger;

    mockMemoryClient = {
      add: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([])
    } as unknown as IMemoryClient;

    service = new Neo4jGraphService(mockLogger, 'bolt://test', 'user', 'pass', mockMemoryClient);
  });

  afterEach(async () => {
    await service.close();
  });

  it('should initialize successfully', () => {
    expect(neo4j.driver).toHaveBeenCalledWith('bolt://test', 'mocked-auth');
    expect(mockLogger.info).toHaveBeenCalledWith('Neo4j Knowledge Graph service instantiated');
  });

  it('should handle driver initialization failure', () => {
    (neo4j.driver as any).mockImplementationOnce(() => { throw new Error('Driver Error'); });
    const failingService = new Neo4jGraphService(mockLogger);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to instantiate Neo4j driver: Driver Error');
  });

  it('should close driver on close()', async () => {
    await service.close();
    expect(mockDriver.close).toHaveBeenCalled();
  });

  it('should initialize schema constraints', async () => {
    await service.init();
    expect(mockSession.run).toHaveBeenCalledWith(expect.stringContaining('CREATE CONSTRAINT project_id_unique'));
    expect(mockSession.close).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Neo4j Knowledge Graph schema constraints initialized');
  });

  it('should handle init errors', async () => {
    mockSession.run.mockRejectedValueOnce(new Error('Schema Error'));
    await service.init();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize Neo4j schema constraints: Schema Error');
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should create a project and add to memory', async () => {
    const id = await service.createProject('Test Project', 'Test Desc');
    expect(id).toBe('test-uuid');
    expect(mockSession.run).toHaveBeenCalledWith(expect.stringContaining('CREATE (p:Project'), expect.any(Object));
    expect(mockMemoryClient.add).toHaveBeenCalledWith({
      id: 'project_test-uuid',
      content: 'Project: Test Project\nDescription: Test Desc',
      metadata: { type: 'PROJECT', projectId: 'test-uuid' }
    });
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should get projects', async () => {
    mockSession.run.mockResolvedValueOnce({
      records: [{ get: () => ({ properties: { id: '1', name: 'p1' } }) }]
    });
    const projects = await service.getProjects();
    expect(projects).toEqual([{ id: '1', name: 'p1' }]);
    expect(mockSession.run).toHaveBeenCalledWith('MATCH (p:Project) RETURN p');
  });

  it('should delete project', async () => {
    await service.deleteProject('p1');
    expect(mockSession.run).toHaveBeenCalledWith('MATCH (p:Project {id: $id}) DETACH DELETE p', { id: 'p1' });
    expect(mockMemoryClient.delete).toHaveBeenCalledWith('project_p1');
  });

  it('should create a task', async () => {
    const id = await service.createTask('p1', 'Task 1', 'Desc', 'high');
    expect(id).toBe('test-uuid');
    expect(mockSession.run).toHaveBeenCalledWith(expect.stringContaining('CREATE (t:Task'), expect.any(Object));
    expect(mockMemoryClient.add).toHaveBeenCalled();
  });

  it('should get tasks for project', async () => {
    mockSession.run.mockResolvedValueOnce({
      records: [{ get: () => ({ properties: { id: 't1', title: 'Task 1' } }) }]
    });
    const tasks = await service.getTasksForProject('p1');
    expect(tasks).toEqual([{ id: 't1', title: 'Task 1' }]);
  });

  it('should update task status', async () => {
    await service.updateTaskStatus('t1', 'done');
    expect(mockSession.run).toHaveBeenCalledWith(expect.stringContaining('SET t.status = $status'), expect.objectContaining({ id: 't1', status: 'done' }));
  });

  it('should delete task', async () => {
    await service.deleteTask('t1');
    expect(mockSession.run).toHaveBeenCalledWith('MATCH (t:Task {id: $id}) DETACH DELETE t', { id: 't1' });
    expect(mockMemoryClient.delete).toHaveBeenCalledWith('task_t1');
  });

  it('should return empty on search without memory client', async () => {
    const serviceNoMem = new Neo4jGraphService(mockLogger, 'bolt://test', 'user', 'pass');
    const result = await serviceNoMem.searchTasksSemantically('query');
    expect(result).toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalledWith('Memory client not available for semantic task search');
  });

  it('should return empty on search if no tasks found in memory', async () => {
    mockMemoryClient.search.mockResolvedValueOnce([{ metadata: { type: 'OTHER' } }]);
    const result = await service.searchTasksSemantically('query');
    expect(result).toEqual([]);
  });

  it('should search tasks semantically', async () => {
    mockMemoryClient.search.mockResolvedValueOnce([
      { metadata: { type: 'TASK', taskId: 't1' } },
      { metadata: { type: 'TASK', taskId: 't2' } }
    ]);
    mockSession.run.mockResolvedValueOnce({
      records: [{ get: () => ({ properties: { id: 't1' } }) }, { get: () => ({ properties: { id: 't2' } }) }]
    });
    const result = await service.searchTasksSemantically('query');
    expect(result).toEqual([{ id: 't1' }, { id: 't2' }]);
    expect(mockSession.run).toHaveBeenCalledWith(expect.stringContaining('WHERE t.id IN $taskIds'), { taskIds: ['t1', 't2'] });
  });

  it('should link file to task', async () => {
    const id = await service.linkFileToTask('t1', '/path/to/file');
    expect(id).toBe('test-uuid');
    expect(mockSession.run).toHaveBeenCalledWith(expect.stringContaining('CREATE (f:File'), expect.any(Object));
  });

  it('should get files for task', async () => {
    mockSession.run.mockResolvedValueOnce({
      records: [{ get: () => ({ properties: { filePath: '/path' } }) }]
    });
    const files = await service.getFilesForTask('t1');
    expect(files).toEqual([{ filePath: '/path' }]);
  });
});
