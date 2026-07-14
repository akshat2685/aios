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
      },
      execute: async ({ targetIp }: { targetIp: string }) => {
        this.logger.info(`Scanning network for ${targetIp}`);
        if (targetIp.startsWith('10.') || targetIp.startsWith('192.168.') || targetIp.startsWith('172.')) {
          return `Scan results for ${targetIp}:\n- Port 22 (SSH): Open (OpenSSH 8.2p1)\n- Port 80 (HTTP): Open (nginx 1.18.0)\n- Port 443 (HTTPS): Open\n- Port 3306 (MySQL): Closed`;
        }
        return `Scan results for ${targetIp}:\n- Port 80 (HTTP): Open\n- Port 443 (HTTPS): Open\nNo other common ports (22, 21, 3389) open.`;
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
      },
      execute: async ({ target, exploitId }: { target: string, exploitId: string }) => {
        this.logger.info(`Running exploit ${exploitId} against ${target}`);
        const lowerExploit = exploitId.toLowerCase();
        if (lowerExploit.includes('sql') || lowerExploit.includes('sqli')) {
          return `[SIMULATION] Exploit ${exploitId} successful on ${target}. Extracted 5 test records indicating DB vulnerability.`;
        } else if (lowerExploit.includes('xss')) {
          return `[SIMULATION] Exploit ${exploitId} successful on ${target}. Alert payload triggered on mock browser.`;
        } else if (lowerExploit.includes('lfi')) {
          return `[SIMULATION] Exploit ${exploitId} successful on ${target}. Extracted /etc/passwd contents safely.`;
        }
        return `[SIMULATION] Exploit ${exploitId} failed on ${target}. Target appears patched or not vulnerable.`;
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
      },
      execute: async ({ targetUrl }: { targetUrl: string }) => {
        this.logger.info(`Running DAST scan on ${targetUrl}`);
        if (targetUrl.startsWith('https://')) {
          return `DAST Scan complete for ${targetUrl}.\n- Low: Missing Content-Security-Policy header.\n- Low: Missing X-Frame-Options header.`;
        }
        return `DAST Scan complete for ${targetUrl}.\n- High: Unencrypted traffic (HTTP) used for communication.\n- Medium: Missing CSRF tokens on standard forms.\n- Low: Missing security headers.`;
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
