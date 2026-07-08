import { MCPClient, MCPTool } from './client';
import { CoreLogger } from '@aios/core';

export class MCPAdapter {
  private client: MCPClient;
  private logger: CoreLogger;
  
  constructor(client: MCPClient, logger: CoreLogger) {
    this.client = client;
    this.logger = logger;
  }
  
  async getToolsAsVercelSkills(): Promise<Record<string, any>> {
    const mcpTools = await this.client.listTools();
    const skills: Record<string, any> = {};
    
    for (const tool of mcpTools) {
      // Create a Vercel-compatible skill wrapper for the MCP tool
      skills[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
        execute: async (args: any) => {
          this.logger.debug(`Executing MCP tool ${tool.name} via adapter`);
          return this.client.executeTool(tool.name, args);
        }
      };
    }
    
    return skills;
  }
}
