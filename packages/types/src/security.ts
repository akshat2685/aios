export interface Secret {
  key: string;
  value: string;
  service: string;
  updatedAt: number;
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface SecurityPolicy {
  allowDangerousActions: boolean;
  requireApprovalFor: ('shell' | 'file_delete' | 'api_write')[];
  encryptionEnabled: boolean;
  airGappedMode: boolean;
}

export interface SecurityRule {
  id: string;
  action: string;      // e.g., 'shell:run'
  target: string;      // e.g., 'npm run build' or '*'
  agentId: string;     // e.g., 'coder'
  decision: 'allow' | 'deny';
  createdAt: number;
  expiresAt?: number;
  createdBy: 'user' | 'system';
  usageCount: number;
  lastUsed?: number;
}

export interface AuditLogEntry {
  timestamp: string;
  agent: string;
  action: string;
  target: string;
  decision: 'allow' | 'deny' | 'timeout';
  reason?: string;
  cwd?: string;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  target: string; // The command or file path
  params: any;
  agentId: string;
  timestamp: number;
  cwd?: string;
  reason?: string;
}