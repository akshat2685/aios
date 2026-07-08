"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolExecutor = void 0;
const os = __importStar(require("os"));
/**
 * ToolExecutor — Production-grade tool execution scheduler.
 *
 * Implements a CPU-count-aware dynamic worker pool, TTL caching,
 * and security approval gates for dangerous operations.
 */
class ToolExecutor {
    registry;
    cache = new Map();
    maxWorkers;
    activeWorkers = 0;
    queue = [];
    constructor(registry) {
        this.registry = registry;
        // CPU Count dynamic scaling: Max workers = CPU count - 2
        const cpus = os.cpus().length;
        this.maxWorkers = Math.max(1, cpus - 2);
    }
    /**
     * Execute a tool with validations, caching, resource constraints, and approval checks.
     */
    async execute(toolId, input, context = {}) {
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
        }
        catch (e) {
            return {
                success: false,
                error: e.message,
                executionTime: Date.now() - startTime,
                tool: toolId
            };
        }
    }
    generateCacheKey(toolId, input) {
        return `${toolId}:${JSON.stringify(input)}`;
    }
    isCacheExpired(entry) {
        const TTL = 5 * 60 * 1000; // 5 minutes TTL
        return Date.now() - entry.timestamp > TTL;
    }
    timeout(ms) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error(`Execution timed out after ${ms}ms`)), ms));
    }
    async scheduleWorker(fn) {
        return new Promise((resolve, reject) => {
            const task = async () => {
                try {
                    const result = await fn();
                    resolve(result);
                }
                catch (e) {
                    reject(e);
                }
            };
            this.queue.push(task);
            this.processQueue();
        });
    }
    async processQueue() {
        if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
            return;
        }
        this.activeWorkers++;
        const task = this.queue.shift();
        try {
            await task();
        }
        finally {
            this.activeWorkers--;
            this.processQueue();
        }
    }
    /**
     * Clear the execution cache.
     */
    clearCache() {
        this.cache.clear();
    }
}
exports.ToolExecutor = ToolExecutor;
//# sourceMappingURL=executor.js.map