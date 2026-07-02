import cron from 'node-cron';
import { CoreLogger } from '@aios/core';
import { Workflow, WorkflowExecution, WorkflowStep } from '@aios/types';
import { ActionLibrary } from './action-library';
import { MemoryClient } from '@aios/memory';

export class AutomationEngine {
  private workflows: Map<string, Workflow> = new Map();
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();
  private logger: CoreLogger;
  private actions: ActionLibrary;
  private memoryClient: MemoryClient;

  constructor(logger: CoreLogger) {
    this.logger = logger;
    this.actions = new ActionLibrary(logger);
    this.memoryClient = new MemoryClient();
  }

  async init() {
    this.logger.info('Initializing AutomationEngine and loading workflows from Memory (Qdrant)...');
    try {
      await this.memoryClient.init();
      await this.loadWorkflowsFromMemory();
    } catch (e: any) {
      this.logger.error(`Failed to initialize memory client in AutomationEngine: ${e.message}`);
    }
  }

  private async loadWorkflowsFromMemory() {
    try {
      // Find all records with type 'workflow'
      const records = await this.memoryClient.search({
        query: 'workflow definition', // semantic fallback if filter fails
        filter: {
          must: [
            {
              key: 'type',
              match: { value: 'workflow' }
            }
          ]
        },
        limit: 1000,
      });

      this.logger.info(`Found ${records.length} workflows in memory.`);
      for (const record of records) {
        if (record.metadata && record.metadata.workflow) {
          const wf = record.metadata.workflow as Workflow;
          this.workflows.set(wf.id, wf);
          if (wf.isActive) {
            this.scheduleWorkflow(wf);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to load workflows: ${error.message}`);
    }
  }

  async registerWorkflow(workflow: Workflow) {
    this.workflows.set(workflow.id, workflow);
    this.logger.info(`Workflow registered: ${workflow.name} (${workflow.id})`);
    
    // Save to memory
    try {
      const description = workflow.description || `Workflow ${workflow.name}`;
      await this.memoryClient.add({
        id: workflow.id,
        type: 'workflow',
        content: description,
        metadata: {
          workflow: workflow
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      this.logger.info(`Workflow ${workflow.name} saved to Qdrant Memory.`);
    } catch (e: any) {
      this.logger.error(`Failed to save workflow to memory: ${e.message}`);
    }

    if (workflow.isActive) {
      this.scheduleWorkflow(workflow);
    } else {
      await this.stopWorkflow(workflow.id);
    }
  }

  async deleteWorkflow(workflowId: string) {
    await this.stopWorkflow(workflowId);
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

  private scheduleWorkflow(workflow: Workflow) {
    // If there is an existing job, stop it first
    this.stopWorkflow(workflow.id);

    if (workflow.trigger.type === 'time' && workflow.trigger.config.cron) {
      const job = cron.schedule(workflow.trigger.config.cron, async () => {
        await this.executeWorkflow(workflow.id);
      });
      this.activeJobs.set(workflow.id, job);
      this.logger.info(`Scheduled workflow ${workflow.name} with cron ${workflow.trigger.config.cron}`);
    }
  }

  async executeWorkflow(workflowId: string): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const execution: WorkflowExecution = {
      executionId: Math.random().toString(36).substring(7),
      workflowId,
      startTime: Date.now(),
      status: 'running',
      results: {},
    };

    this.logger.info(`Executing workflow: ${workflow.name} [${execution.executionId}]`);

    try {
      for (const step of workflow.steps) {
        this.logger.debug(`Executing step ${step.id}: ${step.action.name}`);
        const result = await this.actions.executeAction(step.action);
        execution.results[step.id] = result;
      }
      execution.status = 'completed';
    } catch (error: any) {
      this.logger.error(`Workflow ${workflow.name} failed at step: ${error.message}`);
      execution.status = 'failed';
      execution.results.error = error.message;
    }

    return execution;
  }

  async stopWorkflow(workflowId: string) {
    const job = this.activeJobs.get(workflowId);
    if (job) {
      job.stop();
      this.activeJobs.delete(workflowId);
      this.logger.info(`Stopped workflow ${workflowId}`);
    }
  }

  async triggerEvent(eventName: string, payload: any) {
    this.logger.info(`Automation Engine: Triggering event ${eventName}`);
    for (const [id, workflow] of this.workflows) {
      if (workflow.isActive && workflow.trigger.type === 'event' && workflow.trigger.config?.eventName === eventName) {
        this.logger.info(`Automation Engine: Starting workflow "${workflow.name}" triggered by event "${eventName}"`);
        // In a real execution, we could inject payload data into step parameters
        await this.executeWorkflow(id);
      }
    }
  }
}