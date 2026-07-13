import { BaseAgent } from '../../base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { getAwsTools } from './aws-tools';

export class AwsArchitectAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('AWS Architect', 'Cloud Infrastructure Architect', router, logger);
    
    // Register AWS tools
    const tools = getAwsTools(logger);
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS AWS Architect Agent. You specialize in designing, analyzing, and deploying AWS cloud infrastructure. 
    You have deep knowledge of AWS services like EC2, S3, RDS, Lambda, VPC, IAM, etc.
    Your goal is to follow AWS Well-Architected Framework principles (Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability).
    You can use your tools to analyze CloudFormation templates, check IAM policies, estimate AWS costs, and suggest architecture improvements.`;
  }
}
