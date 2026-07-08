import { CoreLogger } from '@aios/core';

export interface DashboardStats {
  activeAgents: number;
  totalMemories: number;
  tokenUsageToday: number;
  costToday: number;
  activeGoals: number;
  recentTasks: any[];
}

export class DashboardAggregator {
  private logger: CoreLogger;

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  /**
   * Aggregates statistics across memory, workspace, agents, and llm router telemetry
   * to power the main AIOS dashboard UI.
   */
  public async getDashboardStats(): Promise<DashboardStats> {
    this.logger.debug('Aggregating dashboard statistics...');
    // Stub: 1. Fetch running agents from AgentRegistry/Workspace
    // Stub: 2. Fetch memory count from Qdrant/SQLite
    // Stub: 3. Fetch token usage from Router telemetry
    // Stub: 4. Fetch Active Goals from SQLite

    return {
      activeAgents: 2,
      totalMemories: 1450,
      tokenUsageToday: 34500,
      costToday: 0.15,
      activeGoals: 3,
      recentTasks: []
    };
  }
}
