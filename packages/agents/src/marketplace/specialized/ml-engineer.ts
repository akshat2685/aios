import { BaseAgent } from '../../base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { getCodingTools } from '../../tools/coding-tools';
import { getComputerTools } from '../../tools/computer-tools';
import { getResearchTools } from '../../tools/research-tools';

export class MLEngineerAgent extends BaseAgent {
  constructor(
    router: LLMRouter, 
    logger: CoreLogger, 
    workspacePath = 'C:\\Users\\ijain\\AIOS',
    requestApproval?: (action: string, details: string) => Promise<boolean>
  ) {
    super('MLEngineer', 'Machine Learning Engineer', router, logger);
    
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

    // Register research tools for finding ML papers and datasets
    const researchTools = getResearchTools(router, logger);
    for (const tool of researchTools) {
      this.registerTool(tool);
    }
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Machine Learning Engineer Agent. You are an expert in artificial intelligence, machine learning, deep learning, PyTorch, TensorFlow, and Python.
    Your goal is to design, train, and deploy machine learning models. Write modular, efficient code for data processing, training pipelines, and model evaluation.
    You have access to coding, computer, and research tools.
    CRITICAL: You MUST use your tools to actually read code, write new features, analyze errors, and run tests.
    Do NOT just output the code in chat or describe what you would do. ACTUALLY EXECUTE IT using the tools provided.`;
  }
}
