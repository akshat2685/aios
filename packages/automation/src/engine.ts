import cron from 'node-cron';
import { CoreLogger } from '@aios/core';
import { Workflow, WorkflowExecution, WorkflowStep, WorkflowContext, WorkflowCheckpoint } from '@aios/types';
import { ActionLibrary } from './action-library';
import { MemoryClient } from '@aios/memory';
import { EventEmitter } from 'events';
import { TriggerManager } from './trigger-manager';
import { TriggerData } from '@aios/types';
import jexl from 'jexl';

export class AutomationEngine extends EventEmitter {
  private workflows: Map<string, Workflow> = new Map();
  private logger: CoreLogger;
  private actions: ActionLibrary;
  private memoryClient: MemoryClient;
  private cancelledExecutions: Set<string> = new Set();
  private triggerManager: TriggerManager;

  constructor(logger: CoreLogger) {
    super();
    this.logger = logger;
    this.actions = new ActionLibrary(logger);
    this.memoryClient = new MemoryClient();
    this.triggerManager = new TriggerManager(
       logger, 
       this, // EventBus is Engine itself for now
       (workflowId, triggerData, sourceWorkflowId) => {
         this.executeWorkflow(workflowId, triggerData, sourceWorkflowId).catch(e => {
            this.logger.error(`Trigger execution failed for ${workflowId}: ${e.message}`);
         });
       }
    );
  }

  async init() {
    this.logger.info('Initializing AutomationEngine and loading workflows from Memory (Qdrant)...');
    try {
      await this.memoryClient.init();
      await this.loadWorkflowsFromMemory();
      await this.resumeCheckpoints();
    } catch (e: any) {
      this.logger.error(`Failed to initialize memory client in AutomationEngine: ${e.message}`);
    }
  }

