import initSqlJs from 'sql.js';
import fs from 'fs/promises';
import path from 'path';

export class SQLiteStorage {
  private db: any = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init() {
    const SQL = await initSqlJs({
      // We don't provide locateFile, assuming we run in a Node environment where sql.js can find the wasm file
    });

    try {
      const data = await fs.readFile(this.dbPath);
      this.db = new SQL.Database(data);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        this.db = new SQL.Database();
        await this.save();
      } else {
        throw e;
      }
    }

    this.runMigrations();
  }

  private runMigrations() {
    // Initial schema setup
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.save();
  }

  async save() {
    if (!this.db) return;
    const data = this.db.export();
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await fs.writeFile(this.dbPath, Buffer.from(data));
  }

  query(sql: string, params: any[] = []) {
    if (!this.db) throw new Error("Database not initialized");
    return this.db.exec(sql, params);
  }

  run(sql: string, params: any[] = []) {
    if (!this.db) throw new Error("Database not initialized");
    this.db.run(sql, params);
    this.save();
  }
}
