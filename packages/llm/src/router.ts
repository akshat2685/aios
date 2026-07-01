import { LLMProviderId, ILLMProvider, LLMRequest, LLMResponse, LLMStreamResponse } from '@aios/types';
import { OllamaProvider } from './providers/ollama';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { OpenRouterProvider } from './providers/openrouter';
import { NvidiaProvider } from './providers/nvidia';
import { CustomProvider } from './providers/custom';
import { CoreLogger } from '@aios/core';
import { LLMConfig } from '@aios/types';
import { SecretManager } from '@aios/security';
import { LLMTracker } from './tracker';

export class LLMRouter {
  private providers: Map<LLMProviderId, ILLMProvider> = new Map();
  private config: LLMConfig;
  private logger: CoreLogger;
  private security: SecretManager;
  public tracker: LLMTracker;

  private rateLimitedProviders: Map<string, number> = new Map();
  private quotaExhaustedProviders: Map<string, number> = new Map();
  private readonly RATE_LIMIT_COOLING_MS = 5 * 60 * 1000; // 5 minutes
  private readonly QUOTA_COOLING_MS = 5 * 60 * 60 * 1000; // 5 hours

  constructor(config: LLMConfig, security: SecretManager, logger: CoreLogger) {
    this.config = config;
    this.security = security;
    this.logger = logger;
    this.tracker = new LLMTracker();

    // Register all built providers
    this.registerProvider(new OllamaProvider({ baseUrl: config.providers.ollama?.baseUrl }, logger));
    this.registerProvider(new OpenAIProvider(security, logger));
    this.registerProvider(new AnthropicProvider(security, logger));
    this.registerProvider(new GeminiProvider(security, logger));
    this.registerProvider(new OpenRouterProvider(security, logger));
    this.registerProvider(new NvidiaProvider(security, logger));
    this.registerProvider(new CustomProvider(security, logger));
  }

  async registerProvider(provider: ILLMProvider) {
    this.providers.set(provider.id, provider);
    this.logger.info(`Registered LLM Provider: ${provider.name}`);
  }

  private async executeWithRetry<T>(
    providerId: LLMProviderId,
    operation: () => Promise<T>,
    maxAttempts = 3
  ): Promise<T> {
    let attempt = 0;
    let delay = 500;

    while (attempt < maxAttempts) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw error;
        }
        
        // Don't retry API key or auth errors
        if (
          error.message?.includes('API Key') || 
          error.message?.includes('key is invalid') || 
          error.status === 401 || 
          error.status === 403
        ) {
          throw error;
        }

