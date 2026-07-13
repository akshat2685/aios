export type LLMProviderId = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'nvidia' | 'openrouter' | 'custom';

export type TaskType = 
  | 'GENERAL_CHAT' 
  | 'CODING' 
  | 'REASONING' 
  | 'RESEARCH' 
  | 'VISION' 
  | 'SUMMARIZATION' 
  | 'TRANSLATION' 
  | 'PLANNING' 
  | 'RAG' 
  | 'TOOL_USE';

export type RoutingProfile = 'BALANCED' | 'FASTEST' | 'CHEAPEST' | 'HIGHEST_QUALITY';

export type CloudMode = 'local' | 'online' | 'hybrid';
export type RoutingMode = 'automatic' | 'advanced';

export interface ModelCapability {
  providerId: string;
  modelId: string;
  
  // Capability scores (0-10)
  coding: number;
  reasoning: number;
  speed: number;
  cost: number; // 10 = free/cheap, 1 = expensive
  
  // Capabilities
  vision: boolean;
  contextWindow: number;
  toolCalling: boolean;
  functionCalling: boolean;
  multimodal: boolean;
  streaming: boolean;
  
  // Limits
  maxTokens: number;
  
  // Metadata
  isLocal: boolean;
  providerName?: string;
}

export interface ProviderHealth {
  providerId: string;
  healthy: boolean;
  avgLatency: number; // ms
  successRate: number; // 0-1
  consecutiveFailures: number;
  cooldownUntil: number | null;
  lastFailure: number | null;
  totalRequests: number;
  totalErrors: number;
}

export interface ProviderHealthState {
  healthy: boolean;
  avgLatency: number;
  successRate: number;
  cooldownUntil: number | null;
  lastFailure: number | null;
  consecutiveFailures: number;
  totalRequests: number;
  totalErrors: number;
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
  // Advanced mode
  forceProvider?: LLMProviderId;
  forceModel?: string;
  disableFailover?: boolean;
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
  // Explainability
  routingDecision?: RoutingDecision;
}

export interface RoutingDecision {
  selectedProvider: string;
  selectedModel: string;
  taskType: TaskType;
  confidence: number;
  profile: RoutingProfile;
  scores: ModelScore[];
  reason: string;
  fallbackReason?: string;
}

export interface ModelScore {
  providerId: string;
  modelId: string;
  score: number;
  capabilities: ModelCapability;
  health: ProviderHealthState;
  penalties: string[];
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
  cloudMode?: CloudMode;
  routingMode?: RoutingMode;
  providers: Record<LLMProviderId, {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    timeout?: number;
  }>;
  agentBudgets?: Record<string, { maxTokens: number }>;
  
  // Local model config
  localModels?: {
    generalModel?: string;
    codingModel?: string;
  };
  
  // User preferences
  userPreferences?: UserPreferences;
}

export interface UserPreferences {
  preferLocal: boolean;
  preferOpenSource: boolean;
  preferCheapest: boolean;
  preferredProviders?: LLMProviderId[];
  disabledProviders?: LLMProviderId[];
  disabledModels?: string[];
}

export interface ModelCacheEntry {
  providerId: string;
  modelId: string;
  capabilities: ModelCapability;
  discoveredAt: number;
  source: 'api' | 'heuristic' | 'manual';
}