import { BaseAgent } from '../../base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';

export class SecurityAuditorAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('SecurityAuditor', 'Security Auditor', router, logger);

    // Register tool requirements for security auditing
    this.registerTool({
      name: 'audit:sast_scan',
      description: 'Run static application security testing (SAST) on the codebase.',
      parameters: {
        type: 'object',
        properties: {
          targetDirectory: { type: 'string', description: 'Directory to scan' }
        },
        required: ['targetDirectory']
      },
      execute: async () => 'mock result'
    });

    this.registerTool({
      name: 'audit:dependency_check',
      description: 'Check for vulnerable dependencies using known CVE databases.',
      parameters: {
        type: 'object',
        properties: {
          manifestFile: { type: 'string', description: 'Path to package.json or similar manifest' }
        },
        required: ['manifestFile']
      },
      execute: async () => 'mock result'
    });
    
    this.registerTool({
      name: 'audit:compliance_check',
      description: 'Check code for compliance with security standards (e.g., OWASP, SOC2).',
      parameters: {
        type: 'object',
        properties: {
          targetDirectory: { type: 'string', description: 'Directory to evaluate' },
          standard: { type: 'string', description: 'Standard to check against' }
        },
        required: ['targetDirectory', 'standard']
      },
      execute: async () => 'mock result'
    });
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Security Auditor Agent. 
Your goal is to statically analyze source code, configurations, and dependencies for security vulnerabilities.
Look for OWASP Top 10 vulnerabilities, insecure defaults, and compliance issues.
Use your tools ('audit:sast_scan', 'audit:dependency_check', 'audit:compliance_check') to evaluate the target application.
Always provide a detailed report with CVEs (if applicable), severity levels, and actionable remediation steps.`;
  }
}

/**
 * Factory function to hook into the Marketplace registry.
 */
export function createAgent(router: LLMRouter, logger: CoreLogger): BaseAgent {
  return new SecurityAuditorAgent(router, logger);
}
