export type NodeType = 'Person' | 'Project' | 'Repository' | 'Task' | 'File' | 'Meeting' | 'Goal' | 'Preference';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  properties: Record<string, any>;
  timestamp: number;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string; // e.g., 'CREATED', 'DEPENDS_ON', 'ASSIGNED_TO'
  weight: number;
  confidence: number;
  timestamp: number;
}
