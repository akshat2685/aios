import { BaseAgent } from './base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { getCodingTools } from './tools/coding-tools';
import { getResearchTools } from './tools/research-tools';
import { getComputerTools } from './tools/computer-tools';

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
    Use your tools to read code, write new features, analyze errors, and run tests/builds to verify your work.`;
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

import { getPlannerTools } from './tools/planner-tools';

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
    Focus on efficiency and risk mitigation.`;
  }
}