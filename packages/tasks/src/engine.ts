import { CoreLogger } from '@aios/core';
import { SQLiteStorage } from '@aios/storage';

export interface Task {
  id: string;
  goalId: string;
  assignedAgent: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output: string | null;
}

export class TaskEngine {
  private logger: CoreLogger;
  private db: SQLiteStorage;

  constructor(logger: CoreLogger, db: SQLiteStorage) {
    this.logger = logger;
    this.db = db;
    this.initSchema();
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        assigned_agent TEXT,
        status TEXT NOT NULL,
        output TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async createTask(task: Task): Promise<void> {
    this.logger.info(`Creating task for goal ${task.goalId}`);
    this.db.run(
      `INSERT INTO tasks (id, goal_id, assigned_agent, status, output) VALUES (?, ?, ?, ?, ?)`,
      [task.id, task.goalId, task.assignedAgent, task.status, task.output]
    );
  }
}
