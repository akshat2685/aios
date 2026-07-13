export interface AgentStats {
  totalTasks: number;
  successfulTasks: number;
  totalIterations: number;
  securityViolations: number;
}

export class AgentReputationTracker {
  private stats: Map<string, AgentStats> = new Map();
  private taskTypePreferences: Map<string, string> = new Map();

  constructor() {}

  public getStats(agentId: string): AgentStats {
    if (!this.stats.has(agentId)) {
      this.stats.set(agentId, {
        totalTasks: 0,
        successfulTasks: 0,
        totalIterations: 0,
        securityViolations: 0,
      });
    }
    return this.stats.get(agentId)!;
  }

  public recordTaskCompletion(agentId: string, success: boolean, iterations: number = 1) {
    const stat = this.getStats(agentId);
    stat.totalTasks++;
    if (success) {
      stat.successfulTasks++;
    }
    stat.totalIterations += iterations;
  }

  public recordSecurityViolation(agentId: string) {
    const stat = this.getStats(agentId);
    stat.securityViolations++;
  }

  public getSuccessRate(agentId: string): number {
    const stat = this.getStats(agentId);
    if (stat.totalTasks === 0) return 0;
    return stat.successfulTasks / stat.totalTasks;
  }

  public getAverageIterations(agentId: string): number {
    const stat = this.getStats(agentId);
    if (stat.totalTasks === 0) return 0;
    return stat.totalIterations / stat.totalTasks;
  }

  public getSecurityScore(agentId: string): number {
    const stat = this.getStats(agentId);
    if (stat.totalTasks === 0) return 100;
    // Base score 100, deduct 20 points per violation
    return Math.max(0, 100 - (stat.securityViolations * 20));
  }

  public getBestAgent(agentIds: string[], criterion: 'successRate' | 'iterations' | 'security' = 'successRate'): string {
    if (agentIds.length === 0) throw new Error("No agents provided");
    
    return agentIds.reduce((best, current) => {
      if (criterion === 'successRate') {
        const currentRate = this.getSuccessRate(current);
        const bestRate = this.getSuccessRate(best);
        return currentRate >= bestRate ? current : best;
      } else if (criterion === 'iterations') {
        const currentIter = this.getAverageIterations(current);
        const bestIter = this.getAverageIterations(best);
        // Lower is better, but 0 usually means no tasks yet, handle it fairly? 
        // We'll prefer actual data if possible.
        if (bestIter === 0 && currentIter > 0) return current;
        if (currentIter === 0 && bestIter > 0) return best;
        return currentIter <= bestIter ? current : best;
      } else {
        return this.getSecurityScore(current) >= this.getSecurityScore(best) ? current : best;
      }
    });
  }

  public recommendAgentForTask(taskType: string, availableAgents: string[]): string {
    // Basic logic to learn from stats per task type could be added here
    // For now, if we have a preference mapped, try to use it if available
    if (this.taskTypePreferences.has(taskType)) {
        const pref = this.taskTypePreferences.get(taskType)!;
        if (availableAgents.includes(pref)) return pref;
    }
    return this.getBestAgent(availableAgents, 'successRate');
  }

  public getReputationSummary(agentId: string): string {
    const rate = (this.getSuccessRate(agentId) * 100).toFixed(1);
    const iter = this.getAverageIterations(agentId).toFixed(1);
    const sec = this.getSecurityScore(agentId);
    return `Agent ${agentId} - Success Rate: ${rate}%, Avg Iterations: ${iter}, Security Score: ${sec}`;
  }
}
