import { CoreLogger } from '@aios/core';
import { SQLiteStorage } from '@aios/storage';

export interface WorkspaceConfig {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
}

export class WorkspaceManager {
  private logger: CoreLogger;
  private db: SQLiteStorage;

  constructor(logger: CoreLogger, db: SQLiteStorage) {
    this.logger = logger;
    this.db = db;
    this.initSchema();
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 0
      );
    `);
  }

  async createWorkspace(id: string, name: string, path: string): Promise<void> {
    this.logger.info(`Creating workspace: ${name} at ${path}`);
    this.db.run(
      `INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)`,
      [id, name, path]
    );
  }

  async getActiveWorkspace(): Promise<WorkspaceConfig | null> {
    const results = this.db.query(`SELECT * FROM workspaces WHERE is_active = 1`);
    if (results.length > 0 && results[0].values.length > 0) {
      const row = results[0].values[0];
      return {
        id: row[0] as string,
        name: row[1] as string,
        path: row[2] as string,
        isActive: Boolean(row[3])
      };
    }
    return null;
  }
}
