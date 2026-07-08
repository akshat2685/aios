import { ToolDefinition } from '@aios/types';
/**
 * ToolRegistry — Universal provider-agnostic tool schema registry.
 *
 * Registers and indexes Native, MCP, Plugin, Skill, and REST/CLI tools.
 * Handles input and output validation against JSON Schema definitions.
 */
export declare class ToolRegistry {
    private tools;
    /**
     * Register a tool definition.
     */
    register(tool: ToolDefinition): void;
    /**
     * Get a tool definition by ID.
     */
    getTool(toolId: string): ToolDefinition | undefined;
    /**
     * List all registered tools.
     */
    getAllTools(): ToolDefinition[];
    /**
     * List tools filtered by category.
     */
    getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[];
    /**
     * Validate input arguments against the tool's inputSchema.
     */
    validateInput(toolId: string, input: any): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Validate output arguments against the tool's outputSchema.
     */
    validateOutput(toolId: string, output: any): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Unregister a tool.
     */
    unregister(toolId: string): void;
}
//# sourceMappingURL=registry.d.ts.map