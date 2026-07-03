export type TriggerType = 'time' | 'event' | 'pattern' | 'manual';

export interface FileWatchTriggerConfig {
  path: string;
  pattern?: string;
  events: ('add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir')[];
  recursive?: boolean;
  debounceMs?: number; // default 1000
  cooldownMs?: number; // default 0
  ignorePatterns?: string[];
}

export interface CronTriggerConfig {
  cron: string;
}

export interface EventTriggerConfig {
  eventName: string;
}

export interface TriggerData {
  filePath?: string;
  eventType?: string;
  fileName?: string;
  extension?: string;
  timestamp: number;
  [key: string]: any;
}

export interface AutomationTrigger {
  id: string;
  type: TriggerType;
  config: FileWatchTriggerConfig | CronTriggerConfig | EventTriggerConfig | any;
  enabled: boolean;
}

export interface AutomationAction {
  id: string;
  name: string;
  type: 'shell' | 'file' | 'api' | 'agent' | 'variable' | 'approval';
  params: any;
}

export interface RetryPolicy {
  maxRetries: number;
  backoff: 'linear' | 'exponential';
  delayMs: number;
}

export interface WorkflowStep {
  id: string;
  action: AutomationAction;
  nextStepId?: string;
  onFailureStepId?: string;
  condition?: string; // JEXL expression
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
  executionMode?: 'sequential' | 'parallel';
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

export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  triggerData: TriggerData | any;
  results: Record<string, any>;
  variables: Record<string, any>;
  metadata: {
    startTime: number;
    retries: number;
    executionDepth: number;
    sourceWorkflowId?: string;
  };
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  startTime: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'timed_out' | 'cancelled' | 'waiting_approval';
  results: Record<string, any>;
}

export interface WorkflowCheckpoint {
  executionId: string;
  workflowId: string;
  status: WorkflowExecution['status'];
  currentStepId: string;
  context: WorkflowContext;
  updatedAt: number;
}