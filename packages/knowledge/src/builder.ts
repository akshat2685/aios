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

    // 2. Assemble context using Spreading Activation (Personalized PageRank)
    let currentFrontier = new Set<string>(seedNodeIds);
    const expandedNodes = new Set<string>(seedNodeIds);
    const expandedEdges = new Map<string, any>();
    
    // Expand up to 2 hops to fetch a local subgraph from SQLite
    for (let hop = 0; hop < 2; hop++) {
      if (currentFrontier.size === 0) break;
      const placeholders = Array.from(currentFrontier).map(() => '?').join(',');
      const edgesResult = this.db.query(
        `SELECT * FROM graph_edges WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`,
        [...Array.from(currentFrontier), ...Array.from(currentFrontier)]
      );
      const edgesRaw = this.parseSqlResult(edgesResult as any[]);
      
      currentFrontier = new Set<string>();
      for (const e of edgesRaw) {
        if (!expandedEdges.has(e.id)) {
          expandedEdges.set(e.id, e);
          if (!expandedNodes.has(e.source_id)) {
            expandedNodes.add(e.source_id);
            currentFrontier.add(e.source_id);
          }
          if (!expandedNodes.has(e.target_id)) {
            expandedNodes.add(e.target_id);
            currentFrontier.add(e.target_id);
          }
        }
      }
    }
    
    const nodeIdsArray = Array.from(expandedNodes);
    const nodePlaceholders = nodeIdsArray.map(() => '?').join(',');
    const nodesRawResult = this.db.query(
      `SELECT * FROM graph_nodes WHERE id IN (${nodePlaceholders})`,
      nodeIdsArray
    );
    const nodesRaw = this.parseSqlResult(nodesRawResult as any[]);
    
    // Spreading Activation Algorithm
    const activations = new Map<string, number>();
    const degrees = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    
    for (const id of nodeIdsArray) {
      activations.set(id, seedNodeIds.includes(id) ? 1.0 / seedNodeIds.length : 0);
      degrees.set(id, 0);
      adjList.set(id, []);
    }
    
    for (const e of expandedEdges.values()) {
      degrees.set(e.source_id, (degrees.get(e.source_id) || 0) + 1);
      degrees.set(e.target_id, (degrees.get(e.target_id) || 0) + 1);
      adjList.get(e.source_id)!.push(e.target_id);
      adjList.get(e.target_id)!.push(e.source_id); // Undirected spread for context
    }
    
    const ALPHA = 0.85;
    const ITERATIONS = 10;
    
    for (let i = 0; i < ITERATIONS; i++) {
      const nextActivations = new Map<string, number>();
      for (const id of nodeIdsArray) nextActivations.set(id, 0);
      
      for (const id of nodeIdsArray) {
        const currentAct = activations.get(id) || 0;
        if (currentAct > 0) {
          const deg = degrees.get(id) || 1;
          const spread = (currentAct * ALPHA) / deg;
          for (const neighbor of adjList.get(id)!) {
            nextActivations.set(neighbor, (nextActivations.get(neighbor) || 0) + spread);
          }
        }
      }
      
      for (const seedId of seedNodeIds) {
        nextActivations.set(seedId, (nextActivations.get(seedId) || 0) + ((1 - ALPHA) / seedNodeIds.length));
      }
      
      for (const id of nodeIdsArray) {
        activations.set(id, nextActivations.get(id)!);
      }
    }
    
    // Take top nodes by activation score
    const MAX_CONTEXT_NODES = Math.max(limit * 3, 20);
    const topNodeIds = new Set(
      Array.from(activations.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_CONTEXT_NODES)
        .map(entry => entry[0])
    );
    
    const finalNodesRaw = nodesRaw.filter((n: any) => topNodeIds.has(n.id));
    const finalEdgesRaw = Array.from(expandedEdges.values()).filter(
      (e: any) => topNodeIds.has(e.source_id) && topNodeIds.has(e.target_id)
    );
    
    // 3. Map back to types
    const nodes: GraphNode[] = finalNodesRaw.map((n: any) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      properties: JSON.parse(n.properties),
      timestamp: n.timestamp
    }));
    
    const edges: GraphEdge[] = finalEdgesRaw.map((e: any) => ({
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
