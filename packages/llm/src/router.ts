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

        this.logger.warn(`Provider ${providerId} failed (attempt ${attempt}/${maxAttempts}): ${error.message}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
      }
    }
    throw new Error('Unreachable code');
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const providerId = this.resolveProvider(request);
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
      this.logger.error(`Provider ${providerId} failed: ${error.message}. Attempting fallback...`);
      return await this.handleFallback(request);
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamResponse> {
    const providerId = this.resolveProvider(request);
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
      this.logger.error(`Stream failed for ${providerId}: ${error.message}. Attempting fallback stream...`);
      yield* this.handleFallbackStream(request);
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

  private async handleFallback(request: LLMRequest): Promise<LLMResponse> {
    const fallbackId: LLMProviderId = 'ollama';
    const provider = this.providers.get(fallbackId);
    if (!provider) {
      throw new Error(`Fallback provider ${fallbackId} is not registered`);
    }
    this.logger.info(`Running fallback generate on ${fallbackId} with model ${request.model}`);
    
    const localRequest = { ...request, model: this.config.defaultModel || 'qwen2.5:8b' };
    const response = await provider.generate(localRequest);
    this.tracker.trackUsage(fallbackId, localRequest.model, response.usage.promptTokens, response.usage.completionTokens);
    return response;
  }

  private async *handleFallbackStream(request: LLMRequest): AsyncGenerator<LLMStreamResponse> {
    const fallbackId: LLMProviderId = 'ollama';
    const provider = this.providers.get(fallbackId);
    if (!provider) {
      throw new Error(`Fallback provider ${fallbackId} is not registered`);
    }
    this.logger.info(`Running fallback stream on ${fallbackId} with model ${request.model}`);

    const localRequest = { ...request, model: this.config.defaultModel || 'qwen2.5:8b' };
    const generator = await provider.stream(localRequest);
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
      this.tracker.trackUsage(fallbackId, localRequest.model, promptTokens, completionTokens);
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