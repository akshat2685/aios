import { TaskType, ModelCapability, RoutingProfile, ProviderHealthState } from '@aios/types';

interface RoutingWeights {
  coding: number;
  reasoning: number;
  speed: number;
  cost: number;
  contextWindow: number;
  toolCalling: number;
  vision: number;
}

// Default profiles
const PROFILE_WEIGHTS: Record<RoutingProfile, RoutingWeights> = {
  BALANCED: {
    coding: 1.0,
    reasoning: 1.0,
    speed: 1.0,
    cost: 1.0,
    contextWindow: 0.5,
    toolCalling: 0.5,
    vision: 0.5
  },
  FASTEST: {
    coding: 0.5,
    reasoning: 0.5,
    speed: 3.0,
    cost: 1.5,
    contextWindow: 0.3,
    toolCalling: 0.3,
    vision: 0.3
  },
  CHEAPEST: {
    coding: 0.3,
    reasoning: 0.3,
    speed: 1.0,
    cost: 4.0,
    contextWindow: 0.3,
    toolCalling: 0.3,
    vision: 0.3
  },
  HIGHEST_QUALITY: {
    coding: 3.0,
    reasoning: 3.0,
    speed: 0.5,
    cost: 0.1,
    contextWindow: 1.5,
    toolCalling: 1.5,
    vision: 1.5
  }
};

// Task-specific base weights
const TASK_WEIGHTS: Record<TaskType, Partial<RoutingWeights>> = {
  CODING: { coding: 2.0, reasoning: 1.0, speed: 0.8, cost: 0.8 },
  REASONING: { reasoning: 2.5, coding: 0.5, speed: 0.5, cost: 0.5 },
  PLANNING: { reasoning: 2.0, coding: 0.5, speed: 0.5, cost: 0.8 },
  RESEARCH: { reasoning: 2.0, speed: 0.8, cost: 0.8, contextWindow: 1.5 },
  GENERAL_CHAT: { speed: 1.2, cost: 1.2, reasoning: 0.8 },
  SUMMARIZATION: { speed: 1.5, cost: 1.2, contextWindow: 1.0 },
  TRANSLATION: { speed: 1.2, cost: 1.0, reasoning: 0.8 },
  VISION: { vision: 3.0, reasoning: 1.5, speed: 0.8 },
  RAG: { reasoning: 1.5, contextWindow: 2.0, speed: 0.8, toolCalling: 1.0 },
  TOOL_USE: { toolCalling: 2.5, reasoning: 1.0, speed: 1.0 }
};

export class IntelligentScorer {
  /**
   * Score a model capability for a given task and routing profile
   * Returns score 0-100
   */
  public static score(
    capability: ModelCapability,
    taskType: TaskType,
    profile: RoutingProfile,
    health: ProviderHealthState,
    userPreferences?: { preferLocal?: boolean; preferOpenSource?: boolean; preferCheapest?: boolean }
  ): { score: number; penalties: string[] } {
    const penalties: string[] = [];
    let score = 0;

    // Get weights
    const profileWeights = PROFILE_WEIGHTS[profile] || PROFILE_WEIGHTS.BALANCED;
    const taskWeights = TASK_WEIGHTS[taskType] || {};
    
    // Merge weights
    const weights: RoutingWeights = {
      coding: profileWeights.coding * (taskWeights.coding || 1),
      reasoning: profileWeights.reasoning * (taskWeights.reasoning || 1),
      speed: profileWeights.speed * (taskWeights.speed || 1),
      cost: profileWeights.cost * (taskWeights.cost || 1),
      contextWindow: profileWeights.contextWindow * (taskWeights.contextWindow || 1),
      toolCalling: profileWeights.toolCalling * (taskWeights.toolCalling || 1),
      vision: profileWeights.vision * (taskWeights.vision || 1)
    };

    // Normalize capability scores to 0-10 range (they already are)
    const cap = {
      coding: capability.coding / 10,
      reasoning: capability.reasoning / 10,
      speed: capability.speed / 10,
      cost: capability.cost / 10, // 10 = free/cheap
      contextWindow: Math.min(capability.contextWindow / 1_000_000, 10) / 10,
      toolCalling: capability.toolCalling ? 1 : 0,
      vision: capability.vision ? 1 : 0
    };

    // Compute weighted score
    score = (
      (cap.coding * weights.coding) +
      (cap.reasoning * weights.reasoning) +
      (cap.speed * weights.speed) +
      (cap.cost * weights.cost) +
      (cap.contextWindow * weights.contextWindow) +
      (cap.toolCalling * weights.toolCalling) +
      (cap.vision * weights.vision)
    );

    // Apply user preferences
    if (userPreferences) {
      if (userPreferences.preferLocal && capability.isLocal) {
        score *= 1.3;
      }
      if (userPreferences.preferOpenSource && this.isOpenSource(capability.providerId, capability.modelId)) {
        score *= 1.2;
      }
      if (userPreferences.preferCheapest) {
        score *= (1 + cap.cost * 0.5);
      }
    }

    // Apply health penalties
    score = this.applyHealthPenalties(score, health, penalties);

    // Hard constraints (capabilities required for task)
    score = this.applyHardConstraints(score, capability, taskType, penalties);

    return { score: Math.max(0, Math.round(score * 100) / 100), penalties };
  }

