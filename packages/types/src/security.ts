export interface Secret {
  key: string;
  value: string;
  service: string;
  updatedAt: number;
}

export interface SecurityPolicy {
  allowDangerousActions: boolean;
  requireApprovalFor: ('shell' | 'file_delete' | 'api_write')[];
  encryptionEnabled: boolean;
  airGappedMode: boolean;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  params: any;
  agentId: string;
  timestamp: number;
}