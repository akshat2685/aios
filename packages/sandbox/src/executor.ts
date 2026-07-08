import { ToolDefinition, CacheEntry } from '@aios/types';
import { ToolRegistry } from './registry';
import * as os from 'os';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  cached?: boolean;
  executionTime?: number;
  tool?: string;
  needsApproval?: boolean;
  approvalRequest?: any;
}

/**
 * ToolExecutor — Production-grade tool execution scheduler.
 *
 * Implements a CPU-count-aware dynamic worker pool, TTL caching,
 * and security approval gates for dangerous operations.
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private cache: Map<string, CacheEntry> = new Map();
  private maxWorkers: number;
  private activeWorkers: number = 0;
  private queue: Array<() => Promise<void>> = [];

  constructor(registry: ToolRegistry) {
    this.registry = registry;
    
    // CPU Count dynamic scaling: Max workers = CPU count - 2
    const cpus = os.cpus().length;
    this.maxWorkers = Math.max(1, cpus - 2);
  }

  /**
   * Execute a tool with validations, caching, resource constraints, and approval checks.
   */
  public async execute(
    toolId: string,
    input: any,
    context: { approvalGranted?: boolean; priority?: string } = {}
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.registry.getTool(toolId);

    if (!tool) {
      return { success: false, error: `Tool ${toolId} not found in registry.` };
    }

    // Input Validation
    const validation = this.registry.validateInput(toolId, input);
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    // Cache Check
    const cacheKey = this.generateCacheKey(toolId, input);
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return {
        success: true,
        data: cached.result,
        cached: true,
        executionTime: Date.now() - startTime,
        tool: toolId
      };
    }

    // Approval Gate check
    if (tool.requires_approval && !context.approvalGranted) {
      return {
        success: false,
        error: 'Requires user approval.',
        needsApproval: true,
        approvalRequest: {
          toolId,
          input,
          description: tool.description
        }
      };
    }

    // Queue for worker pool slot
    try {
      const data = await this.scheduleWorker(async () => {
        return await Promise.race([
          tool.executor(input, context),
          this.timeout(tool.timeout)
        ]);
      });

      // Cache result
      this.cache.set(cacheKey, {
        result: data,
        timestamp: Date.now()
      });

      return {
        success: true,
        data,
        cached: false,
        executionTime: Date.now() - startTime,
        tool: toolId
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
        executionTime: Date.now() - startTime,
        tool: toolId
      };
    }
  }

  private generateCacheKey(toolId: string, input: any): string {
    return `${toolId}:${JSON.stringify(input)}`;
  }

  private isCacheExpired(entry: CacheEntry): boolean {
    const TTL = 5 * 60 * 1000; // 5 minutes TTL
    return Date.now() - entry.timestamp > TTL;
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Execution timed out after ${ms}ms`)), ms)
    );
  }

  private async scheduleWorker<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
      return;
    }

    this.activeWorkers++;
    const task = this.queue.shift()!;

    try {
      await task();
    } finally {
      this.activeWorkers--;
      this.processQueue();
    }
  }

  /**
   * Clear the execution cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }
}
