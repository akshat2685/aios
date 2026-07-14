import { SyncEngine } from './sync-engine';
import { GraphVizNode } from '@aios/types';

// Depending on your tsconfig and package links, you might import from '@aios/memory' 
// or directly if types are shared. 
export interface MemoryRecordLite {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface IMemoryClientLite {
  add(record: MemoryRecordLite): Promise<void>;
  update(recordId: string, updates: Partial<MemoryRecordLite>): Promise<void>;
}

/**
 * MemoryFederationIntegration bridges Qdrant Hybrid Memory models with the Federation SyncEngine.
 * Converts Qdrant MemoryRecords to GraphVizNodes for CRDT synchronization,
 * and vice-versa, allowing memories to propagate safely across the network.
 */
export class MemoryFederationIntegration {
  constructor(
    private memoryClient: IMemoryClientLite,
    private syncEngine: SyncEngine
  ) {}

  /**
   * Pushes memory records from Qdrant (local) to SyncEngine for federation.
   */
  public async pushMemoryToFederation(records: MemoryRecordLite[]): Promise<void> {
    const nodes: GraphVizNode[] = records.map(record => ({
      id: record.id,
      type: 'memory',
      label: record.content.length > 50 ? record.content.substring(0, 50) + '...' : record.content,
      properties: {
        content: record.content,
        metadata: record.metadata,
        originalType: record.type,
      },
      x: 0,
      y: 0,
      weight: 1,
      createdAt: record.createdAt,
      lastAccessedAt: record.updatedAt,
    }));

    this.syncEngine.mergeNodes(nodes);
  }

  /**
   * Pulls federated memory nodes from SyncEngine and inserts them into Qdrant.
   */
  public async pullMemoryFromFederation(nodes: GraphVizNode[]): Promise<void> {
    const memoryNodes = nodes.filter(n => n.type === 'memory');
    
    for (const node of memoryNodes) {
      const record: MemoryRecordLite = {
        id: node.id,
        type: node.properties?.originalType || 'federated_memory',
        content: node.properties?.content || node.label,
        metadata: {
          ...node.properties?.metadata,
          source: 'federation'
        },
        createdAt: node.createdAt,
        updatedAt: node.lastAccessedAt,
      };

      try {
        await this.memoryClient.add(record);
      } catch (err) {
        console.error(`Failed to ingest federated memory record ${record.id} into Qdrant:`, err);
      }
    }
  }
}
