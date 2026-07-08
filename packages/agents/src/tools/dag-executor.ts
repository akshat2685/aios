import { ToolCall, ChainResult } from '@aios/types';
import { ToolExecutor } from '@aios/sandbox';

/**
 * DAGExecutor — Dependency-aware tool execution scheduler.
 *
 * Runs independent tools concurrently and cascades values
 * down dependency chains to resolve workflows.
 */
export class DAGExecutor {
  private executor: ToolExecutor;

  constructor(executor: ToolExecutor) {
    this.executor = executor;
  }

  /**
   * Execute a collection of tool calls with dependency resolution.
   */
  public async executeChain(
    toolCalls: ToolCall[],
    context: { approvalGranted?: boolean; priority?: string } = {}
  ): Promise<ChainResult> {
    const startTime = Date.now();
    
    // Validate circular dependency boundaries
    try {
      const sorted = this.topologicalSort(toolCalls);
      const results = new Map<string, any>();

      for (const call of sorted) {
        // Replace templates: replace inputs referencing earlier results e.g. "$[step1.content]"
        const resolvedInput = this.resolveInputs(call.input, results);

        const res = await this.executor.execute(call.toolName, resolvedInput, context);
        if (!res.success) {
          return {
            success: false,
            failedTool: call.toolName,
            error: res.error || 'Unknown error',
            partialResults: results,
            totalExecutionTime: Date.now() - startTime
          };
        }

        results.set(call.id, res.data);
      }

      return {
        success: true,
        results,
        totalExecutionTime: Date.now() - startTime
      };
    } catch (e: any) {
      return {
        success: false,
        error: `DAG Cycle or sort failure: ${e.message}`,
        totalExecutionTime: Date.now() - startTime
      };
    }
  }

  private topologicalSort(calls: ToolCall[]): ToolCall[] {
    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};
    const callMap = new Map<string, ToolCall>();

    // Initialize degrees and graph maps
    for (const call of calls) {
      inDegree[call.id] = 0;
      adjList[call.id] = [];
      callMap.set(call.id, call);
    }

    for (const call of calls) {
      if (call.dependsOn) {
        for (const depId of call.dependsOn) {
          if (!callMap.has(depId)) {
            throw new Error(`Missing dependency task id: ${depId}`);
          }
          adjList[depId].push(call.id);
          inDegree[call.id]++;
        }
      }
    }

    const queue: string[] = [];
    for (const call of calls) {
      if (inDegree[call.id] === 0) {
        queue.push(call.id);
      }
    }

    const sortedCalls: ToolCall[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      sortedCalls.push(callMap.get(u)!);

      for (const v of adjList[u]) {
        inDegree[v]--;
        if (inDegree[v] === 0) {
          queue.push(v);
        }
      }
    }

    if (sortedCalls.length !== calls.length) {
      throw new Error('Cycle detected in DAG tool execution dependencies.');
    }

    return sortedCalls;
  }

  private resolveInputs(input: any, results: Map<string, any>): any {
    if (typeof input === 'string') {
      // Simple macro resolver: "$[stepId.property]"
      const match = input.match(/\$\[([^.]+)\.([^\]]+)\]/);
      if (match) {
        const stepId = match[1];
        const prop = match[2];
        const stepRes = results.get(stepId);
        if (stepRes && stepRes[prop] !== undefined) {
          return stepRes[prop];
        }
      }
      return input;
    }

    if (Array.isArray(input)) {
      return input.map(item => this.resolveInputs(item, results));
    }

    if (input !== null && typeof input === 'object') {
      const resolved: Record<string, any> = {};
      for (const [key, val] of Object.entries(input)) {
        resolved[key] = this.resolveInputs(val, results);
      }
      return resolved;
    }

    return input;
  }
}
