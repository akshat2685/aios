import { SQLiteStorage } from '@aios/storage';
import { CoreLogger } from '@aios/core';
import { GraphNode, GraphEdge } from './types';
import { IMemoryClient, IDocumentPipeline } from '@aios/types';

export class GraphBuilder {
  private db: SQLiteStorage;
  private logger: CoreLogger;
  private memoryClient: IMemoryClient;
  private documentPipeline?: IDocumentPipeline;
  private queryCache: Map<string, { nodes: GraphNode[], edges: GraphEdge[], timestamp: number }> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(db: SQLiteStorage, logger: CoreLogger, memoryClient: IMemoryClient, documentPipeline?: IDocumentPipeline) {
    this.db = db;
    this.logger = logger;
    this.memoryClient = memoryClient;
    this.documentPipeline = documentPipeline;
    this.initSchema();
  }

  private initSchema() {
    const query = "CREATE TABLE IF NOT EXISTS graph_nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, label TEXT NOT NULL, properties TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS graph_edges (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL, type TEXT NOT NULL, weight REAL DEFAULT 1.0, confidence REAL DEFAULT 1.0, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(source_id) REFERENCES graph_nodes(id), FOREIGN KEY(target_id) REFERENCES graph_nodes(id));";
    this.db.run(query);
  }

  async addNode(node: GraphNode): Promise<void> {
    this.db.run(
      "INSERT OR REPLACE INTO graph_nodes (id, type, label, properties, timestamp) VALUES (?, ?, ?, ?, ?)",
      [node.id, node.type, node.label, JSON.stringify(node.properties), node.timestamp]
    );
    this.logger.debug("Added node " + node.id + " (" + node.type + ")");
    
    // Incremental index update: Embed the node semantics into memory client
    if (this.memoryClient) {
      await this.memoryClient.add({
        id: "node_" + node.id,
        content: node.label + " " + JSON.stringify(node.properties),
        metadata: { type: 'GRAPH_NODE', nodeId: node.id, nodeType: node.type }
      });
    }
  }

  addEdge(edge: GraphEdge): void {
    this.db.run(
      "INSERT OR REPLACE INTO graph_edges (id, source_id, target_id, type, weight, confidence, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [edge.id, edge.sourceId, edge.targetId, edge.type, edge.weight, edge.confidence, edge.timestamp]
    );
    this.logger.debug("Added edge " + edge.id + " (" + edge.type + ")");
  }
  
  private parseSqlResult(res: any[]): any[] {
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }
  
  /**
   * Semantic Graph Retrieval & Intelligent Context Assembly
   * Queries both vector memory and graph topological structure.
   */
  async retrieveSemanticContext(query: string, limit: number = 5): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
    const cacheKey = query + ":" + limit;
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug("Using cached semantic context for " + query);
      return { nodes: cached.nodes, edges: cached.edges };
    }
    
    // 1. Semantic search for initial seed nodes
    const memoryResults = await this.memoryClient.search({ query, limit });
    const seedNodeIds = memoryResults
      .filter(r => r.metadata?.type === 'GRAPH_NODE' && r.metadata?.nodeId)
      .map(r => r.metadata.nodeId);
      
    if (seedNodeIds.length === 0) {
      return { nodes: [], edges: [] };
    }

    // 2. Assemble context by expanding graph around seed nodes (1 hop)
    const placeholders = seedNodeIds.map(() => '?').join(',');
    
    const nodesRawResult = this.db.query("SELECT * FROM graph_nodes WHERE id IN (" + placeholders + ")", seedNodeIds);
    const edgesRawResult = this.db.query("SELECT * FROM graph_edges WHERE source_id IN (" + placeholders + ") OR target_id IN (" + placeholders + ")", [...seedNodeIds, ...seedNodeIds]);
    
    const nodesRaw = this.parseSqlResult(nodesRawResult as any[]);
    const edgesRaw = this.parseSqlResult(edgesRawResult as any[]);
    
    // 3. Map back to types
    const nodes: GraphNode[] = nodesRaw.map((n: any) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      properties: JSON.parse(n.properties),
      timestamp: n.timestamp
    }));
    
    const edges: GraphEdge[] = edgesRaw.map((e: any) => ({
      id: e.id,
      sourceId: e.source_id,
      targetId: e.target_id,
      type: e.type,
      weight: e.weight,
      confidence: e.confidence,
      timestamp: e.timestamp
    }));
    
    this.queryCache.set(cacheKey, { nodes, edges, timestamp: Date.now() });
    
    return { nodes, edges };
  }
}
