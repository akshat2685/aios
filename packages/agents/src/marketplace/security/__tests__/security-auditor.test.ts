import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import { createAgent, SecurityAuditorAgent } from '../security-auditor';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('SecurityAuditorAgent', () => {
  const mockRouter = {} as any;
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any;
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-auditor-test-'));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should run SAST scan and find issues', async () => {
    const agent = createAgent(mockRouter, mockLogger) as SecurityAuditorAgent;
    
    // Create a dummy file with vulnerabilities
    const testFile = path.join(tempDir, 'app.ts');
    fs.writeFileSync(testFile, `
      const password = "hardcoded_password";
      eval("console.log('danger')");
    `);

    const res = await agent.executeTool('audit:sast_scan', { targetDirectory: tempDir });
    expect(res).toContain('Hardcoded credential/secret detected');
    expect(res).toContain('Use of eval() detected');
  });

  it('should check dependencies for vulnerabilities', async () => {
    const agent = createAgent(mockRouter, mockLogger) as SecurityAuditorAgent;
    
    const manifestFile = path.join(tempDir, 'package.json');
    fs.writeFileSync(manifestFile, JSON.stringify({
      dependencies: { lodash: '^4.17.15', express: '3.0.0' },
      devDependencies: { axios: '0.21.0' }
    }));

    const res = await agent.executeTool('audit:dependency_check', { manifestFile });
    expect(res).toContain('lodash ^4.17.15: High - Prototype Pollution');
    expect(res).toContain('express 3.0.0: High - Outdated version');
    expect(res).toContain('axios 0.21.0: High - SSRF vulnerability');
  });

  it('should perform compliance check', async () => {
    const agent = createAgent(mockRouter, mockLogger) as SecurityAuditorAgent;

    const resSoc2 = await agent.executeTool('audit:compliance_check', { targetDirectory: tempDir, standard: 'SOC2' });
    expect(resSoc2).toContain('Failure: Missing central access logging middleware');

    const resOwasp = await agent.executeTool('audit:compliance_check', { targetDirectory: tempDir, standard: 'OWASP' });
    expect(resOwasp).toContain('Warning: No global rate limiting detected');
  });
});
