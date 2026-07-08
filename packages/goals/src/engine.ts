import { CoreLogger } from '@aios/core';
import { SQLiteStorage } from '@aios/storage';

export interface Goal {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
}

export class GoalEngine {
  private logger: CoreLogger;
  private db: SQLiteStorage;

  constructor(logger: CoreLogger, db: SQLiteStorage) {
    this.logger = logger;
    this.db = db;
    this.initSchema();
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL DEFAULT 0.0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async createGoal(goal: Goal): Promise<void> {
    this.logger.info(`Creating goal: ${goal.title}`);
    this.db.run(
      `INSERT INTO goals (id, title, status, progress) VALUES (?, ?, ?, ?)`,
      [goal.id, goal.title, goal.status, goal.progress]
    );
  }
}