  private async loadWorkflowsFromMemory() {
    try {
      const records = await this.memoryClient.search({
        query: 'workflow definition',
        filter: { must: [{ key: 'type', match: { value: 'workflow' } }] },
        limit: 1000,
      });

      this.logger.info(`Found ${records.length} workflows in memory.`);
      for (const record of records) {
        if (record.metadata && record.metadata.workflow) {
          const wf = record.metadata.workflow as Workflow;
          this.workflows.set(wf.id, wf);
          if (wf.isActive) {
            this.triggerManager.registerWorkflowTriggers(wf);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to load workflows: ${error.message}`);
    }
  }

  private async resumeCheckpoints() {
    try {
      const records = await this.memoryClient.search({
        query: 'workflow checkpoint',
        filter: { must: [{ key: 'type', match: { value: 'checkpoint' } }] },
        limit: 100,
      });

      for (const record of records) {
        if (record.metadata && record.metadata.checkpoint) {
          const cp = record.metadata.checkpoint as WorkflowCheckpoint;
          if (cp.status === 'running' || cp.status === 'pending') {
            this.logger.info(`Resuming crashed execution ${cp.executionId} at step ${cp.currentStepId}`);
            // Fire and forget
            this.runStateMachine(cp.workflowId, cp.executionId, cp.currentStepId, cp.context).catch(e => {
              this.logger.error(`Failed to resume execution ${cp.executionId}: ${e.message}`);
            });
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to load checkpoints: ${error.message}`);
    }
  }

  async registerWorkflow(workflow: Workflow) {
    this.workflows.set(workflow.id, workflow);
    this.logger.info(`Workflow registered: ${workflow.name} (${workflow.id})`);
    
    try {
      const description = workflow.description || `Workflow ${workflow.name}`;
      await this.memoryClient.add({
        id: workflow.id,
        type: 'workflow',
        content: description,
        metadata: { workflow: workflow },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      this.logger.info(`Workflow ${workflow.name} saved to Qdrant Memory.`);
    } catch (e: any) {
      this.logger.error(`Failed to save workflow to memory: ${e.message}`);
    }

    if (workflow.isActive) {
      this.triggerManager.registerWorkflowTriggers(workflow);
    } else {
      this.triggerManager.stopWorkflowTriggers(workflow.id);
    }
  }

  async deleteWorkflow(workflowId: string) {
    this.triggerManager.stopWorkflowTriggers(workflowId);
    this.workflows.delete(workflowId);
    try {
      await this.memoryClient.delete(workflowId);
      this.logger.info(`Deleted workflow ${workflowId} from memory.`);
    } catch (e: any) {
      this.logger.error(`Failed to delete workflow from memory: ${e.message}`);
    }
  }

  getWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  cancelExecution(executionId: string) {
    this.cancelledExecutions.add(executionId);
    this.logger.info(`Requested cancellation for execution ${executionId}`);
  }

  async executeWorkflow(workflowId: string, triggerData: TriggerData = { timestamp: Date.now() }, sourceWorkflowId?: string): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    let depth = 0;
    if (triggerData && typeof triggerData.executionDepth === 'number') {
      depth = triggerData.executionDepth + 1;
    }
    
    if (depth >= 5) {
      this.logger.error(`Workflow ${workflowId} blocked by loop protection (depth >= 5).`);
      return {
        executionId: 'blocked',
        workflowId,
        startTime: Date.now(),
        status: 'failed',
        results: { error: 'MAX_RECURSION_DEPTH_EXCEEDED' }
      };
    }

    const executionId = Math.random().toString(36).substring(7);
    const context: WorkflowContext = {
      workflowId,
      executionId,
      triggerData,
      results: {},
      variables: {},
      metadata: { startTime: Date.now(), retries: 0, executionDepth: depth, sourceWorkflowId }
    };

    if (workflow.steps.length === 0) {
       return { executionId, workflowId, startTime: Date.now(), status: 'completed', results: {} };
    }

    this.emit('workflow.started', { executionId, workflowId });
    
    // Start State Machine
    // We do not await this, we return the initial execution state immediately
    // or wait for the entire machine depending on usage. We will await it for simplicity in CLI.
    const executionStatus = await this.runStateMachine(workflowId, executionId, workflow.steps[0].id, context);
    
    return {
      executionId,
      workflowId,
      startTime: context.metadata.startTime,
      status: executionStatus,
      results: context.results
    };
  }

  private async saveCheckpoint(workflowId: string, executionId: string, currentStepId: string, status: WorkflowExecution['status'], context: WorkflowContext) {
    const cp: WorkflowCheckpoint = {
      executionId,
      workflowId,
      status,
      currentStepId,
      context,
      updatedAt: Date.now()
    };
    try {
      await this.memoryClient.add({
        id: `cp_${executionId}`,
        type: 'checkpoint',
        content: `Checkpoint for execution ${executionId}`,
        metadata: { checkpoint: cp },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } catch (e: any) {
      this.logger.warn(`Failed to save checkpoint for ${executionId}: ${e.message}`);
    }
  }

  private async executeActionWithTimeoutAndRetries(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    let retries = 0;
    const maxRetries = step.retryPolicy?.maxRetries || 0;
    
    while (true) {
      try {
        let actionPromise = this.actions.executeAction(step.action, context);
        
        if (step.timeoutMs && step.timeoutMs > 0) {
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('STEP_TIMEOUT')), step.timeoutMs));
          actionPromise = Promise.race([actionPromise, timeoutPromise]) as Promise<any>;
        }
        
        return await actionPromise;
      } catch (error: any) {
        if (retries >= maxRetries) {
          throw error;
        }
        retries++;
        context.metadata.retries++;
        this.logger.warn(`Step ${step.id} failed, retrying (${retries}/${maxRetries})...`);
        if (step.retryPolicy?.delayMs) {
           const delay = step.retryPolicy.backoff === 'exponential' 
              ? step.retryPolicy.delayMs * Math.pow(2, retries - 1)
              : step.retryPolicy.delayMs;
           await new Promise(r => setTimeout(r, delay));
        }
      }
    }
  }

  private async runStateMachine(workflowId: string, executionId: string, initialStepId: string, context: WorkflowContext): Promise<WorkflowExecution['status']> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return 'failed';

    let currentStepId: string | undefined = initialStepId;
    let finalStatus: WorkflowExecution['status'] = 'completed';

    while (currentStepId) {
      if (this.cancelledExecutions.has(executionId)) {
        finalStatus = 'cancelled';
        break;
      }

      const step = workflow.steps.find(s => s.id === currentStepId);
      if (!step) {
        this.logger.error(`Step ${currentStepId} not found in workflow ${workflowId}`);
        finalStatus = 'failed';
        break;
      }

      await this.saveCheckpoint(workflowId, executionId, currentStepId, 'running', context);
      
      // Evaluate JEXL Condition
      if (step.condition) {
        try {
          const conditionPassed = await jexl.eval(step.condition, context);
          if (!conditionPassed) {
             this.logger.info(`Step ${step.id} condition falsy, skipping.`);
             this.emit('step.skipped', { executionId, stepId: step.id });
             currentStepId = step.nextStepId;
             continue;
          }
        } catch (err: any) {
          this.logger.error(`Error evaluating condition for step ${step.id}: ${err.message}`);
          finalStatus = 'failed';
          break;
        }
      }

      this.emit('step.started', { executionId, stepId: step.id, action: step.action.name });
      this.logger.debug(`Executing step ${step.id}: ${step.action.name}`);

      try {
        const result = await this.executeActionWithTimeoutAndRetries(step, context);
        context.results[step.id] = result;
        
        if (result && result.status === 'waiting_approval') {
           finalStatus = 'waiting_approval';
           this.emit('step.waiting_approval', { executionId, stepId: step.id });
           break; // Stop state machine, manual intervention required
        }

        this.emit('step.completed', { executionId, stepId: step.id, result });
        currentStepId = step.nextStepId;
      } catch (error: any) {
        this.logger.error(`Step ${step.id} failed: ${error.message}`);
        this.emit('step.failed', { executionId, stepId: step.id, error: error.message });
        
        context.results[step.id] = { error: error.message };
        
        if (error.message === 'STEP_TIMEOUT') {
           finalStatus = 'timed_out';
        } else {
           finalStatus = 'failed';
        }

        if (step.onFailureStepId) {
           this.logger.info(`Routing to failure step: ${step.onFailureStepId}`);
           currentStepId = step.onFailureStepId;
           finalStatus = 'running'; // Recovered
        } else {
           break; // Terminate execution
        }
      }
    }

    if (finalStatus !== 'waiting_approval') {
       if (finalStatus === 'cancelled') {
         this.emit('workflow.cancelled', { executionId, workflowId });
       } else if (finalStatus === 'failed' || finalStatus === 'timed_out') {
         this.emit('workflow.failed', { executionId, workflowId, results: context.results });
       } else {
         finalStatus = 'completed';
         this.emit('workflow.completed', { executionId, workflowId, results: context.results });
       }
    }

    await this.saveCheckpoint(workflowId, executionId, currentStepId || 'end', finalStatus, context);
    
    // Cleanup cancellations
    this.cancelledExecutions.delete(executionId);
    
    return finalStatus;
  }

  async stopWorkflow(workflowId: string) {
    this.triggerManager.stopWorkflowTriggers(workflowId);
  }

  async triggerEvent(eventName: string, payload: any) {
    this.logger.info(`Automation Engine: Triggering system event ${eventName}`);
    this.emit('system.event', eventName, payload);
  }
}