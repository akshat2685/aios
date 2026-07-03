import { CoreLogger } from '@aios/core';
import { Workflow, TriggerData, FileWatchTriggerConfig, CronTriggerConfig, EventTriggerConfig } from '@aios/types';
import chokidar from 'chokidar';
import cron from 'node-cron';
import { EventEmitter } from 'events';
import path from 'path';

export class TriggerManager {
  private activeCrons: Map<string, cron.ScheduledTask> = new Map();
  private activeWatchers: Map<string, chokidar.FSWatcher> = new Map();
  private lastTriggered: Map<string, number> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private globalEventBus: EventEmitter;
  private logger: CoreLogger;
  private onWorkflowTriggered: (workflowId: string, triggerData: TriggerData, sourceWorkflowId?: string) => void;

  constructor(
    logger: CoreLogger, 
    globalEventBus: EventEmitter, 
    onWorkflowTriggered: (workflowId: string, triggerData: TriggerData, sourceWorkflowId?: string) => void
  ) {
    this.logger = logger;
    this.globalEventBus = globalEventBus;
    this.onWorkflowTriggered = onWorkflowTriggered;

    // Listen to global events for event triggers
    this.globalEventBus.on('system.event', (eventName: string, payload: any) => {
      this.handleSystemEvent(eventName, payload);
    });
  }

  // Workflows pass themselves here to be registered for triggers
  private activeWorkflows: Map<string, Workflow> = new Map();

  registerWorkflowTriggers(workflow: Workflow) {
    this.activeWorkflows.set(workflow.id, workflow);
    this.stopWorkflowTriggers(workflow.id);

    if (!workflow.isActive || !workflow.trigger.enabled) {
      return;
    }

    try {
      switch (workflow.trigger.type) {
        case 'time':
          this.setupCronTrigger(workflow);
          break;
        case 'pattern':
          this.setupFileWatcherTrigger(workflow);
          break;
        case 'event':
          // Event triggers are inherently handled by listening to globalEventBus and mapping activeWorkflows
          this.logger.info(`Registered Event trigger for workflow ${workflow.name}`);
          break;
        case 'manual':
          this.logger.info(`Registered Manual trigger for workflow ${workflow.name}`);
          break;
        default:
          this.logger.warn(`Unknown trigger type ${workflow.trigger.type} for workflow ${workflow.id}`);
      }
    } catch (e: any) {
      this.logger.error(`Failed to register triggers for workflow ${workflow.id}: ${e.message}`);
    }
  }

  stopWorkflowTriggers(workflowId: string) {
    // Stop Cron
    const job = this.activeCrons.get(workflowId);
    if (job) {
      job.stop();
      this.activeCrons.delete(workflowId);
    }

    // Stop File Watchers
    const watcher = this.activeWatchers.get(workflowId);
    if (watcher) {
      watcher.close();
      this.activeWatchers.delete(workflowId);
    }
    
    // Clear state
    this.activeWorkflows.delete(workflowId);
    
    // Cleanup debounces
    for (const [key, timer] of this.debounceTimers.entries()) {
      if (key.startsWith(`${workflowId}_`)) {
        clearTimeout(timer);
        this.debounceTimers.delete(key);
      }
    }
  }

  private setupCronTrigger(workflow: Workflow) {
    const config = workflow.trigger.config as CronTriggerConfig;
    if (!config || !config.cron) {
      throw new Error('CronTriggerConfig missing cron expression');
    }
    
    const job = cron.schedule(config.cron, () => {
      this.fireWorkflow(workflow, { timestamp: Date.now(), eventType: 'cron' });
    });
    this.activeCrons.set(workflow.id, job);
    this.logger.info(`Started cron watcher for workflow ${workflow.id} (${config.cron})`);
  }

