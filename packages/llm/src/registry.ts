import * as fs from 'fs';
import * as path from 'path';
import { ModelCapability, TaskType, RoutingProfile, LLMProviderId, ModelCacheEntry } from '@aios/types';
import { CoreLogger } from '@aios/core';

export class ModelRegistry {
  private capabilities: Map<string, ModelCapability> = new Map();
  private logger: CoreLogger;
  private cachePath: string;
  private discoveryCachePath: string;
  private lastDiscovery: Map<string, number> = new Map();
  private readonly DISCOVERY_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  constructor(logger: CoreLogger) {
    this.logger = logger;
    
    // Determine user config directory for model cache
    const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    const aiosDir = path.join(appData, 'aios');
    this.cachePath = path.join(aiosDir, 'model-cache.json');
    this.discoveryCachePath = path.join(aiosDir, 'model-discovery-cache.json');
    
    this.loadDefaults();
    this.loadFromCache();
  }

  private loadDefaults() {
    const defaults: ModelCapability[] = [
      // OpenAI
      {
        providerId: 'openai',
        modelId: 'gpt-4o',
        coding: 9.5,
        reasoning: 9.5,
        speed: 7,
        cost: 6,
        vision: true,
        contextWindow: 128000,
        toolCalling: true,
        functionCalling: true,
        multimodal: true,
        streaming: true,
        maxTokens: 4096,
        isLocal: false,
        providerName: 'OpenAI'
      },
      {
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        coding: 8.5,
        reasoning: 8.5,
        speed: 8.5,
        cost: 8,
        vision: true,
        contextWindow: 128000,
        toolCalling: true,
        functionCalling: true,
        multimodal: true,
        streaming: true,
        maxTokens: 16384,
        isLocal: false,
        providerName: 'OpenAI'
      },
      {
        providerId: 'openai',
        modelId: 'o1-preview',
        coding: 9.0,
        reasoning: 10,
        speed: 3,
        cost: 2,
        vision: false,
        contextWindow: 128000,
        toolCalling: false,
        functionCalling: false,
        multimodal: false,
        streaming: false,
        maxTokens: 32768,
        isLocal: false,
        providerName: 'OpenAI'
      },
      {
        providerId: 'openai',
        modelId: 'o1-mini',
        coding: 9.5,
        reasoning: 9.5,
        speed: 5,
        cost: 4,
        vision: false,
        contextWindow: 128000,
        toolCalling: false,
        functionCalling: false,
        multimodal: false,
        streaming: false,
        maxTokens: 65536,
        isLocal: false,
        providerName: 'OpenAI'
      },

      // Anthropic
      {
        providerId: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
        coding: 9.8,
        reasoning: 9.5,
        speed: 8,
        cost: 6,
        vision: true,
        contextWindow: 200000,
        toolCalling: true,
        functionCalling: true,
        multimodal: true,
        streaming: true,
        maxTokens: 8192,
        isLocal: false,
        providerName: 'Anthropic'
      },
      {
        providerId: 'anthropic',
        modelId: 'claude-3-5-haiku-20241022',
        coding: 9.0,
        reasoning: 8.5,
        speed: 9,
        cost: 7,
        vision: true,
        contextWindow: 200000,
        toolCalling: true,
        functionCalling: true,
        multimodal: true,
        streaming: true,
        maxTokens: 8192,
        isLocal: false,
        providerName: 'Anthropic'
      },
      {
        providerId: 'anthropic',
        modelId: 'claude-3-opus-20240229',
        coding: 9.5,
        reasoning: 9.8,
        speed: 5,
        cost: 3,
        vision: true,
        contextWindow: 200000,
        toolCalling: true,
        functionCalling: true,
        multimodal: true,
        streaming: true,
        maxTokens: 4096,
        isLocal: false,
        providerName: 'Anthropic'
      },

      // Google Gemini
      {
        providerId: 'gemini',
        modelId: 'gemini-1.5-pro',
        coding: 9.2,
        reasoning: 9.2,
        speed: 7,
        cost: 6,
        vision: true,
        contextWindow: 2000000,
        toolCalling: true,
        functionCalling: true,
        multimodal: true,
        streaming: true,
        maxTokens: 8192,
        isLocal: false,
        providerName: 'Google'
      },
      {
        providerId: 'gemini',
        modelId: 'gemini-1.5-flash',
        coding: 8.0,
        reasoning: 8.0,
        speed: 9.5,
        cost: 9,
        vision: true,
        contextWindow: 1000000,
        toolCalling: true,
        functionCalling: true,
        multimodal: true,
        streaming: true,
        maxTokens: 8192,
        isLocal: false,
        providerName: 'Google'
      },
      {
        providerId: 'gemini',
        modelId: 'gemini-1.5-flash-8b',
        coding: 7.5,
        reasoning: 7.5,
        speed: 9.8,
        cost: 9.5,
        vision: true,
        contextWindow: 1000000,
        toolCalling: true,
        functionCalling: true,
        multimodal: true,
        streaming: true,
        maxTokens: 8192,
        isLocal: false,
        providerName: 'Google'
      },

      // NVIDIA
      {
        providerId: 'nvidia',
        modelId: 'nemotron-3-ultra',
        coding: 9.0,
        reasoning: 9.0,
        speed: 7,
        cost: 7,
        vision: false,
        contextWindow: 128000,
        toolCalling: true,
        functionCalling: true,
        multimodal: false,
        streaming: true,
        maxTokens: 4096,
        isLocal: false,
        providerName: 'NVIDIA'
      },

      // Ollama Local Models (will be auto-discovered)
      {
        providerId: 'ollama',
        modelId: 'qwen2.5-coder:3b',
        coding: 8.5,
        reasoning: 7.5,
        speed: 8.5,
        cost: 10,
        vision: false,
        contextWindow: 32768,
        toolCalling: true,
        functionCalling: true,
        multimodal: false,
        streaming: true,
        maxTokens: 4096,
        isLocal: true,
        providerName: 'Ollama'
      },
      {
        providerId: 'ollama',
        modelId: 'qwen2.5-coder:7b',
        coding: 9.0,
        reasoning: 8.5,
        speed: 7.5,
        cost: 10,
        vision: false,
        contextWindow: 32768,
        toolCalling: true,
        functionCalling: true,
        multimodal: false,
        streaming: true,
        maxTokens: 4096,
        isLocal: true,
        providerName: 'Ollama'
      },
      {
        providerId: 'ollama',
        modelId: 'llama3.2:latest',
        coding: 7.5,
        reasoning: 8.0,
        speed: 9.0,
        cost: 10,
        vision: false,
        contextWindow: 8192,
        toolCalling: true,
        functionCalling: true,
        multimodal: false,
        streaming: true,
        maxTokens: 4096,
        isLocal: true,
        providerName: 'Ollama'
      },
      {
        providerId: 'ollama',
        modelId: 'llama3.1:latest',
        coding: 8.0,
        reasoning: 8.5,
        speed: 8.5,
        cost: 10,
        vision: false,
        contextWindow: 131072,
        toolCalling: true,
        functionCalling: true,
        multimodal: false,
        streaming: true,
        maxTokens: 4096,
        isLocal: true,
        providerName: 'Ollama'
      },
      {
        providerId: 'ollama',
        modelId: 'mistral:latest',
        coding: 7.0,
        reasoning: 7.5,
        speed: 8.5,
        cost: 10,
        vision: false,
        contextWindow: 32768,
        toolCalling: true,
        functionCalling: true,
        multimodal: false,
        streaming: true,
        maxTokens: 4096,
        isLocal: true,
        providerName: 'Ollama'
      },
      {
        providerId: 'ollama',
        modelId: 'deepseek-coder:latest',
        coding: 9.0,
        reasoning: 8.0,
        speed: 8.0,
        cost: 10,
        vision: false,
        contextWindow: 16384,
        toolCalling: true,
        functionCalling: true,
        multimodal: false,
        streaming: true,
        maxTokens: 4096,
        isLocal: true,
        providerName: 'Ollama'
      },
      {
        providerId: 'ollama',
        modelId: 'gemma2:latest',
        coding: 7.5,
        reasoning: 8.0,
        speed: 9.0,
        cost: 10,
        vision: false,
        contextWindow: 8192,
        toolCalling: true,
        functionCalling: true,
        multimodal: false,
        streaming: true,
        maxTokens: 4096,
        isLocal: true,
        providerName: 'Ollama'
      }
    ];

    defaults.forEach(c => this.capabilities.set(`${c.providerId}:${c.modelId}`, c));
  }

