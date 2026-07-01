import cron from 'node-cron';
import { CoreLogger } from '@aios/core';
import { Workflow, WorkflowExecution, WorkflowStep } from '@aios/types';
import { ActionLibrary } from './action-library';

export class AutomationEngine {
  private workflows: Map<string, Workflow> = new Map();
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();
  private logger: CoreLogger;
  private actions: ActionLibrary;

  constructor(logger: CoreLogger) {
    this.logger = logger;
    this.actions = new ActionLibrary(logger);
  }

  async registerWorkflow(workflow: Workflow) {
    this.workflows.set(workflow.id, workflow);
    this.logger.info(`Workflow registered: ${workflow.name} (${workflow.name})`);
    
    if (workflow.isActive) {
      this.scheduleWorkflow(workflow);
    }
  }

  private scheduleWorkflow(workflow: Workflow) {
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