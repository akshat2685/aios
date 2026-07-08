import axios, { AxiosInstance } from 'axios';

export interface AIOSClientConfig {
  baseURL?: string;
  apiKey?: string;
}

export class AIOSClient {
  private client: AxiosInstance;

  constructor(config?: AIOSClientConfig) {
    this.client = axios.create({
      baseURL: config?.baseURL || 'http://localhost:3000/api',
      headers: {
        'Authorization': `Bearer ${config?.apiKey || ''}`
      }
    });
  }

  async checkHealth(): Promise<any> {
    const res = await this.client.get('/health');
    return res.data;
  }

  async sendChatMessage(message: string): Promise<any> {
    const res = await this.client.post('/chat', { message });
    return res.data;
  }

  async getMemory(): Promise<any> {
    const res = await this.client.get('/memory');
    return res.data;
  }

  async getWorkflows(): Promise<any> {
    const res = await this.client.get('/workflow');
    return res.data;
  }

  async getWorkspace(): Promise<any> {
    const res = await this.client.get('/workspace');
    return res.data;
  }

  async getRouterStatus(): Promise<any> {
    const res = await this.client.get('/router');
    return res.data;
  }
}
