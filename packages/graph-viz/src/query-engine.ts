import { CoreLogger } from '@aios/core';
import {
  GraphVizNode,
  GraphVizEdge,
  GraphVizNodeType,
  GraphFilter,
  GraphSnapshot,
} from '@aios/types';

/**
 * GraphQueryEngine — Unified aggregation layer over the AIOS knowledge and
 * project graphs. Provides filtering, traversal, and search capabilities
 * for the Brain Map visualization.
 */
export class GraphQueryEngine {
  private logger: CoreLogger;

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  /**
   * Fetch all nodes and edges from the knowledge graph, applying optional filters.
   * Aggregates data from @aios/knowledge (GraphBuilder) and @aios/graph (GraphService).
   */
  public async queryGraph(filter?: GraphFilter): Promise<{ nodes: GraphVizNode[]; edges: GraphVizEdge[] }> {
    this.logger.info('Querying unified knowledge graph...');

    // Stub: In production, this would:
    // 1. Query GraphBuilder (knowledge/src/builder.ts) for graph_nodes and graph_edges
    // 2. Query GraphService (graph/src/service.ts) for projects, tasks, task_files
    // 3. Query MemoryClient for memory vectors and their metadata
    // 4. Merge into unified GraphVizNode[] and GraphVizEdge[] arrays
    // 5. Apply filters (type, time range, search, depth)

    const nodes: GraphVizNode[] = [];
    const edges: GraphVizEdge[] = [];

    if (filter) {
      this.logger.debug(`Applied filters: types=${filter.nodeTypes?.join(',')}, depth=${filter.maxDepth}`);
    }

    this.logger.info(`Query returned ${nodes.length} nodes, ${edges.length} edges`);
    return { nodes, edges };
  }

  /**
   * Get the neighborhood of a specific node up to a given depth.
   */
  public async getNeighborhood(
    nodeId: string,
    depth: number = 2
  ): Promise<{ nodes: GraphVizNode[]; edges: GraphVizEdge[] }> {
    this.logger.debug(`Fetching neighborhood of node ${nodeId} (depth=${depth})`);

    const { nodes: allNodes, edges: allEdges } = await this.queryGraph();
    
    const nodesMap = new Map<string, GraphVizNode>(allNodes.map(n => [n.id, n]));
    const adjList = new Map<string, GraphVizEdge[]>();
    
    for (const edge of allEdges) {
      if (!adjList.has(edge.sourceId)) adjList.set(edge.sourceId, []);
      if (!adjList.has(edge.targetId)) adjList.set(edge.targetId, []);
      adjList.get(edge.sourceId)!.push(edge);
      adjList.get(edge.targetId)!.push(edge);
    }
    
    const visitedNodes = new Set<string>();
    const collectedEdges = new Set<GraphVizEdge>();
    const queue: { id: string; d: number }[] = [];
    
    if (nodesMap.has(nodeId)) {
      queue.push({ id: nodeId, d: 0 });
      visitedNodes.add(nodeId);
    }
    
    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (d >= depth) continue;
      
      const neighbors = adjList.get(id) || [];
      for (const edge of neighbors) {
        collectedEdges.add(edge);
        const nextId = edge.sourceId === id ? edge.targetId : edge.sourceId;
        if (!visitedNodes.has(nextId)) {
          visitedNodes.add(nextId);
          queue.push({ id: nextId, d: d + 1 });
        }
      }
    }
    
    const resultNodes = Array.from(visitedNodes).map(id => nodesMap.get(id)!).filter(Boolean);
    const resultEdges = Array.from(collectedEdges);
    
    return { nodes: resultNodes, edges: resultEdges };
  }

  public async findShortestPath(
    sourceId: string,
    targetId: string
  ): Promise<{ path: string[]; edges: GraphVizEdge[] } | null> {
    this.logger.debug(`Finding shortest path: ${sourceId} → ${targetId}`);

    const { nodes: allNodes, edges: allEdges } = await this.queryGraph();
    
    const adjList = new Map<string, { to: string; edge: GraphVizEdge }[]>();
    for (const edge of allEdges) {
      if (!adjList.has(edge.sourceId)) adjList.set(edge.sourceId, []);
      if (!adjList.has(edge.targetId)) adjList.set(edge.targetId, []);
      adjList.get(edge.sourceId)!.push({ to: edge.targetId, edge });
      adjList.get(edge.targetId)!.push({ to: edge.sourceId, edge });
    }

    if (!adjList.has(sourceId) || !adjList.has(targetId)) return null;

    const dist = new Map<string, number>();
    const prev = new Map<string, { node: string; edge: GraphVizEdge }>();
    const pq: { id: string; d: number }[] = [];

    for (const n of allNodes) dist.set(n.id, Infinity);
    dist.set(sourceId, 0);
    pq.push({ id: sourceId, d: 0 });

    while (pq.length > 0) {
      pq.sort((a, b) => a.d - b.d);
      const { id: u, d: distU } = pq.shift()!;

      if (distU > (dist.get(u) ?? Infinity)) continue;
      if (u === targetId) break;

      const neighbors = adjList.get(u) || [];
      for (const { to: v, edge } of neighbors) {
        const weight = edge.weight ?? 1;
        const alt = (dist.get(u) ?? Infinity) + weight;
        if (alt < (dist.get(v) ?? Infinity)) {
          dist.set(v, alt);
          prev.set(v, { node: u, edge });
          pq.push({ id: v, d: alt });
        }
      }
    }

    if ((dist.get(targetId) ?? Infinity) === Infinity) return null;

    const path: string[] = [];
    const edges: GraphVizEdge[] = [];
    let curr = targetId;
    
    while (curr !== sourceId) {
      path.push(curr);
      const p = prev.get(curr)!;
      edges.push(p.edge);
      curr = p.node;
    }
    
    path.push(sourceId);
    path.reverse();
    edges.reverse();

    return { path, edges };
  }

  /**
   * Search nodes by label or property values.
   */
  public async searchNodes(
    query: string,
    limit: number = 50
  ): Promise<GraphVizNode[]> {
    this.logger.debug(`Searching nodes: "${query}" (limit=${limit})`);

    // Stub: Full-text search across node labels and property values
    // 1. Query graph_nodes WHERE label LIKE '%query%'
    // 2. Also search node properties JSON
    // 3. Rank by relevance
    return [];
  }

  /**
   * Compute degree centrality for all nodes.
   * Returns a map of nodeId → centrality score.
   */
  public computeDegreeCentrality(
    nodes: GraphVizNode[],
    edges: GraphVizEdge[]
  ): Map<string, number> {
    const degrees = new Map<string, number>();
    const maxDegree = nodes.length - 1;

    for (const node of nodes) {
      degrees.set(node.id, 0);
    }

    for (const edge of edges) {
      degrees.set(edge.sourceId, (degrees.get(edge.sourceId) || 0) + 1);
      degrees.set(edge.targetId, (degrees.get(edge.targetId) || 0) + 1);
    }

    // Normalize to [0, 1]
    if (maxDegree > 0) {
      for (const [id, degree] of degrees) {
        degrees.set(id, degree / maxDegree);
      }
    }

    return degrees;
  }

  /**
   * Get nodes grouped by type with counts.
   */
  public async getNodeTypeCounts(): Promise<Record<GraphVizNodeType, number>> {
    this.logger.debug('Fetching node type counts');

    // Stub: SELECT type, COUNT(*) FROM graph_nodes GROUP BY type
    return {
      memory: 0,
      chat: 0,
      project: 0,
      file: 0,
      task: 0,
      agent: 0,
      preference: 0,
      goal: 0,
    };
  }
}
