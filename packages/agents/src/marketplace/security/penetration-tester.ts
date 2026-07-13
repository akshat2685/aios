import { BaseAgent } from '../../base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';

export class PenetrationTestingAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('PenetrationTester', 'Penetration Tester', router, logger);

    // Register tool requirements for penetration testing
    this.registerTool({
      name: 'pentest:network_scan',
      description: 'Scan the network for open ports and services.',
      parameters: {
        type: 'object',
        properties: {
          targetIp: { type: 'string', description: 'IP or hostname to scan' }
        },
        required: ['targetIp']
      }
    });

    this.registerTool({
      name: 'pentest:exploit_runner',
      description: 'Execute safe, simulated exploits against identified vulnerabilities.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Target to exploit' },
          exploitId: { type: 'string', description: 'Exploit module to use' }
        },
        required: ['target', 'exploitId']
      }
    });
    
    this.registerTool({
      name: 'pentest:dast_scan',
      description: 'Run Dynamic Application Security Testing against a running web application.',
      parameters: {
        type: 'object',
        properties: {
          targetUrl: { type: 'string', description: 'URL of the web application' }
        },
        required: ['targetUrl']
      }
    });
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Penetration Testing Agent.
Your goal is to actively test and exploit vulnerabilities in a safe, controlled manner to demonstrate risk.
You specialize in network scanning, dynamic application security testing (DAST), and simulated exploitation.
Use 'pentest:network_scan' to discover services, 'pentest:dast_scan' for web app testing, and 'pentest:exploit_runner' to validate vulnerabilities.
CRITICAL: Never cause denial of service or permanent data loss. Always summarize the attack vector, impact, and proof-of-concept.`;
  }
}

/**
 * Factory function to hook into the Marketplace registry.
 */
export function createAgent(router: LLMRouter, logger: CoreLogger): BaseAgent {
  return new PenetrationTestingAgent(router, logger);
}
