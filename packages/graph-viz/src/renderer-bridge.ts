import { CoreLogger } from '@aios/core';
import {
  GraphVizNode,
  GraphVizEdge,
  GraphFilter,
  GraphVizConfig,
  GraphSnapshot,
} from '@aios/types';
import { GraphQueryEngine } from './query-engine';
import { GraphLayoutEngine } from './layout-engine';

/**
 * GraphRendererBridge — IPC bridge between the main-process graph data engine
 * and the Electron renderer process. Sends serialized graph snapshots to the
 * renderer and handles UI interaction events.
 */
export class GraphRendererBridge {
  private logger: CoreLogger;
  private queryEngine: GraphQueryEngine;
  private layoutEngine: GraphLayoutEngine;
  private config: GraphVizConfig;
  private currentSnapshot: GraphSnapshot | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(
    logger: CoreLogger,
    queryEngine: GraphQueryEngine,
    layoutEngine: GraphLayoutEngine,
    config?: Partial<GraphVizConfig>
  ) {
    this.logger = logger;
    this.queryEngine = queryEngine;
    this.layoutEngine = layoutEngine;
    this.config = {
      layout: 'force-directed',
      showLabels: true,
      showEdgeLabels: false,
      particleEffects: true,
      clusterHighlight: true,
      maxVisibleNodes: 500,
      ...config,
    };
  }

  /**
   * Generate a full graph snapshot for the renderer.
   * Called on initial load and when filters change.
   */
  public async generateSnapshot(filter?: GraphFilter): Promise<GraphSnapshot> {
    this.logger.info('Generating graph snapshot for renderer');

    const { nodes, edges } = await this.queryEngine.queryGraph(filter);

    // Limit visible nodes
    const visibleNodes = nodes.slice(0, this.config.maxVisibleNodes);
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = edges.filter(
      e => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId)
    );

    // Compute layout
    const layout = this.layoutEngine.computeLayout(
      visibleNodes,
      visibleEdges.map(e => ({ sourceId: e.sourceId, targetId: e.targetId, weight: e.weight }))
    );

    // Apply layout positions to nodes
    for (const node of visibleNodes) {
      const pos = layout.positions[node.id];
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
      }
    }

    const stats = this.layoutEngine.computeStats(visibleNodes, visibleEdges);

    this.currentSnapshot = {
      nodes: visibleNodes,
      edges: visibleEdges,
      layout,
      stats,
    };

    this.emit('snapshot:updated', this.currentSnapshot);
    this.logger.info(`Snapshot generated: ${stats.totalNodes} nodes, ${stats.totalEdges} edges`);

    return this.currentSnapshot;
  }

  /**
   * Generate an incremental diff update instead of a full snapshot.
   * More efficient for live-streaming graph changes.
   */
  public async generateDiffUpdate(): Promise<{
    addedNodes: GraphVizNode[];
    removedNodeIds: string[];
    addedEdges: GraphVizEdge[];
    removedEdgeIds: string[];
  }> {
    this.logger.debug('Generating incremental diff update');

    // Stub: Compare current graph state against last snapshot
    // Return only the delta
    return {
      addedNodes: [],
      removedNodeIds: [],
      addedEdges: [],
      removedEdgeIds: [],
    };
  }

  /**
   * Handle node click event from the renderer.
   */
  public async onNodeClick(nodeId: string): Promise<{
    node: GraphVizNode | null;
    neighbors: GraphVizNode[];
    edges: GraphVizEdge[];
  }> {
    this.logger.debug(`Node clicked: ${nodeId}`);

    const { nodes: neighbors, edges } = await this.queryEngine.getNeighborhood(nodeId, 1);
    const node = this.currentSnapshot?.nodes.find(n => n.id === nodeId) || null;

    return { node, neighbors, edges };
  }

  /**
   * Handle node drag event — update position in the layout engine.
   */
  public onNodeDrag(nodeId: string, x: number, y: number): void {
    // Update position in layout engine's internal state
    const positions = this.layoutEngine.serializePositions();
    positions[nodeId] = { x, y };
    this.layoutEngine.restorePositions(positions);
  }

  /**
   * Update visualization config from UI controls.
   */
  public updateConfig(updates: Partial<GraphVizConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config:updated', this.config);
    this.logger.debug('Graph viz config updated');
  }

  /**
   * Get the current visualization config.
   */
  public getConfig(): GraphVizConfig {
    return { ...this.config };
  }

  // ─── Event Emitter ─────────────────────────────────────────

  public on(event: string, listener: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off(event: string, listener: (data: any) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(listener => listener(data));
  }
}
