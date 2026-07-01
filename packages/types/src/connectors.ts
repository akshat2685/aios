export interface IngestionPayload {
  source: string;
  content: string;
  metadata: {
    timestamp: number;
    type: 'file' | 'clipboard' | 'browser' | 'app';
    path?: string;
    url?: string;
    appId?: string;
    tags?: string[];
  };
}

export interface IConnector {
  id: string;
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): 'active' | 'inactive' | 'error';
}