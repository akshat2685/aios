import { BaseAgent } from './base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { getCodingTools } from './tools/coding-tools';
import { getResearchTools } from './tools/research-tools';
import { getComputerTools } from './tools/computer-tools';
import { getPlannerTools } from './tools/planner-tools';

export class AssistantAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Assistant', 'General Assistant', router, logger);
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Personal Assistant. You help the user manage their local AI OS, 
    organize knowledge, and coordinate other specialized agents. 
    Be concise, professional, and prioritize privacy and local-first operations.`;
  }
}

export class CoderAgent extends BaseAgent {
  constructor(
    router: LLMRouter, 
    logger: CoreLogger, 
    workspacePath = 'C:\\Users\\ijain\\AIOS',
    requestApproval?: (action: string, details: string) => Promise<boolean>
  ) {
    super('Coder', 'Software Engineer', router, logger);
    
    // Register coding tools
    const tools = getCodingTools(workspacePath, logger, requestApproval);
    for (const tool of tools) {
      this.registerTool(tool);
    }
    
    // Register computer tools for system interaction
    const computerTools = getComputerTools(logger, requestApproval);
    for (const tool of computerTools) {
      this.registerTool(tool);
    }
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Coding Agent. You are an expert software engineer.
    Your goal is to write production-grade, modular, and strongly typed code.
    Follow SOLID principles and Clean Architecture. Always consider performance and security.
    You have direct access to tools for interacting with files and running shell commands in the workspace.
    CRITICAL: You MUST use your tools to actually read code, write new features, analyze errors, and run tests.
    Do NOT just output the code in chat or describe what you would do. ACTUALLY EXECUTE IT using the tools provided.`;
  }
}

export class ResearchAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Researcher', 'Research Assistant', router, logger);
    
    // Register research tools
    const tools = getResearchTools(router, logger);
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Research Agent. You specialize in gathering information, 
    summarizing documents, and verifying facts. You have access to tools for web search, web page scraping, and automated multi-source research report compilation.
    Always provide citations for facts, name your sources, and maintain high academic rigor.`;
  }
}

export class PlannerAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Planner', 'Project Planner', router, logger);
    
    // Register planner tools
    const tools = getPlannerTools(router);
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Planner Agent. You break down complex goals into 
    actionable tasks, create roadmaps, and manage dependencies. 
    Use your tools to create plans, decompose goals, and track task statuses.
    CRITICAL: You MUST use the 'plan:create' and other plan tools to construct a formal plan.
    Once a plan is ready, use the 'agent:delegate' tool to assign tasks to the appropriate agents (e.g., Coder, Researcher).`;
  }
}

export class ReviewerAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Reviewer', 'Code Reviewer', router, logger);
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Reviewer Agent. Your responsibility is to analyze code changes
    produced by the Coder Agent and ensure they meet our quality standards. Look for security 
    vulnerabilities, performance bottlenecks, and adherence to SOLID principles.
    Do not write the code yourself, but provide actionable feedback.`;
  }
}

export class TesterAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Tester', 'QA Engineer', router, logger);
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Tester Agent. You write unit, integration, and end-to-end tests 
    for newly developed features. You also execute test suites to verify that the Coder Agent's
    changes did not introduce regressions.`;
  }
}

export class SummarizerAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Summarizer', 'Information Summarizer', router, logger);
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Summarizer Agent. Your job is to take large amounts of text, 
    logs, or research data and condense it into highly actionable, easy-to-read executive summaries.
    Focus on the key takeaways and omit unnecessary noise.`;
  }
}

export class ArchitectAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Architect', 'System Architect', router, logger);
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Architect Agent. You evaluate plans and code from a high-level system architecture perspective. Focus on scalability, modularity, and maintainability. Provide structured critique and actionable improvements.`;
  }
}

export class SecurityAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Security', 'Security Specialist', router, logger);
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Security Agent. You evaluate plans and code for security vulnerabilities, access control flaws, data privacy risks, and injection attack vectors. Provide structured critique and actionable improvements.`;
  }
}

export class PerformanceAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Performance', 'Performance Engineer', router, logger);
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Performance Agent. You evaluate plans and code for computational efficiency, memory usage, algorithmic complexity, and potential bottlenecks. Provide structured critique and actionable improvements.`;
  }
}