  private loadFromCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        if (Array.isArray(data)) {
          data.forEach((c: ModelCapability) => {
            if (c.providerId && c.modelId) {
              this.capabilities.set(`${c.providerId}:${c.modelId}`, c);
            }
          });
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to load model cache: ${e.message}`);
    }
  }

  public saveCache() {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const data = Array.from(this.capabilities.values());
      fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2));
    } catch (e: any) {
      this.logger.error(`Failed to save model cache: ${e.message}`);
    }
  }

  /**
   * Register a model with auto-detected capabilities
   */
  public registerModel(providerId: string, modelId: string, source: 'api' | 'heuristic' | 'manual' = 'heuristic') {
    const key = `${providerId}:${modelId}`;
    if (this.capabilities.has(key)) return this.capabilities.get(key)!;

    // Heuristics for newly discovered models
    const capability = this.inferCapabilities(providerId, modelId, source);
    this.capabilities.set(key, capability);
    this.saveCache();
    return capability;
  }

  /**
   * Infer capabilities from model name
   */
  private inferCapabilities(providerId: string, modelId: string, source: 'api' | 'heuristic' | 'manual'): ModelCapability {
    const lower = modelId.toLowerCase();
    
    let coding = 6;
    let reasoning = 6;
    let speed = 7;
    let cost = 7;
    let vision = false;
    let toolCalling = true;
    let functionCalling = true;
    let multimodal = false;
    let contextWindow = 8192;
    let maxTokens = 4096;
    const isLocal = providerId === 'ollama';

    // Coding models
    if (lower.includes('coder') || lower.includes('code') || lower.includes('deepseek-coder')) {
      coding = 8.5;
      reasoning = 7.5;
    }

    // Vision models
    if (lower.includes('vision') || lower.includes('llava') || lower.includes('bakllava') || lower.includes('moondream')) {
      vision = true;
      multimodal = true;
    }

    // Size/speed indicators
    if (lower.includes('mini') || lower.includes('flash') || lower.includes('haiku') || lower.includes('8b') || lower.includes('3b') || lower.includes('1b') || lower.includes('0.5b')) {
      speed = 9;
      cost = isLocal ? 10 : 9;
      reasoning = Math.max(reasoning, 7);
      coding = Math.max(coding, 7);
    }
    if (lower.includes('pro') || lower.includes('opus') || lower.includes('o1') || lower.includes('70b') || lower.includes('r1') || lower.includes('405b')) {
      reasoning = 9;
      coding = Math.max(coding, 8.5);
      speed = 5;
      cost = isLocal ? 8 : 4;
    }
    if (lower.includes('large') || lower.includes('xl') || lower.includes('xxl')) {
      reasoning = 8.5;
      coding = 8;
      speed = 6;
      cost = isLocal ? 7 : 5;
    }

    // Specific model families
    if (lower.includes('llama3.1') || lower.includes('llama3.2') || lower.includes('llama-3')) {
      contextWindow = 131072;
    }
    if (lower.includes('mistral') || lower.includes('mixtral')) {
      contextWindow = 32768;
      reasoning = Math.max(reasoning, 7.5);
    }
    if (lower.includes('gemma')) {
      speed = 9;
      reasoning = 8;
    }
    if (lower.includes('phi')) {
      speed = 9.5;
      contextWindow = 16384;
    }

    // Cost for cloud providers
    if (!isLocal) {
      if (lower.includes('free') || lower.includes(':free')) {
        cost = 9;
      } else if (lower.includes('mini') || lower.includes('flash') || lower.includes('haiku')) {
        cost = 8;
      } else if (lower.includes('pro') || lower.includes('opus') || lower.includes('o1')) {
        cost = 3;
      } else {
        cost = 5;
      }
    }

    return {
      providerId,
      modelId,
      coding,
      reasoning,
      speed,
      cost,
      vision,
      contextWindow,
      toolCalling,
      functionCalling,
      multimodal,
      streaming: true,
      maxTokens,
      isLocal,
      providerName: this.getProviderDisplayName(providerId)
    };
  }

  private getProviderDisplayName(providerId: string): string {
    const names: Record<string, string> = {
      'ollama': 'Ollama',
      'openai': 'OpenAI',
      'anthropic': 'Anthropic',
      'gemini': 'Google',
      'nvidia': 'NVIDIA',
      'openrouter': 'OpenRouter',
      'custom': 'Custom'
    };
    return names[providerId] || providerId;
  }

  /**
   * Discover models from all providers
   */
  public async discoverModels(providers: Map<string, any>): Promise<ModelCapability[]> {
    const discovered: ModelCapability[] = [];
    const now = Date.now();

    for (const [providerId, provider] of providers) {
      // Check if we should rediscover
      const lastCheck = this.lastDiscovery.get(providerId) || 0;
      if (now - lastCheck < this.DISCOVERY_INTERVAL_MS) {
        continue;
      }

      try {
        if (typeof provider.getSupportedModels === 'function') {
          const models = await provider.getSupportedModels();
          
          for (const modelId of models) {
            const key = `${providerId}:${modelId}`;
            if (!this.capabilities.has(key)) {
              const capability = this.inferCapabilities(providerId, modelId, 'api');
              this.capabilities.set(key, capability);
              discovered.push(capability);
            }
          }
          
          this.lastDiscovery.set(providerId, now);
          this.logger.info(`Discovered ${models.length} models from ${providerId}`);
        }
      } catch (e: any) {
        this.logger.warn(`Failed to discover models from ${providerId}: ${e.message}`);
      }
    }

    if (discovered.length > 0) {
      this.saveCache();
      this.saveDiscoveryCache();
    }

    return discovered;
  }

  private saveDiscoveryCache() {
    try {
      const dir = path.dirname(this.discoveryCachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const data = {
        lastDiscovery: Object.fromEntries(this.lastDiscovery),
        timestamp: Date.now()
      };
      fs.writeFileSync(this.discoveryCachePath, JSON.stringify(data, null, 2));
    } catch (e: any) {
      this.logger.error(`Failed to save discovery cache: ${e.message}`);
    }
  }

  private loadDiscoveryCache() {
    try {
      if (fs.existsSync(this.discoveryCachePath)) {
        const data = JSON.parse(fs.readFileSync(this.discoveryCachePath, 'utf8'));
        if (data.lastDiscovery) {
          this.lastDiscovery = new Map(Object.entries(data.lastDiscovery));
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to load discovery cache: ${e.message}`);
    }
  }

  public getCapability(providerId: string, modelId: string): ModelCapability | undefined {
    return this.capabilities.get(`${providerId}:${modelId}`);
  }

  public getAllCapabilities(): ModelCapability[] {
    return Array.from(this.capabilities.values());
  }

  public getCapabilitiesByProvider(providerId: string): ModelCapability[] {
    return Array.from(this.capabilities.values()).filter(c => c.providerId === providerId);
  }

  public getLocalModels(): { general: ModelCapability[]; coding: ModelCapability[] } {
    const localModels = Array.from(this.capabilities.values()).filter(c => c.isLocal);
    
    const coding = localModels.filter(m => 
      m.coding >= 8 || m.modelId.toLowerCase().includes('coder') || m.modelId.toLowerCase().includes('code')
    ).sort((a, b) => b.coding - a.coding);

    const general = localModels.filter(m => 
      m.coding < 8 && !m.modelId.toLowerCase().includes('coder') && !m.modelId.toLowerCase().includes('code')
    ).sort((a, b) => b.reasoning - a.reasoning);

    return { general, coding };
  }

  public getModelsForTask(taskType: TaskType, minScore: number = 5): ModelCapability[] {
    return Array.from(this.capabilities.values())
      .filter(c => {
        switch (taskType) {
          case 'VISION': return c.vision || c.multimodal;
          case 'TOOL_USE': return c.toolCalling || c.functionCalling;
          case 'CODING': return c.coding >= minScore;
          case 'REASONING': return c.reasoning >= minScore;
          default: return true;
        }
      })
      .sort((a, b) => {
        // Sort by relevant capability
        switch (taskType) {
          case 'CODING': return b.coding - a.coding;
          case 'REASONING': return b.reasoning - a.reasoning;
          case 'VISION': return (b.vision ? 1 : 0) - (a.vision ? 1 : 0);
          default: return b.reasoning - a.reasoning;
        }
      });
  }
}