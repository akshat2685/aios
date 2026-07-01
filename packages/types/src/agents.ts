export interface AgentTool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  execute: (args: any) => Promise<any>;
}

export interface AgentState {
  id: string;
  name: string;
  role: string;
  memoryId?: string;
  currentGoal?: string;
  status: 'idle' | 'thinking' | 'executing' | 'awaiting_approval';
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  message: string;
  toolCalls?: Array<{
    tool: string;
    args: any;
    id: string;
  }>;
  done: boolean;
}