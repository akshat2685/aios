import { ToolRegistry } from './registry';
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
export declare class ToolExecutor {
    private registry;
    private cache;
    private maxWorkers;
    private activeWorkers;
    private queue;
    constructor(registry: ToolRegistry);
    /**
     * Execute a tool with validations, caching, resource constraints, and approval checks.
     */
    execute(toolId: string, input: any, context?: {
        approvalGranted?: boolean;
        priority?: string;
    }): Promise<ToolResult>;
    private generateCacheKey;
    private isCacheExpired;
    private timeout;
    private scheduleWorker;
    private processQueue;
    /**
     * Clear the execution cache.
     */
    clearCache(): void;
}
//# sourceMappingURL=executor.d.ts.map