import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LLMProviderId } from '@aios/types';

export interface UsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  provider: LLMProviderId;
  model: string;
  timestamp: number;
  agentId?: string;
}

export interface CumulativeStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  byProvider: Record<LLMProviderId, {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  }>;
  byAgent: Record<string, {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  }>;
}

const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 5.00 / 1_000_000, output: 15.00 / 1_000_000 },
  'gpt-4-turbo-preview': { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
  'gpt-3.5-turbo': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 },

  // Anthropic Claude
  'claude-3-5-sonnet': { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  'claude-3-opus-20240229': { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
  'claude-3-haiku': { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },

  // Gemini
  'gemini-1.5-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
  'gemini-1.5-pro': { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
};

export class LLMTracker {
  private filePath: string;
  private stats: CumulativeStats;

  constructor() {
    let userDataPath: string;
    try {
      const { app } = require('electron');
      userDataPath = app.getPath('userData');
    } catch {
      userDataPath = path.join(os.homedir(), '.aios');
    }

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.filePath = path.join(userDataPath, 'usage.json');
    this.stats = this.loadStats();
  }

  private loadStats(): CumulativeStats {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContents = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(fileContents) as CumulativeStats;
      }
    } catch {
      // ignore and use default
    }

    return this.createEmptyStats();
  }

  private createEmptyStats(): CumulativeStats {
    const stats: CumulativeStats = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {} as any,
      byAgent: {}
    };

    const providers: LLMProviderId[] = ['ollama', 'openai', 'anthropic', 'gemini', 'nvidia', 'openrouter', 'custom'];
    providers.forEach(p => {
      stats.byProvider[p] = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      };
    });

    return stats;
  }

  public trackUsage(
    provider: LLMProviderId,
    model: string,
    promptTokens: number,
    completionTokens: number,
    agentId?: string
  ): UsageRecord {
    const costConfig = PRICING[model] || { input: 0, output: 0 };
    const isLocal = provider === 'ollama';
    const estimatedCost = isLocal ? 0 : (promptTokens * costConfig.input) + (completionTokens * costConfig.output);

    const record: UsageRecord = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost,
      provider,
      model,
      timestamp: Date.now(),
      agentId,
    };

    this.stats.totalPromptTokens += promptTokens;
    this.stats.totalCompletionTokens += completionTokens;
    this.stats.totalTokens += record.totalTokens;
    this.stats.totalCost += estimatedCost;

    if (!this.stats.byProvider[provider]) {
      this.stats.byProvider[provider] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
    }
    
    const provStats = this.stats.byProvider[provider];
    provStats.promptTokens += promptTokens;
    provStats.completionTokens += completionTokens;
    provStats.totalTokens += record.totalTokens;
    provStats.cost += estimatedCost;

    if (agentId) {
      if (!this.stats.byAgent[agentId]) {
        this.stats.byAgent[agentId] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
      }
      const agentStats = this.stats.byAgent[agentId];
      agentStats.promptTokens += promptTokens;
      agentStats.completionTokens += completionTokens;
      agentStats.totalTokens += record.totalTokens;
      agentStats.cost += estimatedCost;
    }

    this.saveStats();
    this.appendToStructuredLog(record);
    return record;
  }

  private saveStats(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.stats, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  private appendToStructuredLog(record: UsageRecord): void {
    try {
      const logPath = path.join(path.dirname(this.filePath), 'usage_structured.log');
      fs.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf8');
    } catch {
      // ignore
    }
  }

  public getStats(): CumulativeStats {
    return { ...this.stats };
  }

  public clearStats(): void {
    this.stats = this.createEmptyStats();
    this.saveStats();
  }
}
