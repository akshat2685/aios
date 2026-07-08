import { CoreLogger } from '@aios/core';
import { SQLiteStorage } from '@aios/storage';

export interface TimelineEvent {
  id: string;
  source: string;
  action: string;
  description: string;
  metadata: Record<string, any>;
  timestamp: number;
}

export class TimelineEngine {
  private logger: CoreLogger;
  private db: SQLiteStorage;

  constructor(logger: CoreLogger, db: SQLiteStorage) {
    this.logger = logger;
    this.db = db;
    this.initSchema();
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async recordEvent(event: TimelineEvent): Promise<void> {
    this.logger.debug(`Recording timeline event: [${event.source}] ${event.action}`);
    this.db.run(
      `INSERT INTO timeline_events (id, source, action, description, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
      [event.id, event.source, event.action, event.description, JSON.stringify(event.metadata), event.timestamp]
    );
  }

  async queryRecentEvents(limit: number = 50): Promise<TimelineEvent[]> {
    const results = this.db.query(`SELECT * FROM timeline_events ORDER BY timestamp DESC LIMIT ?`, [limit]);
    const events: TimelineEvent[] = [];
    
    if (results.length > 0) {
      for (const row of results[0].values) {
        events.push({
          id: row[0] as string,
          source: row[1] as string,
          action: row[2] as string,
          description: row[3] as string,
          metadata: JSON.parse(row[4] as string),
          timestamp: row[5] as number
        });
      }
    }
    return events;
  }
}
