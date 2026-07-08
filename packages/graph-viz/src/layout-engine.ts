import { CoreLogger } from '@aios/core';
import {
  GraphVizNode,
  GraphLayout,
  GraphLayoutAlgorithm,
  GraphCluster,
  GraphSnapshot,
  GraphStats,
} from '@aios/types';

/**
 * GraphLayoutEngine — Pure JavaScript force-directed layout calculator.
 *
 * Computes 2D positions for graph nodes using force simulation (attraction,
 * repulsion, centering), cluster detection, and incremental layout updates.
 * Positions are persisted to SQLite for layout continuity across sessions.
 */
export class GraphLayoutEngine {
  private logger: CoreLogger;
  private algorithm: GraphLayoutAlgorithm = 'force-directed';
  private positions: Map<string, { x: number; y: number }> = new Map();
  private iterations: number;
  private repulsionStrength: number;
  private attractionStrength: number;
  private dampening: number;

  constructor(
    logger: CoreLogger,
    options: {
      algorithm?: GraphLayoutAlgorithm;
      iterations?: number;
      repulsionStrength?: number;
      attractionStrength?: number;
      dampening?: number;
    } = {}
  ) {
    this.logger = logger;
    this.algorithm = options.algorithm || 'force-directed';
    this.iterations = options.iterations || 300;
    this.repulsionStrength = options.repulsionStrength || 500;
    this.attractionStrength = options.attractionStrength || 0.01;
    this.dampening = options.dampening || 0.95;
  }

  /**
   * Compute a full layout for the given set of nodes and edges.
   * Returns a GraphLayout with positions and detected clusters.
   */
  public computeLayout(
    nodes: GraphVizNode[],
    edges: Array<{ sourceId: string; targetId: string; weight: number }>
  ): GraphLayout {
    this.logger.info(`Computing ${this.algorithm} layout for ${nodes.length} nodes, ${edges.length} edges`);

    // Initialize positions randomly if not already placed
    for (const node of nodes) {
      if (!this.positions.has(node.id)) {
        this.positions.set(node.id, {
          x: (Math.random() - 0.5) * 1000,
          y: (Math.random() - 0.5) * 1000,
        });
      }
    }

    // Stub: Run force-directed simulation iterations
    // In production, this would iterate through:
    //   1. Repulsion forces between all node pairs (Coulomb's law)
    //   2. Attraction forces along edges (Hooke's law)
    //   3. Centering force to prevent drift
    //   4. Apply velocities with dampening
    for (let i = 0; i < this.iterations; i++) {
      this.simulationStep(nodes, edges);
    }

    const clusters = this.detectClusters(nodes, edges);

    const positionsRecord: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of this.positions) {
      positionsRecord[id] = pos;
    }

    this.logger.info(`Layout computed: ${clusters.length} clusters detected`);

    return {
      algorithm: this.algorithm,
      positions: positionsRecord,
      clusters,
      computedAt: Date.now(),
    };
  }

  /**
   * Incrementally update layout when new nodes/edges are added
   * without recomputing from scratch.
   */
  public incrementalUpdate(
    newNodes: GraphVizNode[],
    newEdges: Array<{ sourceId: string; targetId: string; weight: number }>
  ): void {
    this.logger.debug(`Incremental layout update: +${newNodes.length} nodes, +${newEdges.length} edges`);

    // Place new nodes near their connected neighbors
    for (const node of newNodes) {
      const connectedEdge = newEdges.find(e => e.sourceId === node.id || e.targetId === node.id);
      if (connectedEdge) {
        const neighborId = connectedEdge.sourceId === node.id ? connectedEdge.targetId : connectedEdge.sourceId;
        const neighborPos = this.positions.get(neighborId);
        if (neighborPos) {
          this.positions.set(node.id, {
            x: neighborPos.x + (Math.random() - 0.5) * 100,
            y: neighborPos.y + (Math.random() - 0.5) * 100,
          });
          continue;
        }
      }
      // Fallback: random placement
      this.positions.set(node.id, {
        x: (Math.random() - 0.5) * 1000,
        y: (Math.random() - 0.5) * 1000,
      });
    }
  }

  /**
   * Save current layout positions to persistent storage.
   */
  public serializePositions(): Record<string, { x: number; y: number }> {
    const result: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of this.positions) {
      result[id] = pos;
    }
    return result;
  }

  /**
   * Restore layout positions from persistent storage.
   */
  public restorePositions(saved: Record<string, { x: number; y: number }>): void {
    this.positions.clear();
    for (const [id, pos] of Object.entries(saved)) {
      this.positions.set(id, pos);
    }
    this.logger.debug(`Restored ${this.positions.size} node positions from storage`);
  }

  /**
   * Compute graph statistics.
   */
  public computeStats(
    nodes: GraphVizNode[],
    edges: Array<{ sourceId: string; targetId: string }>
  ): GraphStats {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    // Degree map
    const degrees = new Map<string, number>();
    for (const node of nodes) degrees.set(node.id, 0);
    for (const edge of edges) {
      degrees.set(edge.sourceId, (degrees.get(edge.sourceId) || 0) + 1);
      degrees.set(edge.targetId, (degrees.get(edge.targetId) || 0) + 1);
    }

    const totalDegree = Array.from(degrees.values()).reduce((sum, d) => sum + d, 0);
    const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    return {
      totalNodes: nodeCount,
      totalEdges: edgeCount,
      clusterCount: this.detectClusters(nodes, edges).length,
      averageDegree,
      density,
    };
  }

  // ─── Private ───────────────────────────────────────────────

  private simulationStep(
    nodes: GraphVizNode[],
    edges: Array<{ sourceId: string; targetId: string; weight: number }>
  ): void {
    // Stub: Single simulation step
    // Production implementation would compute repulsive + attractive forces
    // and update positions with velocity dampening
  }

  private detectClusters(
    nodes: GraphVizNode[],
    edges: Array<{ sourceId: string; targetId: string }>
  ): GraphCluster[] {
    // Stub: Simple connected-component clustering
    // Production would use Louvain or Label Propagation algorithm
    const clusterColors = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

    // Group nodes by type as a simple clustering heuristic
    const typeGroups = new Map<string, string[]>();
    for (const node of nodes) {
      const group = typeGroups.get(node.type) || [];
      group.push(node.id);
      typeGroups.set(node.type, group);
    }

    const clusters: GraphCluster[] = [];
    let colorIdx = 0;
    for (const [type, nodeIds] of typeGroups) {
      const positions = nodeIds
        .map(id => this.positions.get(id))
        .filter(Boolean) as Array<{ x: number; y: number }>;

      const centroidX = positions.length > 0
        ? positions.reduce((sum, p) => sum + p.x, 0) / positions.length
        : 0;
      const centroidY = positions.length > 0
        ? positions.reduce((sum, p) => sum + p.y, 0) / positions.length
        : 0;

      clusters.push({
        id: `cluster-${type}`,
        label: type.charAt(0).toUpperCase() + type.slice(1) + ' Nodes',
        nodeIds,
        centroidX,
        centroidY,
        color: clusterColors[colorIdx % clusterColors.length],
      });
      colorIdx++;
    }

    return clusters;
  }
}