        // Check for Rate Limit or Quota Exhaustion
        const msg = error.message?.toLowerCase() || '';
        if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
          error.isRateLimit = true;
          throw error;
        }
        if (error.status === 402 || msg.includes('quota') || msg.includes('insufficient_quota') || msg.includes('balance') || msg.includes('exhausted')) {
          error.isQuota = true;
          throw error;
        }

        this.logger.warn(`Provider ${providerId} failed (attempt ${attempt}/${maxAttempts}): ${error.message}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
      }
    }
    throw new Error('Unreachable code');
  }

  private isProviderCooling(providerId: string): boolean {
    const now = Date.now();
    if (this.rateLimitedProviders.has(providerId)) {
      if (now - this.rateLimitedProviders.get(providerId)! < this.RATE_LIMIT_COOLING_MS) return true;
      this.rateLimitedProviders.delete(providerId);
    }
    if (this.quotaExhaustedProviders.has(providerId)) {
      if (now - this.quotaExhaustedProviders.get(providerId)! < this.QUOTA_COOLING_MS) return true;
      this.quotaExhaustedProviders.delete(providerId);
    }
    return false;
  }

  private getNextAvailableProvider(): { providerId: LLMProviderId, model: string } {
    const chain = [
      { id: 'gemini', model: 'gemini-1.5-flash' },
      { id: 'openai', model: 'gpt-4-turbo-preview' },
      { id: 'anthropic', model: 'claude-3-haiku-20240307' },
      { id: 'openrouter', model: 'mistralai/mistral-large-latest' },
      { id: 'custom', model: 'command-r' },
      { id: 'ollama', model: this.config.defaultModel || 'llama3.2' },
    ] as const;

    for (const step of chain) {
      if (this.providers.has(step.id as LLMProviderId) && !this.isProviderCooling(step.id)) {
        return { providerId: step.id as LLMProviderId, model: step.model };
      }
    }
    return { providerId: 'ollama', model: this.config.defaultModel || 'llama3.2' };
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    let providerId = this.resolveProvider(request);
    let requestModel = request.model;

    if (this.isProviderCooling(providerId)) {
      const fallback = this.getNextAvailableProvider();
      providerId = fallback.providerId;
      requestModel = fallback.model;
      request = { ...request, model: requestModel };
    }

    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`LLM Provider ${providerId} is not registered`);
    }

    try {
      const response = await this.executeWithRetry(providerId, () => provider.generate(request));
      this.tracker.trackUsage(
        providerId,
        request.model,
        response.usage.promptTokens,
        response.usage.completionTokens
      );
      return response;
    } catch (error: any) {
      this.logger.error(`Provider ${providerId} failed: ${error.message}. Attempting failover chain...`);
      return await this.handleFallback(request, providerId, error);
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamResponse> {
    let providerId = this.resolveProvider(request);
    let requestModel = request.model;

    if (this.isProviderCooling(providerId)) {
      const fallback = this.getNextAvailableProvider();
      providerId = fallback.providerId;
      requestModel = fallback.model;
      request = { ...request, model: requestModel };
    }

    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`LLM Provider ${providerId} is not registered`);
    }

    try {
      const generator = await provider.stream(request);
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of generator) {
        if (chunk.usage) {
          promptTokens = chunk.usage.promptTokens || promptTokens;
          completionTokens = chunk.usage.completionTokens || completionTokens;
        }
        yield chunk;
      }

      if (promptTokens > 0 || completionTokens > 0) {
        this.tracker.trackUsage(providerId, request.model, promptTokens, completionTokens);
      }
    } catch (error: any) {
      this.logger.error(`Stream failed for ${providerId}: ${error.message}. Attempting failover chain...`);
      yield* this.handleFallbackStream(request, providerId, error);
    }
  }

  private resolveProvider(request: LLMRequest): LLMProviderId {
    const model = request.model.toLowerCase();
    
    if (model.includes('gpt-') || model.includes('text-davinci')) {
      return 'openai';
    }
    if (model.includes('claude-')) {
      return 'anthropic';
    }
    if (model.includes('gemini-')) {
      return 'gemini';
    }
    if (model.includes('meta-llama') || model.includes('mistralai/') || model.includes(':free')) {
      return 'openrouter';
    }
    if (model.includes('meta/llama') || model.includes('nvidia/')) {
      return 'nvidia';
    }
    
    return this.config.defaultProvider || 'ollama';
  }

  private async handleFallback(request: LLMRequest, failedProviderId: string, error: any): Promise<LLMResponse> {
    if (error.isRateLimit) this.rateLimitedProviders.set(failedProviderId, Date.now());
    if (error.isQuota) this.quotaExhaustedProviders.set(failedProviderId, Date.now());

    const { providerId, model } = this.getNextAvailableProvider();
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      throw new Error(`Fallback provider ${providerId} is not registered`);
    }
    
    this.logger.info(`Failing over from ${failedProviderId} to ${providerId} (model: ${model})`);
    
    const fallbackRequest = { ...request, model };
    const response = await this.executeWithRetry(providerId, () => provider.generate(fallbackRequest));
    this.tracker.trackUsage(providerId, fallbackRequest.model, response.usage.promptTokens, response.usage.completionTokens);
    return response;
  }

  private async *handleFallbackStream(request: LLMRequest, failedProviderId: string, error: any): AsyncGenerator<LLMStreamResponse> {
    if (error.isRateLimit) this.rateLimitedProviders.set(failedProviderId, Date.now());
    if (error.isQuota) this.quotaExhaustedProviders.set(failedProviderId, Date.now());

    const { providerId, model } = this.getNextAvailableProvider();
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      throw new Error(`Fallback provider ${providerId} is not registered`);
    }
    
    this.logger.info(`Failing over stream from ${failedProviderId} to ${providerId} (model: ${model})`);

    const fallbackRequest = { ...request, model };
    const generator = await provider.stream(fallbackRequest);
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of generator) {
      if (chunk.usage) {
        promptTokens = chunk.usage.promptTokens || promptTokens;
        completionTokens = chunk.usage.completionTokens || completionTokens;
      }
      yield chunk;
    }

    if (promptTokens > 0 || completionTokens > 0) {
      this.tracker.trackUsage(providerId, fallbackRequest.model, promptTokens, completionTokens);
    }
  }

  async checkAllHealth() {
    const health: Record<string, any> = {};
    for (const [id, provider] of this.providers) {
      try {
        health[id] = await provider.checkHealth();
      } catch (e: any) {
        health[id] = { status: 'unhealthy', error: e.message };
      }
    }
    return health;
  }
}