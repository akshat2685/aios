import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphService } from '../src/service';
import { CoreLogger } from '@aios/core';
import { IMemoryClient } from '@aios/types';

vi.mock('../src/db', () => ({
  getDatabase: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(true)
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        all: vi.fn().mockResolvedValue([]),
        where: vi.fn(() => ({
          all: vi.fn().mockResolvedValue([])
        }))
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(true)
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(true)
      }))
    })),
    session: {
      client: {
        execute: vi.fn().mockResolvedValue({ rows: [{ id: 't1', title: 'Task 1' }] })
      }
    }
  })),
  schema: {
    projects: { id: 'projects' },
    tasks: { id: 'tasks', projectId: 'project_id' },
    taskFiles: { id: 'task_files', taskId: 'task_id' }
  }
}));

describe('GraphService', () => {
  let logger: CoreLogger;
  let memoryClient: IMemoryClient;
  let service: GraphService;

  beforeEach(() => {
    logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as CoreLogger;
    memoryClient = {
      search: vi.fn(),
      add: vi.fn(),
      delete: vi.fn(),
    } as unknown as IMemoryClient;
    service = new GraphService(logger, undefined, memoryClient);
  });

  it('should initialize schema', async () => {
    await service.init();
    expect(logger.info).toHaveBeenCalledWith('Knowledge Graph schema initialized');
  });

  it('should create project and update index incrementally', async () => {
    const id = await service.createProject('Project A', 'Desc A');
    expect(id).toBeDefined();
    expect(memoryClient.add).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { type: 'PROJECT', projectId: id }
    }));
  });

  it('should delete project and remove from index', async () => {
    await service.deleteProject('p1');
    expect(memoryClient.delete).toHaveBeenCalledWith('project_p1');
  });

  it('should create task and update index incrementally', async () => {
    const id = await service.createTask('p1', 'Task 1', 'Desc');
    expect(id).toBeDefined();
    expect(memoryClient.add).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { type: 'TASK', taskId: id, projectId: 'p1' }
    }));
  });

  it('should delete task and remove from index', async () => {
    await service.deleteTask('t1');
    expect(memoryClient.delete).toHaveBeenCalledWith('task_t1');
  });

  it('should search tasks semantically', async () => {
    vi.mocked(memoryClient.search).mockResolvedValue([
      { metadata: { type: 'TASK', taskId: 't1' } }
    ]);

    const tasks = await service.searchTasksSemantically('find task 1');
    expect(memoryClient.search).toHaveBeenCalledWith({ query: 'find task 1', limit: 5 });
    
    // The mocked db client.execute returns [{ id: 't1', title: 'Task 1' }]
    expect(tasks.length).toBe(1);
    expect((tasks[0] as any).id).toBe('t1');
  });
});
