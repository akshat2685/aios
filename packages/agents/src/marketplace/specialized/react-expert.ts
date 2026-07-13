import { BaseAgent } from '../../base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { getCodingTools } from '../../tools/coding-tools';
import { getComputerTools } from '../../tools/computer-tools';

export class ReactExpertAgent extends BaseAgent {
  constructor(
    router: LLMRouter, 
    logger: CoreLogger, 
    workspacePath = 'C:\\Users\\ijain\\AIOS',
    requestApproval?: (action: string, details: string) => Promise<boolean>
  ) {
    super('ReactExpert', 'Frontend Developer', router, logger);
    
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
    return `You are the AIOS React Expert Agent. You are an expert frontend software engineer specialized in React, Next.js, TypeScript, and modern web development.
    Your goal is to build accessible, performant, and responsive user interfaces.
    Follow React best practices, use functional components and hooks appropriately, and write clean, maintainable code.
    You have direct access to tools for interacting with files and running shell commands in the workspace.
    CRITICAL: You MUST use your tools to actually read code, write new features, analyze errors, and run tests.
    Do NOT just output the code in chat or describe what you would do. ACTUALLY EXECUTE IT using the tools provided.`;
  }
}
