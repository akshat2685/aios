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

    // Stub: In production, this would:
    // 1. Compare local version vector with peer's version vector
    // 2. Collect changed nodes/edges since manifest.lastSyncAt
    // 3. Filter through sharing policy
    // 4. Send changes via federation protocol
    // 5. Receive and merge peer's changes using CRDT merge rules
    // 6. Update manifest with new sync timestamp and version vector

    manifest.lastSyncAt = Date.now();
    this.manifests.set(peerId, manifest);

    this.logger.info(`Sync completed with peer ${peerId}`);

    return {
      nodesSent: 0,
      nodesReceived: 0,
      edgesSent: 0,
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
      // Check sharing policy
      if (!this.isNodeShareable(node)) {
        rejected++;
        continue;
      }

      // Stub: CRDT merge
      // In production, compare timestamps and version vectors
      // to determine which version wins
      // For LWW-Register: newer timestamp wins
      accepted++;
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
      // Stub: CRDT OR-Set merge (add-wins semantics)
      accepted++;
    }

    return { accepted, rejected };
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
