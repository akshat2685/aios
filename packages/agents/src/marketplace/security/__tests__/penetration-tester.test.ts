import { describe, it, expect, vi } from 'vitest';
import { createAgent, PenetrationTestingAgent } from '../penetration-tester';

describe('PenetrationTestingAgent', () => {
  const mockRouter = {} as any;
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any;

  it('should initialize correctly', () => {
    const agent = createAgent(mockRouter, mockLogger) as PenetrationTestingAgent;
    expect(agent.state.name).toBe('PenetrationTester');
  });

  it('should execute network scan', async () => {
    const agent = createAgent(mockRouter, mockLogger) as PenetrationTestingAgent;
    const res1 = await agent.executeTool('pentest:network_scan', { targetIp: '10.0.0.1' });
    expect(res1).toContain('Port 22 (SSH): Open');

    const res2 = await agent.executeTool('pentest:network_scan', { targetIp: '8.8.8.8' });
    expect(res2).toContain('No other common ports');
  });

  it('should run simulated exploits', async () => {
    const agent = createAgent(mockRouter, mockLogger) as PenetrationTestingAgent;
    const resSql = await agent.executeTool('pentest:exploit_runner', { target: 'http://app', exploitId: 'sqli_auth_bypass' });
    expect(resSql).toContain('successful');
    expect(resSql).toContain('Extracted 5 test records');

    const resXss = await agent.executeTool('pentest:exploit_runner', { target: 'http://app', exploitId: 'xss_payload' });
    expect(resXss).toContain('Alert payload triggered');

    const resFail = await agent.executeTool('pentest:exploit_runner', { target: 'http://app', exploitId: 'unknown_0day' });
    expect(resFail).toContain('failed');
  });

  it('should run DAST scans', async () => {
    const agent = createAgent(mockRouter, mockLogger) as PenetrationTestingAgent;
    const resHttps = await agent.executeTool('pentest:dast_scan', { targetUrl: 'https://secure-app.com' });
    expect(resHttps).toContain('Low: Missing Content-Security-Policy');

    const resHttp = await agent.executeTool('pentest:dast_scan', { targetUrl: 'http://insecure-app.com' });
    expect(resHttp).toContain('High: Unencrypted traffic (HTTP)');
  });
});
