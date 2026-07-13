import fs from 'fs-extra';
import path from 'path';
import * as os from 'os';
import { ApprovalRequest, SecurityPolicy, SecurityRule, AuditLogEntry, RiskLevel } from '@aios/types';
import { CoreLogger } from '@aios/core';

const AIOS_DIR = path.join(os.homedir(), '.aios');
const PERSISTENT_RULES_FILE = path.join(AIOS_DIR, 'security-rules.json');
const SESSION_RULES_FILE = path.join(AIOS_DIR, 'session-permissions.json');
const AUDIT_LOG_FILE = path.join(AIOS_DIR, 'security-history.log');

export class GuardRail {
  private logger: CoreLogger;
  private policy: SecurityPolicy;
  private approvalCallback?: (request: ApprovalRequest, risk: RiskLevel) => Promise<'allow_once' | 'allow_session' | 'allow_always' | 'deny_once' | 'deny_always' | 'timeout'>;
  
  private persistentRules: SecurityRule[] = [];
  private sessionRules: SecurityRule[] = [];

  constructor(
    logger: CoreLogger, 
    policy: SecurityPolicy, 
    approvalCallback?: (request: ApprovalRequest, risk: RiskLevel) => Promise<'allow_once' | 'allow_session' | 'allow_always' | 'deny_once' | 'deny_always' | 'timeout'>
  ) {
    this.logger = logger;
    this.policy = policy;
    this.approvalCallback = approvalCallback;
    this.init();
  }

  private async init() {
    await fs.ensureDir(AIOS_DIR);
    
    try {
      if (await fs.pathExists(PERSISTENT_RULES_FILE)) {
        this.persistentRules = await fs.readJson(PERSISTENT_RULES_FILE);
      }
    } catch(e) { this.logger.warn('Failed to read persistent rules'); }
    
    this.sessionRules = [];
  }

  private async savePersistentRules() {
    await fs.writeJson(PERSISTENT_RULES_FILE, this.persistentRules, { spaces: 2 });
  }

  private async saveSessionRules() {
    await fs.writeJson(SESSION_RULES_FILE, this.sessionRules, { spaces: 2 });
  }

  private async logAudit(entry: AuditLogEntry) {
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(AUDIT_LOG_FILE, line, 'utf8');
  }

  private matchTarget(ruleTarget: string, requestTarget: string): boolean {
    if (ruleTarget === '*' || ruleTarget === requestTarget) return true;
    if (ruleTarget.includes('*')) {
      const regexStr = '^' + ruleTarget.replace(/\*/g, '.*') + '$';
      return new RegExp(regexStr).test(requestTarget);
    }
    return false;
  }

