import { ApprovalRequest, SecurityPolicy } from '@aios/types';
import { CoreLogger } from '@aios/core';

export class GuardRail {
  private logger: CoreLogger;
  private policy: SecurityPolicy;
  private approvalCallback?: (request: ApprovalRequest) => Promise<boolean>;

  constructor(logger: CoreLogger, policy: SecurityPolicy, approvalCallback?: (request: ApprovalRequest) => Promise<boolean>) {
    this.logger = logger;
    this.policy = policy;
    this.approvalCallback = approvalCallback;
  }

  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    this.logger.info(`Security GuardRail: Approval requested for action ${request.action} by agent ${request.agentId}`);
    
    if (this.policy.allowDangerousActions) {
      return true;
    }

    if (this.approvalCallback) {
      return await this.approvalCallback(request);
    }

    // Default to deny if no callback provided
    return false; 
  }

  validateAction(actionType: string): boolean {
    const rootAction = actionType.split(':')[0];
    if (
      this.policy.requireApprovalFor.includes(actionType as any) ||
      this.policy.requireApprovalFor.includes(rootAction as any)
    ) {
      return false; // Requires approval
    }
    return true;
  }
}