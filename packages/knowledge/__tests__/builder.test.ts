import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphBuilder } from '../src/builder';
import { SQLiteStorage, CoreLogger } from '@aios/core';
import { IMemoryClient } from '@aios/types';

describe('GraphBuilder', () => {
  let db: SQLiteStorage;
  let logger: CoreLogger;
  let memoryClient: IMemoryClient;
  let builder: GraphBuilder;

  beforeEach(() => {
    db = {
      run: vi.fn(),
      query: vi.fn(),
    } as unknown as SQLiteStorage;
    logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as CoreLogger;
    memoryClient = {
      search: vi.fn(),
      add: vi.fn(),
    } as unknown as IMemoryClient;
    builder = new GraphBuilder(db, logger, memoryClient);
  });

  it('should initialize schema', () => {
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS graph_nodes'));
  });

  it('should add node and trigger incremental index update', async () => {
    const node = { id: 'n1', type: 'person', label: 'Alice', properties: { age: 30 }, timestamp: new Date() };
    await builder.addNode(node);

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO graph_nodes'),
      [node.id, node.type, node.label, JSON.stringify(node.properties), node.timestamp]
    );

    expect(memoryClient.add).toHaveBeenCalledWith(expect.objectContaining({
      id: 'node_n1',
      metadata: { type: 'GRAPH_NODE', nodeId: 'n1', nodeType: 'person' }
    }));
  });

  it('should add edge', () => {
    const edge = { id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'knows', weight: 1.0, confidence: 1.0, timestamp: new Date() };
    builder.addEdge(edge);

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO graph_edges'),
      [edge.id, edge.sourceId, edge.targetId, edge.type, edge.weight, edge.confidence, edge.timestamp]
    );
  });

  it('should retrieve semantic context', async () => {
    vi.mocked(memoryClient.search).mockResolvedValue([
      { metadata: { type: 'GRAPH_NODE', nodeId: 'n1' } }
    ]);

    vi.mocked(db.query).mockImplementation((query: string, params: any) => {
      if (query.includes('graph_nodes')) {
        return [{ columns: ['id', 'type', 'label', 'properties', 'timestamp'], values: [['n1', 'person', 'Alice', '{}', Date.now()]] }];
      }
      if (query.includes('graph_edges')) {
        return [{ columns: ['id', 'source_id', 'target_id', 'type', 'weight', 'confidence', 'timestamp'], values: [['e1', 'n1', 'n2', 'knows', 1, 1, Date.now()]] }];
      }
      return [];
    });

    const context = await builder.retrieveSemanticContext('who is alice');
    
    expect(memoryClient.search).toHaveBeenCalledWith({ query: 'who is alice', limit: 5 });
    expect(context.nodes.length).toBe(1);
    expect(context.edges.length).toBe(1);
    expect(context.nodes[0].id).toBe('n1');
    expect(context.edges[0].sourceId).toBe('n1');
  });
});
