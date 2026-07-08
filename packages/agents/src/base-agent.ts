import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { TaskType } from '@aios/types';
import { AgentTool, AgentState, AgentMessage, AgentResponse } from '@aios/types';
import { ConfigManager } from '@aios/config';

export abstract class BaseAgent {
  protected router: LLMRouter;
  protected logger: CoreLogger;
  public state: AgentState;
  protected tools: Map<string, AgentTool> = new Map();
  public additionalSystemContext: string = '';

  constructor(name: string, role: string, router: LLMRouter, logger: CoreLogger) {
    this.router = router;
    this.logger = logger;
    this.state = {
      id: Math.random().toString(36).substring(7),
      name,
      role,
      status: 'idle',
    };
  }

  public registerTool(tool: AgentTool) {
    this.tools.set(tool.name, tool);
    this.logger.info(`Agent ${this.state.name} registered tool: ${tool.name}`);
  }

  async processMessage(message: AgentMessage, history: AgentMessage[]): Promise<AgentResponse> {
    this.state.status = 'thinking';
    this.logger.info(`Agent ${this.state.name} is thinking...`);

    const agentKey = this.state.name.toLowerCase();
    const overrides = ConfigManager.get('agents.modelOverrides') || {};
    let overrideModel = overrides[agentKey]?.model;
    
    // Map agent to TaskType
    let agentTask: TaskType = 'GENERAL_CHAT';
    if (agentKey === 'coder') agentTask = 'CODING';
    if (agentKey === 'planner' || agentKey === 'researcher') agentTask = 'REASONING';

    // Build tool descriptions
    let toolPrompt = '';
    if (this.tools.size > 0) {
      toolPrompt = `\n\nYou have access to the following tools:\n`;
      for (const [name, tool] of this.tools) {
        toolPrompt += `- \`${name}\`: ${tool.description}. Parameters: ${JSON.stringify(tool.parameters)}\n`;
      }
      toolPrompt += `\nTo call a tool, use this exact XML format:
<tool_call name="tool_name">
{
  "arg_name": "arg_value"
}
</tool_call>

CRITICAL: You MUST use your tools to actually perform actions (like writing code, reading files, creating plans). Do NOT just describe what you would do.
Only call ONE tool at a time. After calling a tool, wait for the <tool_response> before continuing.
Explain your reasoning in a "Thought:" section before writing the tool call.
When you are done and have the final answer, respond directly to the user without calling any tools.`;
    }

    const systemPrompt = this.getSystemPrompt() + '\n\n' + this.additionalSystemContext + toolPrompt;
    
    // Copy conversation history
    const conversationHistory = [...history, message];
    let step = 0;
    const maxSteps = 10;
    let finalResponse = '';

    try {
      while (step < maxSteps) {
        this.state.status = 'thinking';
        const prompt = this.constructPromptFromMessages(conversationHistory);
        
        const response = await this.router.generate({
          prompt,
          model: overrideModel || '',
          systemPrompt,
          taskType: agentTask,
          agentId: this.state.id,
        });

        const content = response.content;
        finalResponse = content;

        // Parse tool call XML
        const toolCallRegex = /<tool_call\s+name="([^"]+)">([\s\S]*?)<\/tool_call>/;
        const match = toolCallRegex.exec(content);

        if (match) {
          const toolName = match[1];
          const argsStr = match[2].trim();
          let args = {};
          
          try {
            args = JSON.parse(argsStr);
          } catch (e: any) {
            this.logger.warn(`Failed to parse tool call JSON arguments: ${argsStr}. Error: ${e.message}`);
            // Attempt to resolve arguments if LLM wrote sloppy JSON
            try {
              args = eval(`(${argsStr})`); // fallback parser for sloppy JSON
            } catch {
              args = {};
            }
          }

          this.logger.info(`Agent ${this.state.name} executing tool ${toolName} with args:`, args);
          
          let observation = '';
          try {
            const result = await this.executeTool(toolName, args);
            observation = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          } catch (toolError: any) {
            observation = `Error: ${toolError.message}`;
            this.logger.error(`Tool execution failed for ${toolName}: ${toolError.message}`);
          }

          // Format this step into the conversation history
          conversationHistory.push({
            role: 'assistant',
            content: content,
            timestamp: Date.now()
          });

          conversationHistory.push({
            role: 'tool',
            content: `<tool_response>\n${observation}\n</tool_response>`,
            timestamp: Date.now()
          });

          step++;
        } else {
          // No tool call, the agent has finished thinking
          break;
        }
      }

      this.state.status = 'idle';
      return {
        message: finalResponse,
        done: true,
      };
    } catch (error: any) {
      this.state.status = 'idle';
      this.logger.error(`Agent ${this.state.name} failed: ${error.message}`);
      throw error;
    }
  }

  protected abstract getSystemPrompt(): string;

  protected constructPrompt(message: AgentMessage, history: AgentMessage[]): string {
    const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
    return `${historyText}\n${message.role}: ${message.content}`;
  }

  protected constructPromptFromMessages(messages: AgentMessage[]): string {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n');
  }

  async executeTool(toolName: string, args: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`Tool ${toolName} not found`);
    
    this.state.status = 'executing';
    this.logger.info(`Agent ${this.state.name} executing tool ${toolName}`);
    const result = await tool.execute(args);
    this.state.status = 'idle';
    return result;
  }
}