  private static applyHealthPenalties(
    score: number, 
    health: ProviderHealthState, 
    penalties: string[]
  ): number {
    if (!health.healthy) {
      penalties.push('Provider unhealthy');
      return score * 0.01; // Effectively disqualify
    }

    // Cooldown penalty
    if (health.cooldownUntil && health.cooldownUntil > Date.now()) {
      penalties.push('Provider cooling down');
      return score * 0.1;
    }

    // Success rate penalty
    if (health.totalRequests > 10) {
      const failureRate = 1 - health.successRate;
      if (failureRate > 0.2) {
        penalties.push(`High failure rate: ${(failureRate * 100).toFixed(0)}%`);
        score *= (1 - failureRate);
      }
    }

    // Consecutive failures penalty
    if (health.consecutiveFailures > 0) {
      penalties.push(`${health.consecutiveFailures} consecutive failures`);
      score *= Math.max(0.3, 1 - health.consecutiveFailures * 0.15);
    }

    // Latency penalty (prefer faster)
    if (health.avgLatency > 10000) {
      penalties.push(`High latency: ${health.avgLatency}ms`);
      score *= 0.8;
    } else if (health.avgLatency > 5000) {
      score *= 0.9;
    }

    return score;
  }

  private static applyHardConstraints(
    score: number,
    capability: ModelCapability,
    taskType: TaskType,
    penalties: string[]
  ): number {
    switch (taskType) {
      case 'VISION':
        if (!capability.vision && !capability.multimodal) {
          penalties.push('Model lacks vision capability');
          return score * 0.01;
        }
        break;
      case 'TOOL_USE':
        if (!capability.toolCalling && !capability.functionCalling) {
          penalties.push('Model lacks tool calling capability');
          return score * 0.1;
        }
        break;
      case 'RAG':
        if (capability.contextWindow < 32768) {
          penalties.push('Context window too small for RAG');
          score *= 0.5;
        }
        break;
      case 'CODING':
        if (capability.coding < 5) {
          penalties.push('Low coding capability');
          score *= 0.5;
        }
        break;
    }

    // Context window minimum for all tasks
    if (capability.contextWindow < 4096) {
      penalties.push('Very small context window');
      score *= 0.3;
    }

    return score;
  }

  private static isOpenSource(providerId: string, modelId: string): boolean {
    const openSourceProviders = ['ollama', 'custom'];
    const openSourceModels = ['llama', 'mistral', 'mixtral', 'phi', 'gemma', 'qwen', 'deepseek', 'yi', 'vicuna', 'alpaca'];
    
    if (openSourceProviders.includes(providerId)) return true;
    
    const lower = modelId.toLowerCase();
    return openSourceModels.some(m => lower.includes(m));
  }

  /**
   * Get all model scores for debugging/explainability
   */
  public static scoreAll(
    capabilities: ModelCapability[],
    taskType: TaskType,
    profile: RoutingProfile,
    healthMap: Map<string, ProviderHealthState>,
    userPreferences?: { preferLocal?: boolean; preferOpenSource?: boolean; preferCheapest?: boolean }
  ): Array<{ capability: ModelCapability; score: number; penalties: string[] }> {
    return capabilities
      .map(cap => {
        const health = healthMap.get(`${cap.providerId}:${cap.modelId}`) || {
          healthy: true,
          avgLatency: 0,
          successRate: 1,
          consecutiveFailures: 0,
          cooldownUntil: null,
          lastFailure: null,
          totalRequests: 0,
          totalErrors: 0
        };
        const { score, penalties } = this.score(cap, taskType, profile, health, userPreferences);
        return { capability: cap, score, penalties };
      })
      .sort((a, b) => b.score - a.score);
  }
}