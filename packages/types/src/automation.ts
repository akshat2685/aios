export type TriggerType = 'time' | 'event' | 'pattern' | 'manual';

export interface AutomationTrigger {
  id: string;
  type: TriggerType;
  config: any; // Cron expression for time, event name for event, etc.
  enabled: boolean;
}

export interface AutomationAction {
  id: string;
  name: string;
  type: 'shell' | 'file' | 'api' | 'agent';
  params: any;
}

export interface WorkflowStep {
  id: string;
  action: AutomationAction;
  nextStepId?: string;
  condition?: string; // Simple boolean expression
}

export interface Workflow {
  id: string;
  name: string;
  description?: string; // Natural language description for Vector DB
  trigger: AutomationTrigger;
  steps: WorkflowStep[];
  isActive: boolean;
  uiData?: any; // ReactFlow positions and UI state
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  startTime: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: Record<string, any>;
}