import { CoreLogger } from '@aios/core';

export interface ScheduledTask {
  id: string;
  name: string;
  intervalMs: number;
  execute: () => Promise<void>;
  lastRun?: number;
  isRunning?: boolean;
}

export class SchedulerEngine {
  private tasks: Map<string, ScheduledTask> = new Map();
  private logger: CoreLogger;
  private timer?: NodeJS.Timeout;

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  public registerTask(task: ScheduledTask) {
    this.logger.info(`Registering scheduled task: ${task.name} (${task.id})`);
    this.tasks.set(task.id, task);
  }

  public start() {
    this.logger.info('Starting SchedulerEngine...');
    this.timer = setInterval(() => this.tick(), 1000 * 60); // Check every minute
    // Run immediately once
    this.tick();
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.logger.info('Stopped SchedulerEngine.');
  }

  private async tick() {
    const now = Date.now();
    for (const task of this.tasks.values()) {
      if (task.isRunning) continue;

      if (!task.lastRun || now - task.lastRun >= task.intervalMs) {
        this.runTask(task);
      }
    }
  }

  private async runTask(task: ScheduledTask) {
    task.isRunning = true;
    try {
      this.logger.info(`Running scheduled task: ${task.name}`);
      await task.execute();
      task.lastRun = Date.now();
    } catch (e: any) {
      this.logger.error(`Task ${task.name} failed: ${e.message}`);
    } finally {
      task.isRunning = false;
    }
  }
}
