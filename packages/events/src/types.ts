export type AIOSEventType =
  | 'AgentTaskCompleted'
  | 'MemoryUpdated'
  | 'WorkspaceChanged'
  | 'RouterDecisionMade'
  | 'ContextGenerated'
  | 'ToolExecuted'
  | 'ErrorOccurred';

export interface AIOSEvent<T = any> {
  type: AIOSEventType;
  payload: T;
  timestamp: number;
}

export interface EventBusListener {
  (event: AIOSEvent): void | Promise<void>;
}
