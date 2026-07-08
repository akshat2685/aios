import { SQLiteStorage } from '@aios/storage';
import { CoreLogger } from '@aios/core';
import { GraphNode, GraphEdge } from './types';

export class GraphBuilder {
  private db: SQLiteStorage;
  private logger: CoreLogger;

  constructor(db: SQLiteStorage, logger: CoreLogger) {
    this.db = db;
    this.logger = logger;
    this.initSchema();
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS graph_edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        confidence REAL DEFAULT 1.0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(source_id) REFERENCES graph_nodes(id),
        FOREIGN KEY(target_id) REFERENCES graph_nodes(id)
      );
    `);
  }

  addNode(node: GraphNode): void {
    this.db.run(
      `INSERT OR REPLACE INTO graph_nodes (id, type, label, properties, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [node.id, node.type, node.label, JSON.stringify(node.properties), node.timestamp]
    );
    this.logger.debug(`Added node ${node.id} (${node.type})`);
  }

  addEdge(edge: GraphEdge): void {
    this.db.run(
      `INSERT OR REPLACE INTO graph_edges (id, source_id, target_id, type, weight, confidence, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [edge.id, edge.sourceId, edge.targetId, edge.type, edge.weight, edge.confidence, edge.timestamp]
    );
    this.logger.debug(`Added edge ${edge.id} (${edge.type})`);
  }
}
