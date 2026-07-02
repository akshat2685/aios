export type LLMProviderId = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'nvidia' | 'openrouter' | 'custom';

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  stream?: boolean;
  taskType?: 'coding' | 'reasoning' | 'chat';
  agentId?: string;
  priority?: number;
  abortSignal?: AbortSignal;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: LLMProviderId;
  model: string;
}

export interface LLMStreamResponse {
  chunk: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILLMProvider {
  id: LLMProviderId;
  name: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): Promise<AsyncGenerator<LLMStreamResponse>>;
  checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; latency?: number }>;
  getSupportedModels(): Promise<string[]>;
}

export interface LLMConfig {
  defaultProvider: LLMProviderId;
  defaultModel: string;
  providers: Record<LLMProviderId, {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    timeout?: number;
  }>;
  agentBudgets?: Record<string, { maxTokens: number }>;
}