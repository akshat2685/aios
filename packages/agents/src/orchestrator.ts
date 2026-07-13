import { BaseAgent } from './base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { AssistantAgent, CoderAgent, ResearchAgent, PlannerAgent, ReviewerAgent, TesterAgent, ArchitectAgent, SecurityAgent, PerformanceAgent } from './core-agents';
import { SpencerAgent } from './spencer-agent';
import { AgentMessage, AgentResponse } from '@aios/types';

import { getDelegationTool } from './tools/delegation-tool';
import { SkillRegistry } from './skill-registry';
import { getSkillReadTool } from './tools/skill-tools';
import { loadPlans, savePlans } from './tools/planner-tools';
import { MemoryOperations } from '@aios/core';
import { GuardRail, askApproval } from '@aios/security';
import { AgentReputationTracker } from './reputation';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export enum AutonomyLevel {
  Assistant = 0,
  Suggest = 1,
  ExecuteWithApproval = 2,
  FullyAutonomous = 3,
  SelfOptimizing = 4
}

export interface AgentDecisionAudit {
  taskId: string;
  planner: string;
  executor: string;
  model: string;
  reason: string;
  filesChanged: string[];
  testStatus: string;
  securityStatus: string;
  timestamp: number;
}

export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private logger: CoreLogger;
  public skillRegistry: SkillRegistry;
  private memory?: MemoryOperations;
  public reputationTracker: AgentReputationTracker;
  public autonomyLevel: AutonomyLevel = AutonomyLevel.ExecuteWithApproval;
  private requestApproval?: (action: string, details: string) => Promise<boolean>;

  constructor(
    router: LLMRouter, 
    logger: CoreLogger, 
    workspacePath = 'C:\\Users\\ijain\\AIOS',
    requestApproval?: (action: string, details: string) => Promise<boolean>,
    memory?: MemoryOperations
  ) {
    this.logger = logger;
    this.memory = memory;
    this.requestApproval = requestApproval;
    this.skillRegistry = new SkillRegistry(logger, workspacePath);
    this.reputationTracker = new AgentReputationTracker();
    
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
    this.registerAgent('reviewer', new ReviewerAgent(router, logger));
    this.registerAgent('tester', new TesterAgent(router, logger));
    this.registerAgent('architect', new ArchitectAgent(router, logger));
    this.registerAgent('security', new SecurityAgent(router, logger));
    this.registerAgent('performance', new PerformanceAgent(router, logger));

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
    await this.refreshSkills();
  }

  public async refreshSkills(): Promise<void> {
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
        // Only append or update the skills block, simpler way is just to overwrite additionalSystemContext if it only contains skills.
        // If additionalSystemContext has other things, we would need to replace only the skills block.
        // For now, we will replace the whole skills block.
        const currentContext = agent.additionalSystemContext || '';
        const skillsRegex = /<skills>[\s\S]*?<\/skills>/;
        const newSkillsBlock = `<skills>\n${skillsContext}\n</skills>`;
        
        if (skillsRegex.test(currentContext)) {
          agent.additionalSystemContext = currentContext.replace(skillsRegex, newSkillsBlock);
        } else {
          agent.additionalSystemContext = currentContext + (currentContext ? '\n' : '') + newSkillsBlock;
        }
        
        // ensure tool is registered
        try {
          agent.registerTool(skillReadTool);
        } catch(e) {
          // Tool might already be registered, depending on BaseAgent implementation
        }
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

  async logDecision(audit: AgentDecisionAudit) {
    const logLine = JSON.stringify(audit);
    this.logger.info(`[AUDIT] ${logLine}`);
    try {
      const auditDir = path.join(os.homedir(), '.aios');
      if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
      fs.appendFileSync(path.join(auditDir, 'agent-decisions.log'), logLine + '\n');
    } catch (e) {
      this.logger.warn(`Failed to write audit log: ${e}`);
    }
  }

  async routeTask(task: string, taskType: string): Promise<AgentResponse> {
    const availableAgents = Array.from(this.agents.keys());
    if (availableAgents.length === 0) {
      throw new Error("No agents available to route task");
    }
    
    // The orchestrator learns from stats to route tasks
    const bestAgent = this.reputationTracker.recommendAgentForTask(taskType, availableAgents);
    const successRate = (this.reputationTracker.getSuccessRate(bestAgent) * 100).toFixed(0);
    
    this.logger.info(`Routing task of type '${taskType}' to '${bestAgent}' agent (Success Rate: ${successRate}%)`);
    
    // Human Approval Gate Check
    if (this.autonomyLevel === AutonomyLevel.Assistant) {
      return { message: `Assistant mode: Task "${task}" requires manual direction.`, done: true };
    } else if (this.autonomyLevel === AutonomyLevel.Suggest) {
      return { message: `Suggestion: I recommend assigning "${task}" to ${bestAgent}. (Autonomy Level 1: Suggest)`, done: true };
    } else if (this.autonomyLevel === AutonomyLevel.ExecuteWithApproval && this.requestApproval) {
      const approved = await this.requestApproval('execute_task', `Task: ${task}\nTarget Agent: ${bestAgent}`);
      if (!approved) {
        return { message: 'Task execution denied by human approval gate.', done: true };
      }
    }
    
    let iterations = 1;
    let success = false;
    let response: AgentResponse | null = null;
    try {
      response = await this.routeRequest(bestAgent, { role: 'user', content: task, timestamp: Date.now() });
      success = !response.message.toLowerCase().includes('failed'); // Basic heuristic
      return response;
    } finally {
      this.reputationTracker.recordTaskCompletion(bestAgent, success, iterations);
      await this.logDecision({
        taskId: `task_${Date.now()}`,
        planner: 'orchestrator',
        executor: bestAgent,
        model: 'default',
        reason: `Routed task based on ${successRate}% success rate`,
        filesChanged: [],
        testStatus: success ? 'PASS' : 'FAIL',
        securityStatus: 'PASSED_GUARDRAIL', // Basic assumption if no throw
        timestamp: Date.now()
      });
    }
  }

  async verifyAndCorrect(task: string, maxIterations = 3): Promise<AgentResponse> {
    const taskId = `task_${Date.now()}`;
    let iteration = 0;
    let currentTask = task;
    let lastResponse: AgentResponse | null = null;
    let history: AgentMessage[] = [];
    
    // Human Approval Gate Check
    if (this.autonomyLevel === AutonomyLevel.Assistant) {
      return { message: `Assistant mode: verifyAndCorrect requires manual direction.`, done: true };
    } else if (this.autonomyLevel === AutonomyLevel.Suggest) {
      return { message: `Suggestion: I recommend running verifyAndCorrect on "${task}". (Autonomy Level 1: Suggest)`, done: true };
    } else if (this.autonomyLevel === AutonomyLevel.ExecuteWithApproval && this.requestApproval) {
      const approved = await this.requestApproval('verify_and_correct', `Task: ${task}\nProcess: Coder -> Reviewer -> Tester`);
      if (!approved) {
        return { message: 'Task execution denied by human approval gate.', done: true };
      }
    }

    while (iteration < maxIterations) {
      this.logger.info(`verifyAndCorrect: Iteration ${iteration + 1} for task`);
      // 1. Coder executes the task
      lastResponse = await this.routeRequest('coder', { role: 'user', content: currentTask, timestamp: Date.now() }, history);
      
      // Update history for coder
      history.push({ role: 'user', content: currentTask, timestamp: Date.now() });
      history.push({ role: 'assistant', content: lastResponse.message, timestamp: Date.now() });

      // 2. Reviewer checks the result
      const reviewPrompt = `Please review the following code changes and output for the task: "${task}".\n\nCoder Output:\n${lastResponse.message}\n\nIf it meets all requirements and quality standards, reply with exactly "APPROVED". Otherwise, provide actionable feedback for the coder to fix.`;
      const reviewResponse = await this.routeRequest('reviewer', { role: 'user', content: reviewPrompt, timestamp: Date.now() });
      
      if (reviewResponse.message.trim().toUpperCase().includes('APPROVED')) {
        this.logger.info(`verifyAndCorrect: Reviewer approved on iteration ${iteration + 1}, routing to Tester`);

        // 3. Tester validates the result
        const testPrompt = `Please test the following code changes and output for the task: "${task}".\n\nCoder Output:\n${lastResponse.message}\n\nIf all tests pass and the code functions correctly, reply with exactly "PASS". Otherwise, provide actionable feedback for the coder to fix.`;
        const testResponse = await this.routeRequest('tester', { role: 'user', content: testPrompt, timestamp: Date.now() });

        if (testResponse.message.trim().toUpperCase().includes('PASS')) {
          this.logger.info(`verifyAndCorrect: Tester passed on iteration ${iteration + 1}`);
          this.reputationTracker.recordTaskCompletion('coder', true, iteration + 1);
          this.reputationTracker.recordTaskCompletion('reviewer', true, 1);
          this.reputationTracker.recordTaskCompletion('tester', true, 1);
          
          await this.logDecision({
            taskId,
            planner: 'orchestrator',
            executor: 'coder',
            model: 'default',
            reason: `Iterative refinement passed after ${iteration + 1} attempts`,
            filesChanged: [], // Normally parsed from lastResponse
            testStatus: 'PASS',
            securityStatus: 'PASS',
            timestamp: Date.now()
          });
          
          return lastResponse;
        }

        // Setup for next iteration (Tester failed)
        this.logger.warn(`verifyAndCorrect: Tester reported failures: ${testResponse.message.substring(0, 100)}...`);
        this.reputationTracker.recordTaskCompletion('tester', false, 1);
        currentTask = `The tester provided the following feedback on your previous output. Please fix the issues:\n\nTester Feedback:\n${testResponse.message}`;
      } else {
        // Setup for next iteration (Reviewer failed)
        this.logger.warn(`verifyAndCorrect: Reviewer requested changes: ${reviewResponse.message.substring(0, 100)}...`);
        this.reputationTracker.recordTaskCompletion('reviewer', false, 1);
        currentTask = `The reviewer provided the following feedback on your previous output. Please fix the issues:\n\nReviewer Feedback:\n${reviewResponse.message}`;
      }
      
      iteration++;
    }
    
    this.reputationTracker.recordTaskCompletion('coder', false, iteration);
    
    await this.logDecision({
      taskId,
      planner: 'orchestrator',
      executor: 'coder',
      model: 'default',
      reason: `Max iterations reached without approval.`,
      filesChanged: [],
      testStatus: 'FAIL',
      securityStatus: 'PASS',
      timestamp: Date.now()
    });
    
    this.logger.error(`verifyAndCorrect: Max iterations reached without approval.`);
    return lastResponse || { message: 'Failed to complete task', done: true };
  }

  async resolveDebate(task: string, proposedPlan: string): Promise<AgentResponse> {
    this.logger.info(`Starting debate for critical task: ${task}`);
    
    const debatePrompt = `Please evaluate the following proposed plan for the task: "${task}".\n\nProposed Plan:\n${proposedPlan}\n\nProvide your analysis, critique, and actionable improvements based on your specialized perspective.`;

    const [architectRes, securityRes, performanceRes] = await Promise.all([
      this.routeRequest('architect', { role: 'user', content: debatePrompt, timestamp: Date.now() }),
      this.routeRequest('security', { role: 'user', content: debatePrompt, timestamp: Date.now() }),
      this.routeRequest('performance', { role: 'user', content: debatePrompt, timestamp: Date.now() })
    ]);

    this.logger.info(`Received debate feedback from Architect, Security, and Performance agents.`);

    const synthesisPrompt = `You are a neutral orchestrator. A critical task was proposed:\n"${task}"\n\nProposed Plan:\n${proposedPlan}\n\nThe following expert analyses were provided:\n\nArchitect Feedback:\n${architectRes.message}\n\nSecurity Feedback:\n${securityRes.message}\n\nPerformance Feedback:\n${performanceRes.message}\n\nPlease synthesize these critiques and produce a 'Final Decision' summary that merges the best parts, resolves conflicts, and provides a final approved plan for execution. Start your output with "Final Decision:".`;

    const finalDecisionRes = await this.routeRequest('planner', { role: 'user', content: synthesisPrompt, timestamp: Date.now() });

    this.logger.info(`Debate resolved with Final Decision.`);
    return finalDecisionRes;
  }
}