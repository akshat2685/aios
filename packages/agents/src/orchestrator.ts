import { BaseAgent } from './base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { AssistantAgent, CoderAgent, ResearchAgent, PlannerAgent } from './core-agents';
import { SpencerAgent } from './spencer-agent';
import { AgentMessage, AgentResponse } from '@aios/types';

import { getDelegationTool } from './tools/delegation-tool';
import { SkillRegistry } from './skill-registry';
import { getSkillReadTool } from './tools/skill-tools';
import { loadPlans, savePlans } from './tools/planner-tools';
import { MemoryService } from '@aios/core';
import { GuardRail, askApproval } from '@aios/security';

export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private logger: CoreLogger;
  public skillRegistry: SkillRegistry;
  private memory?: MemoryService;

  constructor(
    router: LLMRouter, 
    logger: CoreLogger, 
    workspacePath = 'C:\\Users\\ijain\\AIOS',
    requestApproval?: (action: string, details: string) => Promise<boolean>,
    memory?: MemoryService
  ) {
    this.logger = logger;
    this.memory = memory;
    this.skillRegistry = new SkillRegistry(logger, workspacePath);
    
    // Setup Security Guardrail
    const policy = {
      allowDangerousActions: false,
      requireApprovalFor: ['shell' as any, 'computer_run_shell' as any, 'shell:run' as any, 'file_write' as any],
      encryptionEnabled: false,
      airGappedMode: false
    };
    
    const guardRail = new GuardRail(logger, policy, askApproval);
    
    const coderApproval = async (action: string, target: string) => {
      return await guardRail.requestApproval({
        id: Math.random().toString(36).substring(7),
        action,
        target,
        params: {},
        agentId: 'coder',
        timestamp: Date.now(),
        cwd: workspacePath
      });
    };

    // Initialize core agents
    this.registerAgent('assistant', new AssistantAgent(router, logger));
    this.registerAgent('spencer', new SpencerAgent(router, logger));
    this.registerAgent('coder', new CoderAgent(router, logger, workspacePath, coderApproval));
    this.registerAgent('researcher', new ResearchAgent(router, logger));
    this.registerAgent('planner', new PlannerAgent(router, logger));

    // Initialize cross-agent delegation tool
    const delegationTool = getDelegationTool(async (agentId, task, planId, taskId) => {
      this.logger.info(`Orchestrator: Agent delegated sub-task to "${agentId}": "${task}" (Plan: ${planId}, Task: ${taskId})`);
      
      let taskRef: any = null;
      let planRef: any = null;
      let plans: any[] = [];
      let planContext = '';
      
      if (planId) {
        plans = await loadPlans();
        planRef = plans.find(p => p.id === planId);
        if (planRef) {
          planContext = `[PLAN CONTEXT]\nGoal: ${planRef.goal}\nTasks:\n${planRef.tasks.map((t: any) => `- [${t.id}] ${t.title} (${t.status}): ${t.description || ''}`).join('\n')}\n`;
          if (taskId) {
            taskRef = planRef.tasks.find((t: any) => t.id === taskId);
            if (taskRef) {
              taskRef.status = 'in_progress';
              taskRef.assignedAgent = agentId;
              await savePlans(plans);
            }
          }
        }
      }

      // Context override injection
      const contextPrefix = (planId && taskId) 
        ? `${planContext}\n[DELEGATION CONTEXT]\nYou have been delegated a sub-task for Plan ${planId} (Task ID: ${taskId}).\n`
        : '';

      const response = await this.routeRequest(agentId, {
        role: 'user',
        content: contextPrefix + task,
        timestamp: Date.now()
      });

      if (taskRef) {
        taskRef.status = 'completed';
        taskRef.result = response.message.substring(0, 500); // Store summary of result
        await savePlans(plans);
      }

      return response.message;
    });

    // Register on all agents
    for (const agent of this.agents.values()) {
      agent.registerTool(delegationTool);
    }
  }

  public async init(): Promise<void> {
    await this.skillRegistry.discoverSkills();
    const skills = this.skillRegistry.getSkills();
    
    let skillsContext = '';
    if (skills.length > 0) {
      skillsContext = 'You have the following skills available. Use the skill:read tool to read their instructions when you need to perform a task matching their description:\n';
      skillsContext += skills.map((s: any) => `- ${s.name}: ${s.description}`).join('\n');
    }

    const skillReadTool = getSkillReadTool(this.skillRegistry);

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

    // Inject dynamic memory context
    let memoryContext = '';
    if (this.memory) {
      try {
        const prefs = await this.memory.getGlobalPreferences();
        if (prefs && prefs.length > 0) {
          memoryContext = '\n<user_preferences>\n' + 
            prefs.map((p: any) => `- ${p.metadata?.key}: ${p.content}`).join('\n') +
            '\n</user_preferences>\n';
        }
      } catch (e) {
        this.logger.warn(`Failed to fetch global preferences: ${e}`);
      }
    }
    
    // We temporarily override the agent's additionalSystemContext for this request
    const originalContext = agent.additionalSystemContext;
    agent.additionalSystemContext = originalContext + memoryContext;

    try {
      return await agent.processMessage(message, history);
    } finally {
      agent.additionalSystemContext = originalContext;
    }
  }

  async broadcast(message: AgentMessage): Promise<void> {
    this.logger.info(`Broadcasting message to all agents: ${message.content}`);
    // Implementation for multi-agent coordination
  }
}