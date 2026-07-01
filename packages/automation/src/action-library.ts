import { CoreLogger } from '@aios/core';
import { AutomationAction, Workflow, WorkflowExecution } from '@aios/types';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class ActionLibrary {
  private logger: CoreLogger;

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  async executeAction(action: AutomationAction): Promise<any> {
    this.logger.info(`Executing action ${action.name} (${action.type})`);

    switch (action.type) {
      case 'shell':
        return await this.runShell(action.params.command);
      case 'file':
        return await this.runFileOp(action.params);
      case 'api':
        return await this.runApiCall(action.params);
      case 'agent':
        return { status: 'delegated', message: 'Action routed to agent' };
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  private async runShell(command: string): Promise<any> {
    try {
      const { stdout, stderr } = await execPromise(command);
      return { stdout, stderr };
    } catch (error: any) {
      this.logger.error(`Shell action failed: ${error.message}`);
      throw error;
    }
  }

  private async runFileOp(params: { op: 'copy' | 'move' | 'delete' | 'write', src?: string, dest?: string, content?: string }): Promise<any> {
    try {
      switch (params.op) {
        case 'copy': return await fs.copy(params.src!, params.dest!);
        case 'move': return await fs.move(params.src!, params.dest!);
        case 'delete': return await fs.remove(params.src!);
        case 'write': return await fs.writeFile(params.dest!, params.content!);
      }
    } catch (error: any) {
      this.logger.error(`File operation ${params.op} failed: ${error.message}`);
      throw error;
    }
  }

  private async runApiCall(params: { url: string, method: string, body?: any, headers?: any }): Promise<any> {
    const response = await fetch(params.url, {
      method: params.method,
      body: params.body ? JSON.stringify(params.body) : undefined,
      headers: { 'Content-Type': 'application/json', ...params.headers },
    });
    return await response.json();
  }
}