  private isSafePath(targetPath: string): boolean {
    const normalized = path.normalize(targetPath).toLowerCase();
    const blockedPaths = [
      'c:\\',
      'c:\\windows',
      'c:\\users',
      'c:\\program files',
      'c:\\program files (x86)',
      '/',
      '/bin',
      '/etc',
      '/var',
      '/usr',
      '/sys'
    ];
    // Exact match or watching root of these is blocked
    for (const blocked of blockedPaths) {
      if (normalized === blocked || normalized === blocked + '\\' || normalized === blocked + '/') {
        return false;
      }
    }
    return true;
  }

  private setupFileWatcherTrigger(workflow: Workflow) {
    const config = workflow.trigger.config as FileWatchTriggerConfig;
    if (!config || !config.path) {
      throw new Error('FileWatchTriggerConfig missing path');
    }

    if (!this.isSafePath(config.path)) {
      throw new Error(`Path ${config.path} is blocked by safety guards`);
    }

    const watchTarget = config.pattern ? path.join(config.path, config.pattern) : config.path;
    const watcher = chokidar.watch(watchTarget, {
      ignored: config.ignorePatterns || /(^|[\/\\])\../, // ignore dotfiles by default
      persistent: true,
      depth: config.recursive ? undefined : 0,
      ignoreInitial: true,
    });

    const eventsToWatch = config.events && config.events.length > 0 ? config.events : ['add', 'change'];

    eventsToWatch.forEach(eventType => {
      watcher.on(eventType, (filePath) => {
        this.handleFileEvent(workflow, config, eventType, filePath);
      });
    });

    this.activeWatchers.set(workflow.id, watcher);
    this.logger.info(`Started file watcher for workflow ${workflow.id} on ${watchTarget}`);
  }

  private handleFileEvent(workflow: Workflow, config: FileWatchTriggerConfig, eventType: string, filePath: string) {
    const debounceMs = config.debounceMs ?? 1000;
    const debounceKey = `${workflow.id}_${eventType}`; // debounce by workflow and event type

    // Debounce Logic
    if (debounceMs > 0) {
      const existingTimer = this.debounceTimers.get(debounceKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      const timer = setTimeout(() => {
        this.debounceTimers.delete(debounceKey);
        this.processFileTrigger(workflow, config, eventType, filePath);
      }, debounceMs);
      
      this.debounceTimers.set(debounceKey, timer);
    } else {
      this.processFileTrigger(workflow, config, eventType, filePath);
    }
  }

  private processFileTrigger(workflow: Workflow, config: FileWatchTriggerConfig, eventType: string, filePath: string) {
    const cooldownMs = config.cooldownMs ?? 0;
    const now = Date.now();
    const cooldownKey = `${workflow.id}_${eventType}`;
    
    // Cooldown Logic
    if (cooldownMs > 0) {
      const last = this.lastTriggered.get(cooldownKey) || 0;
      if (now - last < cooldownMs) {
        this.logger.debug(`Trigger cooldown active for ${workflow.id}, dropping event`);
        return;
      }
    }
    
    this.lastTriggered.set(cooldownKey, now);

    const triggerData: TriggerData = {
      filePath,
      eventType,
      fileName: path.basename(filePath),
      extension: path.extname(filePath),
      timestamp: now
    };
    
    this.fireWorkflow(workflow, triggerData);
  }

  private handleSystemEvent(eventName: string, payload: any) {
    for (const [id, workflow] of this.activeWorkflows) {
      if (workflow.trigger.type === 'event' && workflow.isActive && workflow.trigger.enabled) {
        const config = workflow.trigger.config as EventTriggerConfig;
        if (config && config.eventName === eventName) {
           const triggerData: TriggerData = {
             eventType: eventName,
             timestamp: Date.now(),
             ...payload
           };
           this.fireWorkflow(workflow, triggerData);
        }
      }
    }
  }

  private fireWorkflow(workflow: Workflow, triggerData: TriggerData) {
    this.logger.info(`TriggerManager firing workflow ${workflow.id} from ${workflow.trigger.type}`);
    // Pass execution off to Engine
    this.onWorkflowTriggered(workflow.id, triggerData);
  }
}
