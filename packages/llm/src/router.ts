import { 
  LLMProviderId, 
  ILLMProvider, 
  LLMRequest, 
  LLMResponse, 
  LLMStreamResponse, 
  TaskType, 
  RoutingProfile, 
  ModelCapability, 
  ProviderHealthState, 
  RoutingDecision,
  ModelScore,
  UserPreferences,
  CloudMode,
  RoutingMode
} from '@aios/types';
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
import { ModelRegistry } from './registry';
import { TaskClassifier } from './classifier';
import { IntelligentScorer } from './scorer';

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
  lastRequestTime: number;
  totalRequests: number;
  totalErrors: number;
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
  public registry: ModelRegistry;

  private providerStates: Map<string, ProviderState> = new Map();
  private readonly CIRCUIT_BREAKER_TRIP_LIMIT = 3;
  private readonly RATE_LIMIT_COOLING_MS = 15 * 60 * 1000; // 15 minutes
  private readonly QUOTA_COOLING_MS = 5 * 60 * 60 * 1000; // 5 hours
  private readonly MIN_COOLDOWN_MS = 30 * 1000; // 30 seconds minimum

  // Diagnostics
  private routingHistory: RoutingDecision[] = [];
  private readonly MAX_HISTORY = 100;
  private lastDiagnostics: any = null;

  constructor(config: LLMConfig, security: SecretManager, logger: CoreLogger) {
    this.config = config;
    this.security = security;
    this.logger = logger;
    this.telemetry = TelemetryEngine.getInstance();
    this.tracker = new LLMTracker();
    this.cache = new LLMCache();
    this.registry = new ModelRegistry(logger);

    // Register all built providers
    this.registerProvider(new OllamaProvider({ baseUrl: config.providers.ollama?.baseUrl }, logger));
    this.registerProvider(new OpenAIProvider(security, logger));
    this.registerProvider(new AnthropicProvider(security, logger));
    this.registerProvider(new GeminiProvider(security, logger));
    this.registerProvider(new OpenRouterProvider(security, logger));
    this.registerProvider(new NvidiaProvider(security, logger));
    this.registerProvider(new CustomProvider(security, logger));

    this.startWatchdog();
    this.startModelDiscovery();
  }

  private startWatchdog() {
    setInterval(async () => {
      const healthStates = await this.checkAllHealth();
      for (const [id, health] of Object.entries(healthStates)) {
        const state = this.getState(id);
        if (health.status === 'healthy') {
          if (!state.healthy && (!state.cooldownUntil || Date.now() > state.cooldownUntil)) {
            state.healthy = true;
            state.rateLimited = false;
            state.quotaExhausted = false;
            state.consecutive429Count = 0;
            state.cooldownUntil = null;
            state.circuitState = 'closed';
            this.logger.info(`Watchdog: Provider ${id} recovered and marked healthy`);
          }
        } else {
          if (state.healthy && !state.rateLimited && !state.quotaExhausted) {
            state.healthy = false;
            this.logger.warn(`Watchdog: Provider ${id} went unhealthy`, { error: health.error });
          }
        }
      }
    }, 60000); // Check every 60 seconds
  }

  private startModelDiscovery() {
    // Run discovery every 6 hours
    setInterval(async () => {
      try {
        await this.registry.discoverModels(this.providers);
      } catch (e: any) {
        this.logger.warn(`Model discovery failed: ${e.message}`);
      }
    }, 6 * 60 * 60 * 1000);

    // Initial discovery
    setTimeout(() => this.registry.discoverModels(this.providers), 5000);
  }

  public getProviderStates(): Record<string, ProviderState> {
    const states: Record<string, ProviderState> = {};
    for (const [id, state] of this.providerStates.entries()) {
      states[id] = { ...state };
    }
    // Include default healthy state for registered providers
    for (const id of this.providers.keys()) {
      if (!states[id]) {
        states[id] = this.getDefaultState();
      }
    }
    return states;
  }

  private getDefaultState(): ProviderState {
    return {
      healthy: true,
      rateLimited: false,
      quotaExhausted: false,
      cooldownUntil: null,
      latency: 0,
      consecutive429Count: 0,
      consecutiveFailures: 0,
      successCount: 0,
      errorCount: 0,
      circuitState: 'closed',
      lastRequestTime: 0,
      totalRequests: 0,
      totalErrors: 0
    };
  }

  private getState(providerId: string): ProviderState {
    if (!this.providerStates.has(providerId)) {
      this.providerStates.set(providerId, this.getDefaultState());
    }
    return this.providerStates.get(providerId)!;
  }

  async registerProvider(provider: ILLMProvider) {
    this.providers.set(provider.id, provider);
    
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
        state.totalRequests++;
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
        
        // Full Jitter Backoff
        const jitteredDelay = Math.random() * delay;
        await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
        delay = Math.min(10000, delay * 2);
      }
    }
    throw new Error('Unreachable code');
  }

  private isProviderAvailable(providerId: string): boolean {
    const state = this.getState(providerId);
    
    // Check circuit breaker
    if (state.circuitState === 'open') {
      if (state.cooldownUntil && Date.now() >= state.cooldownUntil) {
        // Cooldown expired, move to half-open
        state.cooldownUntil = null;
        state.circuitState = 'half-open';
        state.healthy = true;
        this.logger.info(`Provider ${providerId} circuit moved to half-open state.`);
        return true;
      }
      return false;
    }
    
    // Check legacy cooldown
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) return false;
    if (state.cooldownUntil && Date.now() >= state.cooldownUntil) {
      state.cooldownUntil = null;
      state.rateLimited = false;
      state.quotaExhausted = false;
      state.healthy = true;
      state.consecutive429Count = 0;
      state.circuitState = 'closed';
    }
    
    return state.healthy && !state.rateLimited && !state.quotaExhausted;
  }

  /**
   * Core routing logic with full explainability
   */
  private selectBestModel(request: LLMRequest, excludeProviders: string[] = []): { 
    providerId: LLMProviderId; 
    model: string; 
    decision: RoutingDecision 
  } | null {
    // 1. Classify Task
    let taskType: TaskType = request.taskType as TaskType;
    let classificationConfidence = 1.0;
    
    if (!taskType) {
      const classification = TaskClassifier.classify(request.prompt);
      taskType = classification.type;
      classificationConfidence = classification.confidence;
    }

    const taskComplexity = TaskClassifier.analyzeComplexity(request.prompt);

    const profile: RoutingProfile = this.config.routingProfile || 'BALANCED';
    const cloudMode: CloudMode = this.config.cloudMode || 'local';
    const routingMode: RoutingMode = this.config.routingMode || 'automatic';
    const userPrefs: UserPreferences = this.config.userPreferences || { preferLocal: false, preferOpenSource: false, preferCheapest: false };

    // 2. Handle Advanced Mode - Force specific provider/model
    if (routingMode === 'advanced' && request.forceProvider) {
      const provider = this.providers.get(request.forceProvider);
      if (provider && this.isProviderAvailable(request.forceProvider)) {
        const model = request.forceModel || this.config.defaultModel;
        const cap = this.registry.getCapability(request.forceProvider, model);
        
        return {
          providerId: request.forceProvider,
          model,
          decision: {
            selectedProvider: request.forceProvider,
            selectedModel: model,
            taskType,
            confidence: 1.0,
            profile,
            scores: [],
            reason: 'Advanced mode: User forced provider/model'
          }
        };
      }
    }

    // 3. Get all capabilities
    const allModels = this.registry.getAllCapabilities();
    let bestScore = -Infinity;
    let bestModel: { providerId: LLMProviderId, model: string, capability: ModelCapability } | null = null;
    const allScores: ModelScore[] = [];

    // Build health map
    const healthMap = new Map<string, ProviderHealthState>();
    for (const [providerId, state] of this.providerStates.entries()) {
      healthMap.set(providerId, {
        healthy: state.healthy,
        avgLatency: state.latency,
        successRate: state.totalRequests > 0 ? state.successCount / state.totalRequests : 1,
        consecutiveFailures: state.consecutiveFailures,
        cooldownUntil: state.cooldownUntil,
        lastFailure: state.lastRequestTime,
        totalRequests: state.totalRequests,
        totalErrors: state.totalErrors
      });
    }

    const isLocalMode = cloudMode === 'local';

    for (const cap of allModels) {
      if (!this.providers.has(cap.providerId as LLMProviderId)) continue;
      if (excludeProviders.includes(cap.providerId)) continue;
      if (!this.isProviderAvailable(cap.providerId)) continue;

      // Cloud mode filtering
      if (cloudMode === 'local' && !cap.isLocal) continue;
      if (cloudMode === 'online' && cap.isLocal) continue;

      // User preference filtering
      if (userPrefs.disabledProviders?.includes(cap.providerId as LLMProviderId)) continue;
      if (userPrefs.disabledModels?.includes(cap.modelId)) continue;

      // Score the model
      const health = healthMap.get(cap.providerId) || {
        healthy: true,
        avgLatency: 0,
        successRate: 1,
        consecutiveFailures: 0,
        cooldownUntil: null,
        lastFailure: null,
        totalRequests: 0,
        totalErrors: 0
      };

      let { score, penalties } = IntelligentScorer.score(cap, taskType, profile, health, userPrefs);

      // Implement task complexity routing
      if (taskComplexity === 'simple') {
        if (cap.isLocal || ['qwen', 'llama3', 'mistral'].some(m => cap.modelId.toLowerCase().includes(m))) {
          score *= 1.5;
        } else {
          score *= 0.8;
          penalties.push('Overpowered for simple task');
        }
      } else if (taskComplexity === 'complex') {
        if (!cap.isLocal || ['claude', 'gpt', 'gemini-1.5-pro'].some(m => cap.modelId.toLowerCase().includes(m))) {
          score *= 1.5;
        } else {
          score *= 0.5;
          penalties.push('Underpowered for complex task');
        }
      } else if (taskComplexity === 'security') {
        if (cap.isLocal || cap.modelId.toLowerCase().includes('security') || cap.modelId.toLowerCase().includes('guard')) {
          score *= 2.0;
        } else {
          score *= 0.2;
          penalties.push('Security risk with non-specialized cloud model');
        }
      }

      allScores.push({
        providerId: cap.providerId,
        modelId: cap.modelId,
        score,
        capabilities: cap,
        health,
        penalties
      });

      if (score > bestScore) {
        bestScore = score;
        bestModel = { providerId: cap.providerId as LLMProviderId, model: cap.modelId, capability: cap };
      }
    }

    // Sort scores for explainability
    allScores.sort((a, b) => b.score - a.score);

    if (bestModel) {
      const topScore = allScores[0];
      const reason = this.generateReason(bestModel.capability, taskType, profile, topScore, classificationConfidence);
      
      const decision: RoutingDecision = {
        selectedProvider: bestModel.providerId,
        selectedModel: bestModel.model,
        taskType,
        confidence: classificationConfidence,
        profile,
        scores: allScores.slice(0, 5), // Top 5 for diagnostics
        reason,
        fallbackReason: excludeProviders.length > 0 ? `Fallback from: ${excludeProviders.join(', ')}` : undefined
      };

      this.logger.info(`Routing: ${bestModel.model} from ${bestModel.providerId} (score: ${bestScore.toFixed(2)}) for ${taskType} [${profile}]`);
      
      return { providerId: bestModel.providerId, model: bestModel.model, decision };
    } else {
      this.logger.warn(`No eligible models found for task ${taskType} with exclusions: ${excludeProviders.join(', ')}`);
      return null;
    }
  }

  private generateReason(
    capability: ModelCapability, 
    taskType: TaskType, 
    profile: RoutingProfile,
    topScore: ModelScore,
    classificationConfidence: number
  ): string {
    const reasons: string[] = [];
    
    // Task-specific reason
    switch (taskType) {
      case 'CODING':
        reasons.push(`Coding Score: ${capability.coding}/10`);
        break;
      case 'REASONING':
      case 'PLANNING':
        reasons.push(`Reasoning Score: ${capability.reasoning}/10`);
        break;
      case 'VISION':
        reasons.push(capability.vision ? 'Vision capable ✓' : '⚠ No vision capability');
        break;
      case 'TOOL_USE':
        reasons.push(capability.toolCalling ? 'Tool calling ✓' : '⚠ No tool calling');
        break;
    }

    // Profile reason
    switch (profile) {
      case 'FASTEST':
        reasons.push(`Speed: ${capability.speed}/10 (Fastest profile)`);
        break;
      case 'CHEAPEST':
        reasons.push(`Cost: ${capability.cost}/10 (Cheapest profile)`);
        break;
      case 'HIGHEST_QUALITY':
        reasons.push(`Quality optimized (Reasoning: ${capability.reasoning}, Coding: ${capability.coding})`);
        break;
    }

    // Context window
    if (capability.contextWindow >= 100000) {
      reasons.push(`Context: ${(capability.contextWindow/1000).toFixed(0)}K tokens`);
    }

    // Provider health
    const health = this.getState(capability.providerId);
    if (health.healthy) {
      reasons.push('Provider Healthy ✓');
    }

    // Confidence
    if (classificationConfidence < 0.6) {
      reasons.push(`⚠ Low classification confidence (${(classificationConfidence*100).toFixed(0)}%)`);
    }

    return reasons.join(' | ');
  }

  private resolveTask(request: LLMRequest): { providerId: LLMProviderId; model: string; decision: RoutingDecision } {
    const best = this.selectBestModel(request);
    if (best) return best;
    
    // Fallback to defaults
    const defaultProvider = this.config.defaultProvider || 'ollama';
    const defaultModel = request.model || this.config.defaultModel || 'llama3.2:latest';
    
    return {
      providerId: defaultProvider,
      model: defaultModel,
      decision: {
        selectedProvider: defaultProvider,
        selectedModel: defaultModel,
        taskType: request.taskType || 'GENERAL_CHAT',
        confidence: 0.3,
        profile: this.config.routingProfile || 'BALANCED',
        scores: [],
        reason: 'Fallback to default (no eligible models found)'
      }
    };
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.checkAgentBudget(request.agentId);
    
    const { providerId, model, decision } = this.resolveTask(request);
    request.model = model;

    if (!this.isProviderAvailable(providerId)) {
      const fallback = this.selectBestModel(request, [providerId]);
      if (fallback) {
        request.model = fallback.model;
        decision.fallbackReason = `Initial provider cooling down, failed over to ${fallback.providerId}`;
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
      return { ...cached, routingDecision: decision };
    }
    
    this.telemetry.logCache(`Cache miss for ${providerId}:${request.model}`, false, { promptLength: request.prompt.length });

    try {
      const requestManager = this.requestManagers.get(providerId);
      if (!requestManager) throw new Error(`RequestManager not found for ${providerId}`);

      const startTime = Date.now();
      const response = await this.executeWithRetry(providerId, () => 
        requestManager.enqueue(() => provider.generate(request), request.priority)
      );
      const latency = Date.now() - startTime;

      // Update health metrics
      this.updateHealthOnSuccess(providerId, latency);

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
        latency,
        status: 200,
        requestPayload: JSON.stringify({ prompt: request.prompt, systemPrompt: request.systemPrompt }),
        responsePayload: JSON.stringify({ content: response.content })
      });
      
      this.cache.set(request, response);
      
      // Record routing decision
      this.recordRoutingDecision({ ...decision, selectedProvider: providerId, selectedModel: model });
      
      return { ...response, routingDecision: decision };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.toLowerCase().includes('abort')) {
        this.logger.info(`Request to ${providerId} was aborted by user.`);
        throw error;
      }
      this.logger.error(`Provider ${providerId} failed: ${error.message}. Attempting failover...`);
      this.telemetry.logError(`Provider ${providerId} failed`, error.name || 'APIError', { message: error.message });
      
      return await this.handleFallback(request, [providerId], error, decision);
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamResponse> {
    this.checkAgentBudget(request.agentId);
    
    const { providerId, model, decision } = this.resolveTask(request);
    request.model = model;

    if (!this.isProviderAvailable(providerId)) {
      const fallback = this.selectBestModel(request, [providerId]);
      if (fallback) {
        request.model = fallback.model;
        decision.fallbackReason = `Initial provider cooling down, failed over to ${fallback.providerId}`;
      }
    }

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`LLM Provider ${providerId} is not registered`);
    }

    try {
      const requestManager = this.requestManagers.get(providerId);
      if (!requestManager) throw new Error(`RequestManager not found for ${providerId}`);

      const startTime = Date.now();
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

      const latency = Date.now() - startTime;
      this.updateHealthOnSuccess(providerId, latency);

      if (promptTokens > 0 || completionTokens > 0) {
        this.tracker.trackUsage(providerId, request.model, promptTokens, completionTokens, request.agentId);
      }
      this.recordRoutingDecision({ ...decision, selectedProvider: providerId, selectedModel: model });
      
      // Yield final decision info
      yield { chunk: '', done: true, usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens } };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.toLowerCase().includes('abort')) {
        this.logger.info(`Stream to ${providerId} was aborted by user.`);
        throw error;
      }
      this.logger.error(`Stream failed for ${providerId}: ${error.message}. Attempting failover...`);
      this.telemetry.logError(`Stream failed for ${providerId}`, error.name || 'APIError', { message: error.message });
      
      yield* this.handleFallbackStream(request, [providerId], error, decision);
    }
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

  private updateHealthOnSuccess(providerId: string, latency: number) {
    const state = this.getState(providerId);
    state.latency = Math.round((state.latency * 0.9) + (latency * 0.1)); // EMA
    state.lastRequestTime = Date.now();
  }

  private updateHealthOnFailure(providerId: string, error: any) {
    const state = this.getState(providerId);
    state.errorCount++;
    state.totalErrors++;
    state.consecutiveFailures++;
    state.lastRequestTime = Date.now();

    // Check for specific error types
    const msg = error.message?.toLowerCase() || '';
    
    if (error.isRateLimit || error.status === 429 || msg.includes('rate limit')) {
      state.rateLimited = true;
      state.consecutive429Count++;
      
      // Exponential cooldown: min(failures * 30s, 5min)
      const cooldown = Math.min(state.consecutive429Count * 30 * 1000, 5 * 60 * 1000);
      state.cooldownUntil = Date.now() + Math.max(cooldown, this.MIN_COOLDOWN_MS);
      
      if (state.consecutive429Count >= this.CIRCUIT_BREAKER_TRIP_LIMIT) {
        state.circuitState = 'open';
        state.healthy = false;
        state.cooldownUntil = Date.now() + this.RATE_LIMIT_COOLING_MS;
        this.logger.warn(`Circuit Breaker TRIPPED for ${providerId} due to rate limits`);
      }
    } else if (error.isQuota || error.status === 402 || msg.includes('quota') || msg.includes('insufficient_quota')) {
      state.quotaExhausted = true;
      state.healthy = false;
      state.circuitState = 'open';
      state.cooldownUntil = Date.now() + this.QUOTA_COOLING_MS;
      this.telemetry.logCircuit(`Circuit Breaker TRIPPED for ${providerId}`, { reason: 'QuotaExhausted' });
    } else {
      // Generic failure
      if (state.consecutiveFailures >= this.CIRCUIT_BREAKER_TRIP_LIMIT) {
        state.circuitState = 'open';
        state.healthy = false;
        state.cooldownUntil = Date.now() + this.RATE_LIMIT_COOLING_MS;
        this.logger.warn(`Circuit Breaker TRIPPED for ${providerId} due to ${state.consecutiveFailures} consecutive failures`);
      }
    }

    // Half-open failure
    if (state.circuitState === 'half-open') {
      state.circuitState = 'open';
      state.healthy = false;
      state.cooldownUntil = Date.now() + this.RATE_LIMIT_COOLING_MS;
      this.logger.warn(`Circuit Breaker TRIPPED for ${providerId} (half-open test failed)`);
    }
  }

  private async handleFallback(
    request: LLMRequest, 
    failedProviders: string[], 
    error: any,
    originalDecision: RoutingDecision
  ): Promise<LLMResponse> {
    const lastFailed = failedProviders[failedProviders.length - 1];
    this.updateHealthOnFailure(lastFailed, error);

    const fallback = this.selectBestModel(request, failedProviders);
    if (!fallback) {
      throw new Error(`All LLM failover providers exhausted. Last error: ${error.message}`);
    }

    const { providerId, model, decision } = fallback;
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      failedProviders.push(providerId);
      return this.handleFallback(request, failedProviders, new Error(`Fallback provider ${providerId} not registered`), originalDecision);
    }
    
    this.logger.info(`Failing over from ${lastFailed} to ${providerId} (model: ${model})`);
    this.telemetry.logSystem(`Fallback: ${lastFailed} -> ${providerId}`, 'WARN');
    
    const fallbackRequest = { ...request, model };
    try {
      const requestManager = this.requestManagers.get(providerId);
      if (!requestManager) throw new Error(`RequestManager not found for ${providerId}`);

      const startTime = Date.now();
      const response = await this.executeWithRetry(providerId, () => 
        requestManager.enqueue(() => provider.generate(fallbackRequest), fallbackRequest.priority)
      );
      const latency = Date.now() - startTime;
      this.updateHealthOnSuccess(providerId, latency);

      this.tracker.trackUsage(providerId, fallbackRequest.model, response.usage.promptTokens, response.usage.completionTokens, fallbackRequest.agentId);
      this.telemetry.logRequest({
        provider: providerId,
        model: fallbackRequest.model,
        agent: fallbackRequest.agentId,
        tokens_in: response.usage.promptTokens,
        tokens_out: response.usage.completionTokens,
        latency,
        status: 200,
        requestPayload: JSON.stringify({ prompt: fallbackRequest.prompt, systemPrompt: fallbackRequest.systemPrompt }),
        responsePayload: JSON.stringify({ content: response.content })
      });
      
      // Merge decisions for explainability
      const mergedDecision: RoutingDecision = {
        ...decision,
        fallbackReason: `Failed over from ${lastFailed}: ${error.message}`
      };
      this.recordRoutingDecision(mergedDecision);
      
      return { ...response, routingDecision: mergedDecision };
    } catch (fallbackError: any) {
      if (fallbackError.name === 'AbortError' || fallbackError.message?.toLowerCase().includes('abort')) {
        this.logger.info(`Fallback request to ${providerId} was aborted by user.`);
        throw fallbackError;
      }
      failedProviders.push(providerId);
      return this.handleFallback(request, failedProviders, fallbackError, originalDecision);
    }
  }

  private async *handleFallbackStream(
    request: LLMRequest, 
    failedProviders: string[], 
    error: any,
    originalDecision: RoutingDecision
  ): AsyncGenerator<LLMStreamResponse> {
    const lastFailed = failedProviders[failedProviders.length - 1];
    this.updateHealthOnFailure(lastFailed, error);

    const fallback = this.selectBestModel(request, failedProviders);
    if (!fallback) {
      throw new Error(`All LLM failover providers exhausted. Last error: ${error.message}`);
    }

    const { providerId, model, decision } = fallback;
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      failedProviders.push(providerId);
      yield* this.handleFallbackStream(request, failedProviders, new Error(`Fallback provider ${providerId} not registered`), originalDecision);
      return;
    }
    
    this.logger.info(`Failing over stream from ${lastFailed} to ${providerId} (model: ${model})`);

    const fallbackRequest = { ...request, model };
    try {
      const requestManager = this.requestManagers.get(providerId);
      if (!requestManager) throw new Error(`RequestManager not found for ${providerId}`);

      const startTime = Date.now();
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

      const latency = Date.now() - startTime;
      this.updateHealthOnSuccess(providerId, latency);

      if (promptTokens > 0 || completionTokens > 0) {
        this.tracker.trackUsage(providerId, fallbackRequest.model, promptTokens, completionTokens, fallbackRequest.agentId);
      }
      
      const mergedDecision: RoutingDecision = {
        ...decision,
        fallbackReason: `Failed over from ${lastFailed}: ${error.message}`
      };
      this.recordRoutingDecision(mergedDecision);
      
    } catch (fallbackError: any) {
      if (fallbackError.name === 'AbortError' || fallbackError.message?.toLowerCase().includes('abort')) {
        this.logger.info(`Fallback stream to ${providerId} was aborted by user.`);
        throw fallbackError;
      }
      failedProviders.push(providerId);
      yield* this.handleFallbackStream(request, failedProviders, fallbackError, originalDecision);
    }
  }

  private recordRoutingDecision(decision: RoutingDecision) {
    this.routingHistory.unshift(decision);
    if (this.routingHistory.length > this.MAX_HISTORY) {
      this.routingHistory.pop();
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

  // ============ Diagnostics API ============

  public getDiagnostics() {
    const states = this.getProviderStates();
    const healthMap: Record<string, ProviderHealthState> = {};
    
    for (const [id, state] of Object.entries(states)) {
      healthMap[id] = {
        healthy: state.healthy,
        avgLatency: state.latency,
        successRate: state.totalRequests > 0 ? state.successCount / state.totalRequests : 1,
        consecutiveFailures: state.consecutiveFailures,
        cooldownUntil: state.cooldownUntil,
        lastFailure: state.lastRequestTime,
        totalRequests: state.totalRequests,
        totalErrors: state.totalErrors
      };
    }

    const availableModels = this.registry.getAllCapabilities().map(c => ({
      provider: c.providerId,
      model: c.modelId,
      isLocal: c.isLocal,
      capabilities: {
        coding: c.coding,
        reasoning: c.reasoning,
        speed: c.speed,
        cost: c.cost,
        vision: c.vision,
        contextWindow: c.contextWindow,
        toolCalling: c.toolCalling
      },
      health: healthMap[c.providerId] || { healthy: true, avgLatency: 0, successRate: 1 }
    }));

    return {
      providerHealth: healthMap,
      availableModels,
      routingHistory: this.routingHistory.slice(0, 20),
      cooldowns: this.getActiveCooldowns(),
      config: {
        cloudMode: this.config.cloudMode,
        routingProfile: this.config.routingProfile,
        routingMode: this.config.routingMode,
        defaultProvider: this.config.defaultProvider
      },
      localModels: this.registry.getLocalModels()
    };
  }

  private getActiveCooldowns() {
    const cooldowns: Record<string, { until: number; reason: string }> = {};
    const now = Date.now();
    
    for (const [id, state] of this.providerStates.entries()) {
      if (state.cooldownUntil && state.cooldownUntil > now) {
        let reason = 'Circuit breaker';
        if (state.rateLimited) reason = 'Rate limited';
        else if (state.quotaExhausted) reason = 'Quota exhausted';
        else if (state.consecutiveFailures > 0) reason = `${state.consecutiveFailures} consecutive failures`;
        
        cooldowns[id] = {
          until: state.cooldownUntil,
          reason
        };
      }
    }
    return cooldowns;
  }

  // Manual overrides for development/testing
  public forceProvider(providerId: LLMProviderId, model?: string) {
    this.config.routingMode = 'advanced';
    // This would be used via request.forceProvider
  }

  public disableProvider(providerId: LLMProviderId) {
    if (!this.config.userPreferences) this.config.userPreferences = { preferLocal: false, preferOpenSource: false, preferCheapest: false };
    if (!this.config.userPreferences.disabledProviders) this.config.userPreferences.disabledProviders = [];
    if (!this.config.userPreferences.disabledProviders.includes(providerId)) {
      this.config.userPreferences.disabledProviders.push(providerId);
    }
  }

  public enableProvider(providerId: LLMProviderId) {
    if (this.config.userPreferences?.disabledProviders) {
      this.config.userPreferences.disabledProviders = this.config.userPreferences.disabledProviders.filter(p => p !== providerId);
    }
  }

  public disableModel(modelId: string) {
    if (!this.config.userPreferences) this.config.userPreferences = { preferLocal: false, preferOpenSource: false, preferCheapest: false };
    if (!this.config.userPreferences.disabledModels) this.config.userPreferences.disabledModels = [];
    if (!this.config.userPreferences.disabledModels.includes(modelId)) {
      this.config.userPreferences.disabledModels.push(modelId);
    }
  }

  public setRoutingProfile(profile: RoutingProfile) {
    this.config.routingProfile = profile;
  }

  public setCloudMode(mode: CloudMode) {
    this.config.cloudMode = mode;
  }

  public setRoutingMode(mode: RoutingMode) {
    this.config.routingMode = mode;
  }

  public setUserPreferences(prefs: Partial<UserPreferences>) {
    this.config.userPreferences = { preferLocal: false, preferOpenSource: false, preferCheapest: false, ...(this.config.userPreferences || {}), ...prefs } as UserPreferences;
  }
}