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
import { LLMCache } from './cache';
import { TelemetryEngine } from '@aios/core';

import { RequestManager } from './queue';

export interface ProviderState {
  healthy: boolean;
  rateLimited: boolean;
  quotaExhausted: boolean;
  cooldownUntil: number | null;
  latency: number;
  consecutive429Count: number;
  consecutiveFailures: number;
  successCount: number;
  errorCount: number;
  circuitState: 'closed' | 'open' | 'half-open';
}

export class LLMRouter {
  private providers: Map<LLMProviderId, ILLMProvider> = new Map();
  private config: LLMConfig;
  private logger: CoreLogger;
  private security: SecretManager;
  public tracker: LLMTracker;
  private requestManagers: Map<string, RequestManager> = new Map();
  public cache: LLMCache;
  private telemetry: TelemetryEngine;

  private providerStates: Map<string, ProviderState> = new Map();
  private readonly CIRCUIT_BREAKER_TRIP_LIMIT = 3;
  private readonly RATE_LIMIT_COOLING_MS = 15 * 60 * 1000; // 15 minutes circuit breaker
  private readonly QUOTA_COOLING_MS = 5 * 60 * 60 * 1000; // 5 hours

  constructor(config: LLMConfig, security: SecretManager, logger: CoreLogger) {
    this.config = config;
    this.security = security;
    this.logger = logger;
    this.telemetry = TelemetryEngine.getInstance();
    this.tracker = new LLMTracker();
    this.cache = new LLMCache();

    // Register all built providers
    this.registerProvider(new OllamaProvider({ baseUrl: config.providers.ollama?.baseUrl }, logger));
    this.registerProvider(new OpenAIProvider(security, logger));
    this.registerProvider(new AnthropicProvider(security, logger));
    this.registerProvider(new GeminiProvider(security, logger));
    this.registerProvider(new OpenRouterProvider(security, logger));
    this.registerProvider(new NvidiaProvider(security, logger));
    this.registerProvider(new CustomProvider(security, logger));

    this.startWatchdog();
  }

  private startWatchdog() {
    setInterval(async () => {
      const healthStates = await this.checkAllHealth();
      for (const [id, health] of Object.entries(healthStates)) {
        const state = this.getState(id);
        if (health.status === 'healthy') {
          // If previously tripped but now healthy and cooldown expired
          if (!state.healthy && (!state.cooldownUntil || Date.now() > state.cooldownUntil)) {
            state.healthy = true;
            state.rateLimited = false;
            state.quotaExhausted = false;
            state.consecutive429Count = 0;
            state.cooldownUntil = null;
          }
        } else {
          // Only mark unhealthy if it's not a circuit-breaker related offline (e.g. general disconnect)
          if (state.healthy && !state.rateLimited && !state.quotaExhausted) {
             state.healthy = false;
             this.telemetry.logSystem(`Watchdog detected provider ${id} went unhealthy.`, 'WARN');
          }
        }
      }
    }, 60000); // Check every 60 seconds
  }

  public getProviderStates(): Record<string, ProviderState> {
    const states: Record<string, ProviderState> = {};
    for (const [id, state] of this.providerStates.entries()) {
      states[id] = { ...state };
    }
    // Also include default healthy state for registered providers that haven't been used yet
    for (const id of this.providers.keys()) {
      if (!states[id]) {
        states[id] = {
          healthy: true,
          rateLimited: false,
          quotaExhausted: false,
          cooldownUntil: null,
          latency: 0,
          consecutive429Count: 0
        };
      }
    }
    return states;
  }

  private getState(providerId: string): ProviderState {
    if (!this.providerStates.has(providerId)) {
      this.providerStates.set(providerId, {
        healthy: true,
        rateLimited: false,
        quotaExhausted: false,
        cooldownUntil: null,
        latency: 0,
        consecutive429Count: 0,
        consecutiveFailures: 0,
        successCount: 0,
        errorCount: 0,
        circuitState: 'closed'
      });
    }
    return this.providerStates.get(providerId)!;
  }

