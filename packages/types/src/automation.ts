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
  trigger: AutomationTrigger;
  steps: WorkflowStep[];
  isActive: boolean;
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  startTime: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: Record<string, any>;
}