import neo4j, { Driver } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';
import { CoreLogger } from '@aios/core';
import { IMemoryClient } from '@aios/types';
import { ConfigManager } from '@aios/config';
import { IGraphService } from './types';

export class Neo4jGraphService implements IGraphService {
  private driver: Driver | null = null;
  private logger: CoreLogger;
  private memoryClient?: IMemoryClient;

  constructor(logger: CoreLogger, uri?: string, user?: string, password?: string, memoryClient?: IMemoryClient) {
    this.logger = logger;
    this.memoryClient = memoryClient;
    
    const dbUri = uri || ConfigManager.get('neo4j.uri') || process.env.NEO4J_URI || 'bolt://localhost:7687';
    const dbUser = user || ConfigManager.get('neo4j.user') || process.env.NEO4J_USER || 'neo4j';
    const dbPassword = password || ConfigManager.get('neo4j.password') || process.env.NEO4J_PASSWORD || 'password';

    try {
      this.driver = neo4j.driver(dbUri, neo4j.auth.basic(dbUser, dbPassword));
      this.logger.info('Neo4j Knowledge Graph service instantiated');
    } catch (e: any) {
      this.logger.error(`Failed to instantiate Neo4j driver: ${e.message}`);
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
    }
  }

  async init(): Promise<void> {
    if (!this.driver) return;
    const session = this.driver.session();
    try {
      await session.run(`CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT task_id_unique IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE`);
      this.logger.info('Neo4j Knowledge Graph schema constraints initialized');
    } catch (e: any) {
      this.logger.error(`Failed to initialize Neo4j schema constraints: ${e.message}`);
    } finally {
      await session.close();
    }
  }

  async createProject(name: string, description?: string): Promise<string> {
    if (!this.driver) return uuidv4();
    const id = uuidv4();
    const session = this.driver.session();
    try {
      await session.run(
        `CREATE (p:Project {
          id: $id, name: $name, description: $description,
          status: 'active', createdAt: $createdAt, updatedAt: $updatedAt
        }) RETURN p`,
        { id, name, description: description || null, createdAt: Date.now(), updatedAt: Date.now() }
      );
      this.logger.info(`Created project: ${name} (${id})`);

      if (this.memoryClient) {
        await this.memoryClient.add({
          id: `project_${id}`,
          content: `Project: ${name}\nDescription: ${description || ''}`,
          metadata: { type: 'PROJECT', projectId: id }
        });
      }
      return id;
    } finally {
      await session.close();
    }
  }

  async getProjects() {
    if (!this.driver) return [];
    const session = this.driver.session();
    try {
      const result = await session.run(`MATCH (p:Project) RETURN p`);
      return result.records.map(record => record.get('p').properties);
    } finally {
      await session.close();
    }
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.driver) return;
    const session = this.driver.session();
    try {
      await session.run(`MATCH (p:Project {id: $id}) DETACH DELETE p`, { id });
      this.logger.info(`Deleted project: ${id}`);
      
      if (this.memoryClient) {
        await this.memoryClient.delete(`project_${id}`);
      }
    } finally {
      await session.close();
    }
  }

  async createTask(projectId: string, title: string, description?: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<string> {
    if (!this.driver) return uuidv4();
    const id = uuidv4();
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (p:Project {id: $projectId})
         CREATE (t:Task {
           id: $id, title: $title, description: $description, priority: $priority,
           status: 'todo', createdAt: $createdAt, updatedAt: $updatedAt
         })
         CREATE (p)-[:HAS_TASK]->(t)
         RETURN t`,
        { id, projectId, title, description: description || null, priority, createdAt: Date.now(), updatedAt: Date.now() }
      );
      this.logger.info(`Created task: ${title} (${id}) in project ${projectId}`);

      if (this.memoryClient) {
        await this.memoryClient.add({
          id: `task_${id}`,
          content: `Task: ${title}\nDescription: ${description || ''}\nPriority: ${priority}`,
          metadata: { type: 'TASK', taskId: id, projectId }
        });
      }
      return id;
    } finally {
      await session.close();
    }
  }

  async getTasksForProject(projectId: string) {
    if (!this.driver) return [];
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (p:Project {id: $projectId})-[:HAS_TASK]->(t:Task) RETURN t`,
        { projectId }
      );
      return result.records.map(record => record.get('t').properties);
    } finally {
      await session.close();
    }
  }

  async updateTaskStatus(id: string, status: 'todo' | 'in_progress' | 'done'): Promise<void> {
    if (!this.driver) return;
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (t:Task {id: $id}) SET t.status = $status, t.updatedAt = $updatedAt`,
        { id, status, updatedAt: Date.now() }
      );
    } finally {
      await session.close();
    }
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.driver) return;
    const session = this.driver.session();
    try {
      await session.run(`MATCH (t:Task {id: $id}) DETACH DELETE t`, { id });
      if (this.memoryClient) {
        await this.memoryClient.delete(`task_${id}`);
      }
    } finally {
      await session.close();
    }
  }
  
  async searchTasksSemantically(query: string, limit: number = 5) {
    if (!this.memoryClient) {
      this.logger.warn('Memory client not available for semantic task search');
      return [];
    }
    
    if (!this.driver) return [];

    const results = await this.memoryClient.search({ query, limit });
    const taskIds = results
      .filter(r => r.metadata?.type === 'TASK')
      .map(r => r.metadata.taskId);

    if (taskIds.length === 0) return [];

    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (t:Task) WHERE t.id IN $taskIds RETURN t`,
        { taskIds }
      );
      return result.records.map(record => record.get('t').properties);
    } finally {
      await session.close();
    }
  }

  async linkFileToTask(taskId: string, filePath: string): Promise<string> {
    if (!this.driver) return uuidv4();
    const id = uuidv4();
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (t:Task {id: $taskId})
         CREATE (f:File { id: $id, filePath: $filePath, createdAt: $createdAt })
         CREATE (t)-[:HAS_FILE]->(f)
         RETURN f`,
        { taskId, id, filePath, createdAt: Date.now() }
      );
      this.logger.info(`Linked file ${filePath} to task ${taskId}`);
      return id;
    } finally {
      await session.close();
    }
  }

  async getFilesForTask(taskId: string) {
    if (!this.driver) return [];
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (t:Task {id: $taskId})-[:HAS_FILE]->(f:File) RETURN f`,
        { taskId }
      );
      return result.records.map(record => record.get('f').properties);
    } finally {
      await session.close();
    }
  }
}
