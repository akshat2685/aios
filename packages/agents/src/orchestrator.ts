import { BaseAgent } from './base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { AssistantAgent, CoderAgent, ResearchAgent, PlannerAgent } from './core-agents';
import { AgentMessage, AgentResponse } from '@aios/types';

import { getDelegationTool } from './tools/delegation-tool';

export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private logger: CoreLogger;

  constructor(
    router: LLMRouter, 
    logger: CoreLogger, 
    workspacePath = 'C:\\Users\\ijain\\AIOS',
    requestApproval?: (action: string, details: string) => Promise<boolean>
  ) {
    this.logger = logger;
    
    // Initialize core agents
    this.registerAgent('assistant', new AssistantAgent(router, logger));
    this.registerAgent('coder', new CoderAgent(router, logger, workspacePath, requestApproval));
    this.registerAgent('researcher', new ResearchAgent(router, logger));
    this.registerAgent('planner', new PlannerAgent(router, logger));

    // Initialize cross-agent delegation tool
    const delegationTool = getDelegationTool(async (agentId, task) => {
      this.logger.info(`Orchestrator: Agent delegated sub-task to "${agentId}": "${task}"`);
      const response = await this.routeRequest(agentId, {
        role: 'user',
        content: task,
        timestamp: Date.now()
      });
      return response.message;
    });

    // Register on all agents
    for (const agent of this.agents.values()) {
      agent.registerTool(delegationTool);
    }
  }

  public registerAgent(id: string, agent: BaseAgent) {
    this.agents.set(id, agent);
    this.logger.info(`Orchestrator registered agent: ${id}`);
  }

  async routeRequest(agentId: string, message: AgentMessage, history: AgentMessage[] = []): Promise<AgentResponse> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found in orchestrator`);
    }

    return await agent.processMessage(message, history);
  }

  async broadcast(message: AgentMessage): Promise<void> {
    this.logger.info(`Broadcasting message to all agents: ${message.content}`);
    // Implementation for multi-agent coordination
  }
}