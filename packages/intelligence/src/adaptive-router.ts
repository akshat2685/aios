import { CoreLogger } from '@aios/core';
import { LLMRouter } from '@aios/llm';

export interface ProviderState {
  id: string;
  emaLatency: number;
  totalRequests: number;
  totalErrors: number;
  hallucinationRate?: number;
}

export class AdaptiveRouter {
  private logger: CoreLogger;
  private router: LLMRouter;
  
  private providers: string[] = [];
  private providerIndices: Map<string, number> = new Map();
  
  // 1-indexed Fenwick tree (Binary Indexed Tree) for prefix sums of weights
  private bit: number[] = [];
  private weights: number[] = [];
  private totalWeight: number = 0;

  constructor(logger: CoreLogger, router: LLMRouter) {
    this.logger = logger;
    this.router = router;
    
    // Initialize providers from router states
    const states = this.router.getProviderStates();
    const providerIds = Object.keys(states);
    
    const M = providerIds.length;
    this.providers = [...providerIds];
    this.bit = new Array(M + 1).fill(0);
    this.weights = new Array(M).fill(0);

    for (let i = 0; i < M; i++) {
      this.providerIndices.set(providerIds[i], i);
      // Initialize with uniform weights
      this.updateTree(i, 1.0);
    }
  }

  /**
   * O(1) time complexity to compute the ideal weight multiplier.
   */
  private calculateWeightMultiplier(state: ProviderState): number {
    // 1. Laplace smoothed success rate (punishes low requests and high errors)
    const successes = Math.max(0, state.totalRequests - state.totalErrors);
    const successRate = (successes + 1) / (state.totalRequests + 2);

    // 2. Latency factor (inverse relationship, bounded to avoid Infinity)
    const latencyBaseline = 100.0; // Assume 100ms is the ideal baseline
    const latencyFactor = latencyBaseline / Math.max(state.emaLatency, 1);

    // 3. Hallucination penalty (optional)
    const hallucinationPenalty = 1.0 - Math.min(Math.max(state.hallucinationRate ?? 0, 0), 0.99);

    // Exponential scaling to heavily penalize poor success rates
    const weight = Math.pow(successRate, 3) * latencyFactor * hallucinationPenalty;
    
    // Clamp to minimum positive value to ensure occasional exploration
    return Math.max(weight, 0.0001);
  }

  /**
   * Periodically adjusts the scoring weights based on actual
   * performance metrics (latency, success rate) gathered.
   * Runs in O(M log M) where M is the number of providers.
   */
  public optimizeRoutingWeights(): void {
    this.logger.info('Optimizing adaptive routing weights based on historical telemetry...');
    
    const states = this.router.getProviderStates();
    for (const [providerId, state] of Object.entries(states)) {
      const index = this.providerIndices.get(providerId);
      
      // If a new provider was added after initialization
      if (index === undefined) {
        this.addProvider(providerId);
      }
      
      this.optimizeRoutingWeightForProvider(providerId, {
        id: providerId,
        emaLatency: state.latency,
        totalRequests: state.totalRequests,
        totalErrors: state.totalErrors,
        hallucinationRate: 0 // Default to 0 as not tracked by base router yet
      });
    }
    
    this.logger.info('Routing weights updated successfully.');
  }

  private addProvider(providerId: string): void {
    this.providers.push(providerId);
    const index = this.providers.length - 1;
    this.providerIndices.set(providerId, index);
    
    // Rebuild tree arrays to accommodate new size
    this.bit.push(0);
    this.weights.push(0);
    this.updateTree(index, 1.0);
  }

  /**
   * Adjusts scoring weights for a single provider in O(log M) time.
   */
  public optimizeRoutingWeightForProvider(providerId: string, state: ProviderState): void {
    const index = this.providerIndices.get(providerId);
    if (index === undefined) return;

    const newWeight = this.calculateWeightMultiplier(state);
    this.updateTree(index, newWeight);
  }

  /**
   * Updates the Fenwick tree in O(log M) time.
   */
  private updateTree(index: number, newWeight: number): void {
    const delta = newWeight - this.weights[index];
    this.weights[index] = newWeight;
    this.totalWeight += delta;

    // Update Fenwick tree (1-indexed)
    const M = this.providers.length;
    for (let i = index + 1; i <= M; i += i & -i) {
      this.bit[i] += delta;
    }
  }

  /**
   * Selects a provider proportional to its weight in O(log M) time using binary lifting.
   */
  public selectProvider(): string {
    if (this.totalWeight <= 0) return this.providers[0]; // Fallback

    let target = Math.random() * this.totalWeight;
    let index = 0;
    const M = this.providers.length;

    // Find highest power of 2 <= M
    let maxPow = 1;
    while (maxPow <= M) maxPow <<= 1;
    maxPow >>= 1;

    // Binary lifting on the Fenwick Tree
    for (let step = maxPow; step > 0; step >>= 1) {
      const nextIndex = index + step;
      if (nextIndex <= M && this.bit[nextIndex] < target) {
        target -= this.bit[nextIndex];
        index = nextIndex;
      }
    }

    // index is the 0-based index of the selected provider
    return this.providers[index];
  }
}

