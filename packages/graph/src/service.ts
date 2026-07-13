import { getDatabase, schema } from './db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CoreLogger } from '@aios/core';
import { IMemoryClient } from '@aios/types';

export class GraphService {
  private db: ReturnType<typeof getDatabase>;
  private logger: CoreLogger;
  private memoryClient?: IMemoryClient;

  constructor(logger: CoreLogger, dbPath?: string, memoryClient?: IMemoryClient) {
    this.logger = logger;
    this.db = getDatabase(dbPath);
    this.memoryClient = memoryClient;
    this.logger.info('Knowledge Graph service initialized');
  }

  async init(): Promise<void> {
    const client = (this.db as any).session.client;
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS task_files (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    this.logger.info('Knowledge Graph schema initialized');
  }

  // --- Projects ---

  async createProject(name: string, description?: string): Promise<string> {
    const id = uuidv4();
    await this.db.insert(schema.projects).values({
      id,
      name,
      description: description || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.logger.info(`Created project: ${name} (${id})`);
    
    // Incremental index update
    if (this.memoryClient) {
      await this.memoryClient.add({
        id: `project_${id}`,
        content: `Project: ${name}\nDescription: ${description || ''}`,
        metadata: { type: 'PROJECT', projectId: id }
      });
    }
    return id;
  }

  async getProjects() {
    return this.db.select().from(schema.projects).all();
  }

  async deleteProject(id: string): Promise<void> {
    await this.db.delete(schema.projects).where(eq(schema.projects.id, id));
    if (this.memoryClient) {
      await this.memoryClient.delete(`project_${id}`);
    }
    this.logger.info(`Deleted project: ${id}`);
  }

  // --- Tasks ---

  async createTask(projectId: string, title: string, description?: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<string> {
    const id = uuidv4();
    await this.db.insert(schema.tasks).values({
      id,
      projectId,
      title,
      description: description || null,
      priority,
      status: 'todo',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.logger.info(`Created task: ${title} (${id}) in project ${projectId}`);
    
    // Incremental index update
    if (this.memoryClient) {
      await this.memoryClient.add({
        id: `task_${id}`,
        content: `Task: ${title}\nDescription: ${description || ''}\nPriority: ${priority}`,
        metadata: { type: 'TASK', taskId: id, projectId }
      });
    }
    return id;
  }

  async getTasksForProject(projectId: string) {
    return this.db.select().from(schema.tasks).where(eq(schema.tasks.projectId, projectId)).all();
  }

  async updateTaskStatus(id: string, status: 'todo' | 'in_progress' | 'done'): Promise<void> {
    await this.db.update(schema.tasks).set({ status, updatedAt: Date.now() }).where(eq(schema.tasks.id, id));
  }

  async deleteTask(id: string): Promise<void> {
    await this.db.delete(schema.tasks).where(eq(schema.tasks.id, id));
    if (this.memoryClient) {
      await this.memoryClient.delete(`task_${id}`);
    }
  }
  
  /**
   * Semantic Task Retrieval
   */
  async searchTasksSemantically(query: string, limit: number = 5) {
    if (!this.memoryClient) {
      this.logger.warn('Memory client not available for semantic task search');
      return [];
    }
    
    const results = await this.memoryClient.search({ query, limit });
    const taskIds = results
      .filter(r => r.metadata?.type === 'TASK')
      .map(r => r.metadata.taskId);
      
    if (taskIds.length === 0) return [];
    
    const client = (this.db as any).session.client;
    const placeholders = taskIds.map(() => '?').join(',');
    const tasks = await client.execute(`SELECT * FROM tasks WHERE id IN (${placeholders})`, taskIds);
    return tasks.rows || tasks;
  }

  // --- Files ---

  async linkFileToTask(taskId: string, filePath: string): Promise<string> {
    const id = uuidv4();
    await this.db.insert(schema.taskFiles).values({
      id,
      taskId,
      filePath,
      createdAt: Date.now(),
    });
    this.logger.info(`Linked file ${filePath} to task ${taskId}`);
    return id;
  }

  async getFilesForTask(taskId: string) {
    return this.db.select().from(schema.taskFiles).where(eq(schema.taskFiles.taskId, taskId)).all();
  }
}
