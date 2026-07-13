import { CoreLogger } from '@aios/core';
import { Epic, Task } from './task-types';

export interface ITaskRouter {
  routeRequest(agentId: string, message: any, history?: any[]): Promise<{ message: string }>;
}

export class AutonomousTaskQueue {
  private logger: CoreLogger;
  private orchestrator: ITaskRouter;

  constructor(logger: CoreLogger, orchestrator: ITaskRouter) {
    this.logger = logger;
    this.orchestrator = orchestrator;
  }

  async executeEpic(epic: Epic): Promise<Epic> {
    this.logger.info(`AutonomousTaskQueue started executing epic: ${epic.id}`);
    epic.status = 'in_progress';

    const maxIterations = 50;
    let iterations = 0;

    while (iterations < maxIterations) {
      const pendingTasks = epic.tasks.filter(t => t.status === 'pending');
      if (pendingTasks.length === 0) {
        break; // All done or failed
      }

      // Find tasks whose dependencies are met
      const readyTasks = pendingTasks.filter(task => {
        if (!task.dependencies || task.dependencies.length === 0) return true;
        
        return task.dependencies.every(depId => {
          const depTask = epic.tasks.find(t => t.id === depId);
          return depTask && depTask.status === 'completed';
        });
      });

      if (readyTasks.length === 0) {
        // Cyclic dependencies or failed dependencies
        this.logger.error(`Deadlock detected in Epic ${epic.id}. No ready tasks.`);
        epic.status = 'failed';
        return epic;
      }

      // Execute ready tasks concurrently
      const promises = readyTasks.map(task => this.executeTask(task, epic));
      await Promise.all(promises);

      iterations++;
    }

    const allCompleted = epic.tasks.every(t => t.status === 'completed');
    epic.status = allCompleted ? 'completed' : 'failed';
    
    this.logger.info(`AutonomousTaskQueue finished epic: ${epic.id} with status: ${epic.status}`);
    return epic;
  }

  private async executeTask(task: Task, epic: Epic): Promise<void> {
    this.logger.info(`Executing Task ${task.id}: ${task.title} (assigned to ${task.assignedAgent})`);
    task.status = 'in_progress';

    try {
      const context = `[EPIC GOAL]\n${epic.goal}\n\n[TASK DEPENDENCIES]\n${
        task.dependencies.map(d => {
          const dep = epic.tasks.find(t => t.id === d);
          return dep ? `- ${dep.title}:\n${dep.result}` : '';
        }).join('\n')
      }\n\n[TASK INSTRUCTION]\n${task.description}`;

      const response = await this.orchestrator.routeRequest(task.assignedAgent || 'assistant', {
        role: 'user',
        content: context,
        timestamp: Date.now()
      });

      task.result = response.message;
      task.status = 'completed';
      this.logger.info(`Task ${task.id} completed.`);
    } catch (e: any) {
      this.logger.error(`Task ${task.id} failed: ${e.message}`);
      task.status = 'failed';
    }
  }
}