  async registerProvider(provider: ILLMProvider) {
    this.providers.set(provider.id, provider);
    
    // Assign specific rate limits per provider
    let maxConcurrent = 2;
    let maxRpm = 10;

    switch (provider.id) {
      case 'ollama': maxConcurrent = 1; maxRpm = 1000; break;
      case 'openai': maxConcurrent = 5; maxRpm = 500; break;
      case 'anthropic': maxConcurrent = 5; maxRpm = 100; break;
      case 'gemini': maxConcurrent = 3; maxRpm = 15; break;
      case 'openrouter': maxConcurrent = 5; maxRpm = 200; break;
      case 'nvidia': maxConcurrent = 5; maxRpm = 100; break;
      case 'custom': maxConcurrent = 2; maxRpm = 50; break;
    }

    this.requestManagers.set(provider.id, new RequestManager(maxConcurrent, maxRpm));
    this.logger.info(`Registered LLM Provider: ${provider.name} (Max Concurrent: ${maxConcurrent}, Max RPM: ${maxRpm})`);
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
        const response = await operation();
        // Success -> reset circuit/failures
        const state = this.getState(providerId);
        state.consecutiveFailures = 0;
        state.consecutive429Count = 0;
        state.successCount++;
        if (state.circuitState === 'half-open') {
          state.circuitState = 'closed';
          state.healthy = true;
          this.logger.info(`Circuit breaker for ${providerId} fully closed after successful half-open test.`);
        }
        return response;
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
          this.telemetry.logCircuit(`Rate Limit hit on ${providerId} (429)`, { attempt, maxAttempts });
          throw error;
        }
        if (error.status === 402 || msg.includes('quota') || msg.includes('insufficient_quota') || msg.includes('balance') || msg.includes('exhausted')) {
          error.isQuota = true;
          this.telemetry.logCircuit(`Quota Exhausted hit on ${providerId}`, { attempt, maxAttempts });
          throw error;
        }

        this.logger.warn(`Provider ${providerId} failed (attempt ${attempt}/${maxAttempts}): ${error.message}. Retrying in ${delay}ms...`);
        this.telemetry.logSystem(`Retry ${attempt} for ${providerId} due to ${error.message}`, 'DEBUG', { delay });
        
