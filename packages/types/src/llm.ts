export type LLMProviderId = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'nvidia' | 'openrouter' | 'custom';

export type TaskType = 'GENERAL_CHAT' | 'CODING' | 'REASONING' | 'RESEARCH' | 'VISION' | 'SUMMARIZATION' | 'TRANSLATION' | 'PLANNING' | 'RAG' | 'TOOL_USE';

export type RoutingProfile = 'BALANCED' | 'FASTEST' | 'CHEAPEST' | 'HIGHEST_QUALITY';

export interface ModelCapability {
  providerId: string;
  modelId: string;
  coding: number;
  reasoning: number;
  speed: number;
  cost: number;
  vision: boolean;
  contextWindow: number;
  toolCalling: boolean;
  streaming: boolean;
  maxTokens: number;
}

export interface ProviderHealth {
  healthy: boolean;
  avgLatency: number;
  successRate: number;
  cooldownUntil: number | null;
  lastFailure: number | null;
  consecutiveFailures: number;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  stream?: boolean;
  taskType?: TaskType;
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
  routingProfile?: RoutingProfile;
  providers: Record<LLMProviderId, {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    timeout?: number;
  }>;
  agentBudgets?: Record<string, { maxTokens: number }>;
}