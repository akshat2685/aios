import { CoreLogger } from '@aios/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export interface MCPTool {
  name: string;
  description: string;
  parameters: any;
}

export interface MCPClientOptions {
  serverUrl: string;
}

export class MCPClient {
  private serverUrl: string;
  private logger: CoreLogger;
  private client: Client;
  private transport?: SSEClientTransport;
  
  constructor(options: MCPClientOptions, logger: CoreLogger) {
    this.serverUrl = options.serverUrl;
    this.logger = logger;
    this.client = new Client(
      { name: 'aios-mcp-client', version: '1.0.0' },
      { capabilities: {} }
    );
  }
  
  async connect(): Promise<void> {
    this.logger.info(`Connecting to MCP server at ${this.serverUrl}`);
    this.transport = new SSEClientTransport(new URL(this.serverUrl));
    await this.client.connect(this.transport);
  }
  
  async listTools(): Promise<MCPTool[]> {
    this.logger.debug(`Fetching tools from MCP server at ${this.serverUrl}`);
    const response = await this.client.listTools();
    return response.tools.map((t: any) => ({
      name: t.name,
      description: t.description || '',
      parameters: t.inputSchema
    }));
  }
  
  async executeTool(toolName: string, args: any): Promise<any> {
    this.logger.debug(`Executing MCP tool ${toolName}`);
    const response = await this.client.callTool({
      name: toolName,
      arguments: args
    });
    return response;
  }
}