        // Full Jitter Backoff: sleep = random_between(0, min(cap, base * 2^attempt))
        const jitteredDelay = Math.random() * delay;
        await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
        delay = Math.min(10000, delay * 2); // Cap backoff at 10s
      }
    }
    throw new Error('Unreachable code');
  }

  private isProviderCooling(providerId: string): boolean {
    const state = this.getState(providerId);
    if (state.circuitState === 'open') {
      if (state.cooldownUntil && Date.now() >= state.cooldownUntil) {
        // Cooldown expired, move to half-open
        state.cooldownUntil = null;
        state.circuitState = 'half-open';
        state.healthy = true; // allow one request through
        this.logger.info(`Provider ${providerId} circuit moved to half-open state.`);
        return false;
      }
      return true; // Still cooling down in open state
    }
    
    // Legacy cooldown logic for completeness
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) return true;
    if (state.cooldownUntil && Date.now() >= state.cooldownUntil) {
      state.cooldownUntil = null;
      state.rateLimited = false;
      state.quotaExhausted = false;
      state.healthy = true;
      state.consecutive429Count = 0;
      state.circuitState = 'closed';
    }
    return false;
  }

  private getNextAvailableProvider(request: LLMRequest, excludeProviders: string[] = []): { providerId: LLMProviderId, model: string } | null {
    let chain: Array<{ id: string, model: string }> = [];
    
    // Task-specific fallbacks
    if (request.taskType === 'coding') {
      chain = [
        { id: 'ollama', model: 'qwen2.5-coder:3b' },
        { id: 'anthropic', model: 'claude-3-5-sonnet-20240620' },
        { id: 'gemini', model: 'gemini-1.5-pro' }
      ];
    } else if (request.taskType === 'reasoning') {
      chain = [
        { id: 'gemini', model: 'gemini-1.5-pro' },
        { id: 'openai', model: 'o1-preview' },
        { id: 'anthropic', model: 'claude-3-5-sonnet-20240620' }
      ];
    } else if (request.taskType === 'chat') {
      chain = [
        { id: 'gemini', model: 'gemini-1.5-flash' },
        { id: 'ollama', model: 'llama3.2:latest' }
      ];
    } else {
      // Default generic chain
      chain = [
        { id: 'gemini', model: this.config.providers?.gemini?.model || 'gemini-2.5-pro' },
        { id: 'openai', model: this.config.providers?.openai?.model || 'gpt-4o' },
        { id: 'anthropic', model: this.config.providers?.anthropic?.model || 'claude-3-5-sonnet-20240620' },
        { id: 'openrouter', model: this.config.providers?.openrouter?.model || 'meta-llama/llama-3-8b-instruct:free' },
        { id: 'nvidia', model: this.config.providers?.nvidia?.model || 'meta/llama3-8b-instruct' },
        { id: 'ollama', model: this.config.defaultModel || 'llama3.2:latest' }
      ];
    }

    // Dynamic Provider Scoring: Latency + FailureRate (lower score is better)
    let bestStep: { id: string, model: string } | null = null;
    let bestScore = Infinity;

    for (const step of chain) {
      if (this.providers.has(step.id as LLMProviderId) && !this.isProviderCooling(step.id) && !excludeProviders.includes(step.id)) {
        const state = this.getState(step.id);
        
        // Compute Score
        const totalReqs = state.successCount + state.errorCount;
        const failureRate = totalReqs > 0 ? (state.errorCount / totalReqs) : 0;
        // Cost heuristic: openrouter=10, openai=20, anthropic=20, nvidia=10, ollama=0, gemini=5 (flash=2)
        let costScore = 10;
        if (step.id === 'ollama') costScore = 0;
        if (step.id === 'gemini') costScore = step.model.includes('flash') ? 2 : 5;
        if (step.id === 'openai') costScore = 20;
        if (step.id === 'anthropic') costScore = 20;
        
        // score = latency (ms) + failureRate * 5000 + costScore * 10
        const score = state.latency + (failureRate * 5000) + (costScore * 10);
        
        if (score < bestScore) {
          bestScore = score;
          bestStep = step;
        }
      }
    }
    
    if (bestStep) {
      return { providerId: bestStep.id as LLMProviderId, model: bestStep.model };
    }
    return null;
  }

  private checkAgentBudget(agentId?: string): void {
    if (!agentId || !this.config.agentBudgets) return;
    
    const budget = this.config.agentBudgets[agentId];
    if (budget) {
      const stats = this.tracker.getStats();
      const agentStats = stats.byAgent[agentId];
      if (agentStats && agentStats.totalTokens >= budget.maxTokens) {
        throw new Error(`Agent ${agentId} has exceeded its token budget of ${budget.maxTokens} tokens.`);
      }
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.checkAgentBudget(request.agentId);
    let { providerId, model: requestModel } = this.resolveTask(request);
    request.model = requestModel; // Update request with resolved model

    if (this.isProviderCooling(providerId)) {
      const fallback = this.getNextAvailableProvider(request, []);
      if (fallback) {
        providerId = fallback.providerId;
        request.model = fallback.model;
      }
    }

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`LLM Provider ${providerId} is not registered`);
    }

    const cached = this.cache.get(request);
    if (cached) {
      this.logger.info(`Cache hit for prompt: ${request.prompt.substring(0, 50)}...`);
      this.telemetry.logCache(`Cache hit for ${providerId}:${request.model}`, true, { promptLength: request.prompt.length });
      return cached;
    }
    
    this.telemetry.logCache(`Cache miss for ${providerId}:${request.model}`, false, { promptLength: request.prompt.length });

    try {
      const requestManager = this.requestManagers.get(providerId);
      if (!requestManager) throw new Error(`RequestManager not found for ${providerId}`);

      const response = await this.executeWithRetry(providerId, () => 
        requestManager.enqueue(() => provider.generate(request), request.priority)
      );
      this.tracker.trackUsage(
        providerId,
        request.model,
        response.usage.promptTokens,
        response.usage.completionTokens,
        request.agentId
      );
      this.telemetry.logRequest({
        provider: providerId,
        model: request.model,
        agent: request.agentId,
        tokens_in: response.usage.promptTokens,
        tokens_out: response.usage.completionTokens,
        latency: 0, // Need accurate latency calc
        status: 200,
        requestPayload: JSON.stringify({ prompt: request.prompt, systemPrompt: request.systemPrompt }),
        responsePayload: JSON.stringify({ content: response.content })
      });
      this.cache.set(request, response);
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.toLowerCase().includes('abort')) {
        this.logger.info(`Request to ${providerId} was aborted by user.`);
        throw error;
      }
      this.logger.error(`Provider ${providerId} failed: ${error.message}. Attempting failover chain...`);
      this.telemetry.logError(`Provider ${providerId} failed`, error.name || 'APIError', { message: error.message });
      return await this.handleFallback(request, [providerId], error);
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamResponse> {
    this.checkAgentBudget(request.agentId);
    let { providerId, model: requestModel } = this.resolveTask(request);
    request.model = requestModel;

    if (this.isProviderCooling(providerId)) {
      const fallback = this.getNextAvailableProvider(request, []);
      if (fallback) {
        providerId = fallback.providerId;
        request.model = fallback.model;
      }
    }

    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`LLM Provider ${providerId} is not registered`);
    }

    try {
      const requestManager = this.requestManagers.get(providerId);
      if (!requestManager) throw new Error(`RequestManager not found for ${providerId}`);

      // For streaming, we only queue the initial request to get the generator
      const generator = await requestManager.enqueue(() => provider.stream(request), request.priority);
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
        this.tracker.trackUsage(providerId, request.model, promptTokens, completionTokens, request.agentId);
      }
      this.telemetry.logRequest({
        provider: providerId,
        model: request.model,
        agent: request.agentId,
        tokens_in: promptTokens,
        tokens_out: completionTokens,
        latency: 0,
        status: 200,
        requestPayload: JSON.stringify({ prompt: request.prompt, systemPrompt: request.systemPrompt }),
        responsePayload: '[Streamed Response]' // Could buffer this if needed, but keeping it light for streams
      });
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.toLowerCase().includes('abort')) {
        this.logger.info(`Stream to ${providerId} was aborted by user.`);
        throw error;
      }
      this.logger.error(`Stream failed for ${providerId}: ${error.message}. Attempting failover chain...`);
      this.telemetry.logError(`Stream failed for ${providerId}`, error.name || 'APIError', { message: error.message });
      yield* this.handleFallbackStream(request, [providerId], error);
    }
  }

  private resolveTask(request: LLMRequest): { providerId: LLMProviderId, model: string } {
    if (request.taskType) {
      if (this.config.defaultProvider === 'ollama') {
        if (request.taskType === 'coding') {
          return { providerId: 'ollama', model: 'qwen2.5-coder:3b' };
        }
        return { providerId: 'ollama', model: 'llama3.2:latest' };
      } else {
        if (request.taskType === 'coding') {
          return { providerId: 'anthropic', model: 'claude-3-5-sonnet-20240620' };
        }
        if (request.taskType === 'reasoning') {
          return { providerId: 'openai', model: 'o1-preview' };
        }
        return { providerId: 'gemini', model: 'gemini-1.5-pro' };
      }
    }

    // Legacy fallback using hardcoded model strings
    const model = (request.model || '').toLowerCase();
    
    if (model.includes('gpt-') || model.includes('text-davinci')) {
      return { providerId: 'openai', model: request.model };
    }
    if (model.includes('claude-')) {
      return { providerId: 'anthropic', model: request.model };
    }
    if (model.includes('gemini-')) {
      return { providerId: 'gemini', model: request.model };
    }
    if (model.includes('meta-llama') || model.includes('mistralai/') || model.includes(':free')) {
      return { providerId: 'openrouter', model: request.model };
    }
    if (model.includes('meta/llama') || model.includes('nvidia/')) {
      return { providerId: 'nvidia', model: request.model };
    }
    
    return { providerId: this.config.defaultProvider || 'ollama', model: request.model };
  }

  private async handleFallback(request: LLMRequest, failedProviders: string[], error: any): Promise<LLMResponse> {
    const lastFailed = failedProviders[failedProviders.length - 1];
    const state = this.getState(lastFailed);
    
    state.errorCount++;
    state.consecutiveFailures++;

    if (state.circuitState === 'half-open') {
      // Failed during half-open, trip immediately back to open
      state.circuitState = 'open';
      state.healthy = false;
      state.cooldownUntil = Date.now() + this.RATE_LIMIT_COOLING_MS;
      this.logger.warn(`Circuit Breaker TRIPPED for ${lastFailed} (half-open test failed)`);
    } else if (state.consecutiveFailures >= this.CIRCUIT_BREAKER_TRIP_LIMIT) {
      state.circuitState = 'open';
      state.healthy = false;
      state.cooldownUntil = Date.now() + this.RATE_LIMIT_COOLING_MS;
      this.logger.warn(`Circuit Breaker TRIPPED for ${lastFailed} due to ${state.consecutiveFailures} consecutive failures`);
    }

    if (error.isRateLimit) {
      state.consecutive429Count++;
    }
    if (error.isQuota) {
      state.quotaExhausted = true;
      state.healthy = false;
      state.circuitState = 'open';
      state.cooldownUntil = Date.now() + this.QUOTA_COOLING_MS;
      this.telemetry.logCircuit(`Circuit Breaker TRIPPED for ${lastFailed}`, { reason: 'QuotaExhausted', cooldown: this.QUOTA_COOLING_MS });
    }

    const fallback = this.getNextAvailableProvider(request, failedProviders);
    if (!fallback) {
      throw new Error(`All LLM failover providers exhausted. Last error: ${error.message}`);
    }
    const { providerId, model } = fallback;
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      failedProviders.push(providerId);
      return this.handleFallback(request, failedProviders, new Error(`Fallback provider ${providerId} is not registered`));
    }
    
    this.logger.info(`Failing over from ${lastFailed} to ${providerId} (model: ${model})`);
    this.telemetry.logSystem(`Fallback: ${lastFailed} -> ${providerId}`, 'WARN');
    
    const fallbackRequest = { ...request, model };
    try {
      const requestManager = this.requestManagers.get(providerId);
      if (!requestManager) throw new Error(`RequestManager not found for ${providerId}`);

      const response = await this.executeWithRetry(providerId, () => 
        requestManager.enqueue(() => provider.generate(fallbackRequest), fallbackRequest.priority)
      );
      this.tracker.trackUsage(providerId, fallbackRequest.model, response.usage.promptTokens, response.usage.completionTokens);
      this.telemetry.logRequest({
        provider: providerId,
        model: fallbackRequest.model,
        agent: fallbackRequest.agentId,
        tokens_in: response.usage.promptTokens,
        tokens_out: response.usage.completionTokens,
        latency: 0,
        status: 200,
        requestPayload: JSON.stringify({ prompt: fallbackRequest.prompt, systemPrompt: fallbackRequest.systemPrompt }),
        responsePayload: JSON.stringify({ content: response.content })
      });
      return response;
    } catch (fallbackError: any) {
      if (fallbackError.name === 'AbortError' || fallbackError.message?.toLowerCase().includes('abort')) {
        this.logger.info(`Fallback request to ${providerId} was aborted by user.`);
        throw fallbackError;
      }
      failedProviders.push(providerId);
      return this.handleFallback(request, failedProviders, fallbackError);
    }
  }

  private async *handleFallbackStream(request: LLMRequest, failedProviders: string[], error: any): AsyncGenerator<LLMStreamResponse> {
    const lastFailed = failedProviders[failedProviders.length - 1];
    const state = this.getState(lastFailed);
    
    state.errorCount++;
    state.consecutiveFailures++;

    if (state.circuitState === 'half-open') {
      // Failed during half-open, trip immediately back to open
      state.circuitState = 'open';
      state.healthy = false;
      state.cooldownUntil = Date.now() + this.RATE_LIMIT_COOLING_MS;
      this.logger.warn(`Circuit Breaker TRIPPED for ${lastFailed} (half-open test failed)`);
    } else if (state.consecutiveFailures >= this.CIRCUIT_BREAKER_TRIP_LIMIT) {
      state.circuitState = 'open';
      state.healthy = false;
      state.cooldownUntil = Date.now() + this.RATE_LIMIT_COOLING_MS;
      this.logger.warn(`Circuit Breaker TRIPPED for ${lastFailed} due to ${state.consecutiveFailures} consecutive failures`);
    }

    if (error.isRateLimit) {
      state.consecutive429Count++;
    }
    if (error.isQuota) {
      state.quotaExhausted = true;
      state.healthy = false;
      state.circuitState = 'open';
      state.cooldownUntil = Date.now() + this.QUOTA_COOLING_MS;
    }

    const fallback = this.getNextAvailableProvider(request, failedProviders);
    if (!fallback) {
      throw new Error(`All LLM failover providers exhausted. Last error: ${error.message}`);
    }
    const { providerId, model } = fallback;
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      failedProviders.push(providerId);
      yield* this.handleFallbackStream(request, failedProviders, new Error(`Fallback provider ${providerId} is not registered`));
      return;
    }
    
    this.logger.info(`Failing over stream from ${lastFailed} to ${providerId} (model: ${model})`);

    const fallbackRequest = { ...request, model };
    try {
      const requestManager = this.requestManagers.get(providerId);
      if (!requestManager) throw new Error(`RequestManager not found for ${providerId}`);

      const generator = await requestManager.enqueue(() => provider.stream(fallbackRequest), fallbackRequest.priority);
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
    } catch (fallbackError: any) {
      if (fallbackError.name === 'AbortError' || fallbackError.message?.toLowerCase().includes('abort')) {
        this.logger.info(`Fallback stream to ${providerId} was aborted by user.`);
        throw fallbackError;
      }
      failedProviders.push(providerId);
      yield* this.handleFallbackStream(request, failedProviders, fallbackError);
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