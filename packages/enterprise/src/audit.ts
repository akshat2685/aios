import { CoreLogger } from '@aios/core';

export interface AuditRecord {
  id: string;
  timestamp: string;
  actor: string; // User ID or Agent ID
  action: string;
  resource: string;
  details: Record<string, any>;
}

export class AuditLogger {
  private logger: CoreLogger;
  
  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  /**
   * Logs a structured, immutable audit record for compliance.
   * In a true enterprise setup, this would be cryptographically signed or appended to a WORM (Write Once Read Many) store.
   */
  public logAction(actor: string, action: string, resource: string, details: Record<string, any> = {}) {
    const record: AuditRecord = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      actor,
      action,
      resource,
      details
    };

    // Forward to secure storage (stubbed)
    this.logger.info(`AUDIT LOG [${record.timestamp}] ${actor} performed ${action} on ${resource}`);
  }
}
