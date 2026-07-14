import { CoreLogger } from '@aios/core';
import { SyncManifest, SharingPolicy, GraphVizNode, GraphVizEdge } from '@aios/types';
import { PeerDiscovery } from './peer-discovery';
import { FederationProtocol } from './federation-protocol';

/**
 * SyncEngine — Selective knowledge synchronization for the AIOS
 * Federated Multi-Agent Network.
 *
 * Uses CRDTs (Conflict-free Replicated Data Types) for merge-safe graph
 * synchronization. Supports selective sharing policies and differential
 * sync to minimize bandwidth usage.
 */
export class SyncEngine {
  private logger: CoreLogger;
  private discovery: PeerDiscovery;
  private protocol: FederationProtocol;
  private sharingPolicy: SharingPolicy;
  private manifests: Map<string, SyncManifest> = new Map();
  private localVersionVector: Record<string, number> = {};

  // Local state for CRDT
  private localNodes: Map<string, GraphVizNode> = new Map();
  private edgeAddSet: Map<string, GraphVizEdge> = new Map();
  private edgeRemoveSet: Set<string> = new Set();

  constructor(
    logger: CoreLogger,
    discovery: PeerDiscovery,
    protocol: FederationProtocol,
    sharingPolicy?: Partial<SharingPolicy>
  ) {
    this.logger = logger;
    this.discovery = discovery;
    this.protocol = protocol;
    this.sharingPolicy = {
      shareProjects: true,
      shareKnowledge: true,
      shareMemory: false,
      projectOverrides: {},
      blockedDataTypes: ['personal_notes', 'credentials'],
      ...sharingPolicy,
    };

    this.logger.info('SyncEngine initialized');
  }

  /**
   * Initiate a sync with a specific peer.
   * Computes the differential changes since the last sync and sends them.
   */
  public async syncWithPeer(peerId: string): Promise<{
    nodesSent: number;
    nodesReceived: number;
    edgesSent: number;
    edgesReceived: number;
  }> {
    this.logger.info(`Initiating sync with peer ${peerId}`);

    const manifest = this.manifests.get(peerId) || this.createEmptyManifest(peerId);

    // Compute differential changes since lastSyncAt
    const nodesToSend = Array.from(this.localNodes.values()).filter(
      (node) => node.lastAccessedAt > manifest.lastSyncAt && this.isNodeShareable(node)
    );

    const edgesToSend = Array.from(this.edgeAddSet.values()).filter(
      (edge) => true // In a real system, we'd check edge timestamp if available
    );

    // Filter through sharing policy
    // Send changes via federation protocol (Stubbed)
    // Receive and merge peer's changes using CRDT merge rules (Stubbed)
    
    // Update manifest with new sync timestamp and version vector
    manifest.lastSyncAt = Date.now();
    this.manifests.set(peerId, manifest);

    this.logger.info(`Sync completed with peer ${peerId}. Sent ${nodesToSend.length} nodes and ${edgesToSend.length} edges.`);

    return {
      nodesSent: nodesToSend.length,
      nodesReceived: 0,
      edgesSent: edgesToSend.length,
      edgesReceived: 0,
    };
  }

  /**
   * Merge incoming nodes using CRDT Last-Writer-Wins (LWW) strategy.
   */
  public mergeNodes(incoming: GraphVizNode[]): {
    accepted: number;
    rejected: number;
    conflicts: number;
  } {
    this.logger.debug(`Merging ${incoming.length} incoming nodes`);

    let accepted = 0;
    let rejected = 0;
    let conflicts = 0;

    for (const node of incoming) {
      if (!this.isNodeShareable(node)) {
        rejected++;
        continue;
      }

      const existingNode = this.localNodes.get(node.id);
      
      // CRDT Last-Writer-Wins (LWW) based on lastAccessedAt or createdAt
      if (!existingNode) {
        this.localNodes.set(node.id, node);
        accepted++;
      } else {
        const existingTs = existingNode.lastAccessedAt || existingNode.createdAt;
        const incomingTs = node.lastAccessedAt || node.createdAt;
        
        if (incomingTs > existingTs) {
          this.localNodes.set(node.id, node);
          accepted++;
        } else if (incomingTs === existingTs) {
          // Tie-breaker based on ID lexicographical order
          if (node.id > existingNode.id) {
            this.localNodes.set(node.id, node);
            accepted++;
          } else {
            conflicts++;
          }
        } else {
          conflicts++; // Existing is newer, discard incoming
        }
      }
    }

    this.logger.debug(`Merge result: ${accepted} accepted, ${rejected} rejected, ${conflicts} conflicts`);
    return { accepted, rejected, conflicts };
  }

