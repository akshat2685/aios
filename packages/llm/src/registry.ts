import * as fs from 'fs';
import * as path from 'path';
import { ModelCapability, TaskType, RoutingProfile, LLMProviderId } from '@aios/types';
import { CoreLogger } from '@aios/core';

export class ModelRegistry {
  private capabilities: Map<string, ModelCapability> = new Map();
  private logger: CoreLogger;
  private cachePath: string;

  constructor(logger: CoreLogger) {
    this.logger = logger;
    
    // Determine user config directory for model cache
    const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    this.cachePath = path.join(appData, 'aios', 'model-cache.json');
    
    this.loadDefaults();
    this.loadFromCache();
  }

  private loadDefaults() {
    const defaults: ModelCapability[] = [
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
        streaming: true,
        maxTokens: 4096
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
        streaming: false,
        maxTokens: 32768
      },
      {
        providerId: 'anthropic',
        modelId: 'claude-3-5-sonnet-20240620',
        coding: 9.8,
        reasoning: 9.5,
        speed: 8,
        cost: 6,
        vision: true,
        contextWindow: 200000,
        toolCalling: true,
        streaming: true,
        maxTokens: 8192
      },
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
        streaming: true,
        maxTokens: 8192
      },
      {
        providerId: 'gemini',
        modelId: 'gemini-1.5-flash',
        coding: 8.0,
        reasoning: 8.0,
        speed: 9.5,
        cost: 9, // low cost = high score
        vision: true,
        contextWindow: 1000000,
        toolCalling: true,
        streaming: true,
        maxTokens: 8192
      },
      {
        providerId: 'ollama',
        modelId: 'qwen2.5-coder:3b',
        coding: 8.5,
        reasoning: 7.5,
        speed: 8.5,
        cost: 10, // free
        vision: false,
        contextWindow: 32768,
        toolCalling: true,
        streaming: true,
        maxTokens: 4096
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
        streaming: true,
        maxTokens: 4096
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
            // Only load if valid format
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

  public registerModel(providerId: string, modelId: string) {
    const key = `${providerId}:${modelId}`;
    if (this.capabilities.has(key)) return;

    // Heuristics for newly discovered models
    let coding = 6;
    let reasoning = 6;
    let speed = 7;
    let cost = 7;
    let vision = false;

    const lower = modelId.toLowerCase();
    
    if (lower.includes('coder') || lower.includes('code')) coding = 8.5;
    if (lower.includes('vision')) vision = true;
    if (lower.includes('mini') || lower.includes('flash') || lower.includes('haiku') || lower.includes('8b') || lower.includes('3b')) {
      speed = 9;
      cost = 9;
    }
    if (lower.includes('pro') || lower.includes('opus') || lower.includes('o1') || lower.includes('70b') || lower.includes('r1')) {
      reasoning = 9;
      coding = Math.max(coding, 8.5);
      speed = 5;
      cost = 4;
    }

    this.capabilities.set(key, {
      providerId,
      modelId,
      coding,
      reasoning,
      speed,
      cost,
      vision,
      contextWindow: 8192,
      toolCalling: true,
      streaming: true,
      maxTokens: 4096
    });
  }

  public getCapability(providerId: string, modelId: string): ModelCapability | undefined {
    return this.capabilities.get(`${providerId}:${modelId}`);
  }

  public getAllCapabilities(): ModelCapability[] {
    return Array.from(this.capabilities.values());
  }
}
