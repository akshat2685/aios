import { CoreLogger } from '@aios/core';
import { AutomationAction, WorkflowContext } from '@aios/types';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import jexl from 'jexl';
import crypto from 'crypto';

const execPromise = promisify(exec);

export class ActionLibrary {
  private logger: CoreLogger;

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  async interpolateParams(params: any, context: WorkflowContext): Promise<any> {
    const extendedContext = {
      ...context,
      now: new Date().toISOString(),
      today: new Date().toISOString().split('T')[0],
      uuid: crypto.randomUUID()
    };

    const traverse = async (node: any): Promise<any> => {
      if (typeof node === 'string') {
        const regex = /\{\{(.*?)\}\}/g;
        let match;
        let resultString = node;

        if (/^\{\{.*?\}\}$/.test(node.trim())) {
           const expr = node.trim().slice(2, -2).trim();
           return await jexl.eval(expr, extendedContext);
        }

        while ((match = regex.exec(node)) !== null) {
          const expr = match[1].trim();
          try {
            const val = await jexl.eval(expr, extendedContext);
            resultString = resultString.replace(match[0], val != null ? String(val) : '');
          } catch (e: any) {
            this.logger.warn(`Failed to interpolate expression "${expr}": ${e.message}`);
          }
        }
        return resultString;
      } else if (Array.isArray(node)) {
        return Promise.all(node.map(item => traverse(item)));
      } else if (node !== null && typeof node === 'object') {
        const res: any = {};
        for (const [k, v] of Object.entries(node)) {
          res[k] = await traverse(v);
        }
        return res;
      }
      return node;
    };

    return traverse(params);
  }

  async executeAction(action: AutomationAction, context: WorkflowContext, signal?: AbortSignal): Promise<any> {
    this.logger.info(`Executing action ${action.name} (${action.type})`);
    
    const params = await this.interpolateParams(action.params, context);

    switch (action.type) {
      case 'shell':
        return await this.runShell(params.command, signal);
      case 'file':
        return await this.runFileOp(params);
      case 'api':
        return await this.runApiCall(params, signal);
      case 'agent':
        return { status: 'delegated', message: 'Action routed to agent', targetAgent: params.agentId, task: params.task };
      case 'variable':
        context.variables[params.name] = params.value;
        return { status: 'set', name: params.name, value: params.value };
      case 'approval':
        return { status: 'waiting_approval', message: 'Manual approval required.' };
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  private async runShell(command: string, signal?: AbortSignal): Promise<any> {
    try {
      const { stdout, stderr } = await execPromise(command, { signal });
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

  private async runApiCall(params: { url: string, method: string, body?: any, headers?: any }, signal?: AbortSignal): Promise<any> {
    const response = await fetch(params.url, {
      method: params.method,
      body: params.body ? (typeof params.body === 'string' ? params.body : JSON.stringify(params.body)) : undefined,
      headers: { 'Content-Type': 'application/json', ...params.headers },
      signal,
    });
    let data;
    try {
      data = await response.json();
    } catch(e) {
      data = await response.text();
    }
    return { status: response.status, data };
  }
}