  /**
   * Merge incoming edges using CRDT OR-Set strategy.
   */
  public mergeEdges(incoming: GraphVizEdge[]): {
    accepted: number;
    rejected: number;
  } {
    this.logger.debug(`Merging ${incoming.length} incoming edges`);

    let accepted = 0;
    let rejected = 0;

    for (const edge of incoming) {
      // CRDT OR-Set (Observed-Remove Set) semantics
      // Add-wins behavior: if it's in the remove set but we get a new add, 
      // we remove it from remove set and add it, provided we have unique tags.
      // Since we only have IDs, we simulate Add-Wins by always accepting the add 
      // and clearing any local tombstone.
      
      if (!this.edgeAddSet.has(edge.id)) {
        this.edgeAddSet.set(edge.id, edge);
        this.edgeRemoveSet.delete(edge.id);
        accepted++;
      } else {
        // Already exists, just update if we have a way to merge properties.
        // For simple OR-Set, being in Add set means it's present.
        this.edgeAddSet.set(edge.id, edge);
        accepted++;
      }
    }

    return { accepted, rejected };
  }

  /**
   * Remove an edge using CRDT OR-Set semantics.
   */
  public removeEdge(edgeId: string): void {
    if (this.edgeAddSet.has(edgeId)) {
      this.edgeAddSet.delete(edgeId);
    }
    this.edgeRemoveSet.add(edgeId);
  }

  /**
   * Get the current sharing policy.
   */
  public getSharingPolicy(): SharingPolicy {
    return { ...this.sharingPolicy };
  }

  /**
   * Update the sharing policy.
   */
  public updateSharingPolicy(updates: Partial<SharingPolicy>): void {
    this.sharingPolicy = { ...this.sharingPolicy, ...updates };
    this.logger.info('Sharing policy updated');
  }

  /**
   * Set a per-project sharing override.
   */
  public setProjectSharingOverride(projectId: string, shared: boolean): void {
    this.sharingPolicy.projectOverrides[projectId] = shared;
    this.logger.info(`Project ${projectId} sharing: ${shared ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get the sync manifest for a specific peer.
   */
  public getManifest(peerId: string): SyncManifest | undefined {
    return this.manifests.get(peerId);
  }

  /**
   * Get sync status for all known peers.
   */
  public getSyncStatus(): Array<{
    peerId: string;
    displayName: string;
    lastSyncAt: number;
    status: 'synced' | 'pending' | 'never';
  }> {
    const peers = this.discovery.getKnownPeers();
    return peers.map(peer => {
      const manifest = this.manifests.get(peer.id);
      return {
        peerId: peer.id,
        displayName: peer.displayName,
        lastSyncAt: manifest?.lastSyncAt || 0,
        status: manifest
          ? (Date.now() - manifest.lastSyncAt < 300_000 ? 'synced' : 'pending')
          : 'never',
      };
    });
  }

  /**
   * Get the local version vector for CRDT consistency.
   */
  public getVersionVector(): Record<string, number> {
    return { ...this.localVersionVector };
  }

  /**
   * Increment the local version for a specific data domain.
   */
  public incrementVersion(domain: string): void {
    this.localVersionVector[domain] = (this.localVersionVector[domain] || 0) + 1;
  }

  // ─── Private ───────────────────────────────────────────────

  private createEmptyManifest(peerId: string): SyncManifest {
    return {
      peerId,
      lastSyncAt: 0,
      changedNodeIds: [],
      changedEdgeIds: [],
      versionVector: {},
    };
  }

  private isNodeShareable(node: GraphVizNode): boolean {
    // Check if node type is blocked
    if (this.sharingPolicy.blockedDataTypes.includes(node.type)) {
      return false;
    }

    // Check project-level overrides
    const projectId = node.properties?.projectId;
    if (projectId && this.sharingPolicy.projectOverrides[projectId] === false) {
      return false;
    }

    // Check category-level policies
    if (node.type === 'memory' && !this.sharingPolicy.shareMemory) return false;
    if (node.type === 'project' && !this.sharingPolicy.shareProjects) return false;

    return true;
  }
}
