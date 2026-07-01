import { BaseAgent } from './base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { AssistantAgent, CoderAgent, ResearchAgent, PlannerAgent } from './core-agents';
import { AgentMessage, AgentResponse } from '@aios/types';

import { getDelegationTool } from './tools/delegation-tool';
import { SkillManager } from './skill-manager';
import { getSkillReadTool } from './tools/skill-tools';

export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private logger: CoreLogger;
  public skillManager: SkillManager;

  constructor(
    router: LLMRouter, 
    logger: CoreLogger, 
    workspacePath = 'C:\\Users\\ijain\\AIOS',
    requestApproval?: (action: string, details: string) => Promise<boolean>
  ) {
    this.logger = logger;
    this.skillManager = new SkillManager(logger, workspacePath);
    
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

  public async init(): Promise<void> {
    await this.skillManager.discoverSkills();
    const skills = this.skillManager.getSkills();
    
    let skillsContext = '';
    if (skills.length > 0) {
      skillsContext = 'You have the following skills available. Use the skill:read tool to read their instructions when you need to perform a task matching their description:\n';
      skillsContext += skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    }

    const skillReadTool = getSkillReadTool(this.skillManager);

    for (const agent of this.agents.values()) {
      if (skillsContext) {
        agent.additionalSystemContext = `<skills>\n${skillsContext}\n</skills>`;
        agent.registerTool(skillReadTool);
      }
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