  private getRiskLevel(action: string, target: string): RiskLevel {
    if (action === 'shell:run' || action === 'computer_run_shell') {
      const t = target.toLowerCase();
      if (/\b(rm|rmdir|del|format|shutdown|reboot|sudo|chmod)\b/.test(t) || t.includes('invoke-webrequest') || t.includes('wget') || t.includes('curl')) {
        return RiskLevel.CRITICAL;
      }
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  private agentPermissions: Record<string, string[]> = {
    'planner': ['fs:read', 'web:search', 'memory:read', 'memory:write', 'browser:read', 'workflow:manage'],
    'researcher': ['fs:read', 'web:search', 'memory:read', 'memory:write', 'browser:read'],
    'coder': ['fs:read', 'fs:write', 'shell:run', 'computer_run_shell', 'memory:read', 'memory:write'],
    'reviewer': ['fs:read', 'memory:read', 'memory:write']
  };

  private isAgentPermitted(agentId: string, action: string): boolean {
    // Least Privilege Access
    const allowedActions = this.agentPermissions[agentId];
    if (!allowedActions) {
      // Fallback for unknown agents - strict deny by default
      return false;
    }
    
    const act = action.split(':')[0];
    
    if (allowedActions.includes(action) || allowedActions.includes(`${act}:*`)) {
      return true;
    }
    
    if ((action === 'shell:run' || action === 'computer_run_shell') && allowedActions.includes('shell:run')) {
      return true;
    }
    
    return false;
  }

  private createAudit(request: ApprovalRequest, decision: 'allow' | 'deny' | 'timeout', reason: string): AuditLogEntry {
    return {
      timestamp: new Date().toISOString(),
      agent: request.agentId,
      action: request.action,
      target: request.target,
      decision,
      reason,
      cwd: request.cwd
    };
  }

  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    this.logger.info(`Security GuardRail: Analyzing action ${request.action} on "${request.target}" by agent ${request.agentId}`);
    
    if (!this.isAgentPermitted(request.agentId, request.action)) {
      this.logger.warn(`Agent ${request.agentId} is strictly forbidden from action ${request.action}`);
      await this.logAudit(this.createAudit(request, 'deny', 'Strict agent baseline policy violation'));
      return false;
    }

    const risk = this.getRiskLevel(request.action, request.target);
    
    // Check Session Rules
    const sRule = this.sessionRules.find(r => r.agentId === request.agentId && r.action === request.action && this.matchTarget(r.target, request.target));
    if (sRule) {
      sRule.usageCount++;
      sRule.lastUsed = Date.now();
      await this.saveSessionRules();
      
      if (sRule.decision === 'deny') {
        await this.logAudit(this.createAudit(request, 'deny', 'Session rule denied'));
        return false;
      }
      if (sRule.decision === 'allow' && risk !== RiskLevel.CRITICAL) {
        await this.logAudit(this.createAudit(request, 'allow', 'Session rule allowed'));
        return true;
      }
    }

    // Check Persistent Rules
    const pRule = this.persistentRules.find(r => r.agentId === request.agentId && r.action === request.action && this.matchTarget(r.target, request.target));
    if (pRule) {
      pRule.usageCount++;
      pRule.lastUsed = Date.now();
      await this.savePersistentRules();
      
      if (pRule.decision === 'deny') {
        await this.logAudit(this.createAudit(request, 'deny', 'Persistent rule denied'));
        return false;
      }
      if (pRule.decision === 'allow' && risk !== RiskLevel.CRITICAL) {
        await this.logAudit(this.createAudit(request, 'allow', 'Persistent rule allowed'));
        return true;
      }
    }

    // Prompt user
    if (this.approvalCallback) {
      const decision = await this.approvalCallback(request, risk);
      let finalAllow = false;
      
      if (decision === 'timeout') {
         await this.logAudit(this.createAudit(request, 'timeout', 'User prompt timed out'));
         return false;
      }

      if (decision === 'allow_once' || decision === 'allow_session' || decision === 'allow_always') {
        finalAllow = true;
      }

      const createRule = (decisionType: 'allow' | 'deny'): SecurityRule => ({
        id: Math.random().toString(36).substring(7),
        action: request.action,
        target: request.target,
        agentId: request.agentId,
        decision: decisionType,
        createdAt: Date.now(),
        createdBy: 'user',
        usageCount: 1,
        lastUsed: Date.now()
      });

      if (decision === 'allow_session') {
         this.sessionRules.push(createRule('allow'));
         await this.saveSessionRules();
      } else if (decision === 'allow_always') {
         this.persistentRules.push(createRule('allow'));
         await this.savePersistentRules();
      } else if (decision === 'deny_always') {
         this.persistentRules.push(createRule('deny'));
         await this.savePersistentRules();
      }

      await this.logAudit(this.createAudit(request, finalAllow ? 'allow' : 'deny', `Interactive prompt: ${decision}`));
      
      return finalAllow;
    }

    await this.logAudit(this.createAudit(request, 'deny', 'No callback provided'));
    return false;
  }

  // --- API for UI ---
  public getPersistentRules(): SecurityRule[] {
    return this.persistentRules;
  }

  public getSessionRules(): SecurityRule[] {
    return this.sessionRules;
  }

  public async deletePersistentRule(id: string): Promise<boolean> {
    const initialLen = this.persistentRules.length;
    this.persistentRules = this.persistentRules.filter(r => r.id !== id);
    if (this.persistentRules.length < initialLen) {
      await this.savePersistentRules();
      return true;
    }
    return false;
  }

  public async deleteSessionRule(id: string): Promise<boolean> {
    const initialLen = this.sessionRules.length;
    this.sessionRules = this.sessionRules.filter(r => r.id !== id);
    if (this.sessionRules.length < initialLen) {
      await this.saveSessionRules();
      return true;
    }
    return false;
  }

  public async getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      if (!(await fs.pathExists(AUDIT_LOG_FILE))) return [];
      const content = await fs.readFile(AUDIT_LOG_FILE, 'utf8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      const logs = lines.map(l => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      }).filter(Boolean) as AuditLogEntry[];
      
      return logs.slice(-limit).reverse();
    } catch (e) {
      this.logger.error(`Failed to read audit logs: ${e}`);
      return [];
    }
  }
}