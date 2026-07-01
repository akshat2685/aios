import { ApprovalRequest, SecurityPolicy } from '@aios/types';
import { CoreLogger } from '@aios/core';

export class GuardRail {
  private logger: CoreLogger;
  private policy: SecurityPolicy;

  constructor(logger: CoreLogger, policy: SecurityPolicy) {
    this.logger = logger;
    this.policy = policy;
  }

  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    this.logger.info(`Security GuardRail: Approval requested for action ${request.action} by agent ${request.agentId}`);
    
    if (this.policy.allowDangerousActions) {
      return true;
    }

    // In a production Electron app, this would trigger an IPC call to the frontend
    // to show a confirmation dialog.
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