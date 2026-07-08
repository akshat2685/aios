import { CoreLogger } from '@aios/core';
import { IntentPrediction, LongTermObjective } from '@aios/types';
import { ProfileEngine } from './profile-engine';

/**
 * IntentPredictor — Proactive intent inference for the Digital Twin.
 *
 * Uses the accumulated user profile to predict likely next requests,
 * generate context hints for agent system prompts, and track progress
 * toward long-term objectives.
 */
export class IntentPredictor {
  private logger: CoreLogger;
  private profileEngine: ProfileEngine;
  private predictionIdCounter: number = 0;
  private recentActions: Array<{ action: string; timestamp: number }> = [];

  constructor(logger: CoreLogger, profileEngine: ProfileEngine) {
    this.logger = logger;
    this.profileEngine = profileEngine;
    this.logger.info('Digital Twin IntentPredictor initialized');
  }

  /**
   * Generate intent predictions based on the current profile,
   * recent activity, and time-of-day patterns.
   */
  public async predictNextActions(limit: number = 5): Promise<IntentPrediction[]> {
    this.logger.debug('Generating intent predictions...');

    const profile = this.profileEngine.getProfile();
    const predictions: IntentPrediction[] = [];

    // Stub: Predict based on active objectives
    for (const objective of profile.objectives) {
      if (objective.progress < 1.0) {
        const nextMilestone = objective.milestones.find(
          m => !objective.completedMilestones.includes(m)
        );

        if (nextMilestone) {
          predictions.push({
            id: `pred-${++this.predictionIdCounter}`,
            predictedAction: `Work on: ${nextMilestone}`,
            confidence: 0.6 * (1 - objective.progress),
            reasoning: `Active objective "${objective.title}" is ${(objective.progress * 100).toFixed(0)}% complete`,
            suggestedPrompt: `Help me work on "${nextMilestone}" for my goal: ${objective.title}`,
            relatedObjectiveId: objective.id,
          });
        }
      }
    }

    // Stub: Predict based on recent action patterns
    // e.g., if the user has been debugging for the last hour, predict they might want to write tests
    const recentActionTypes = this.getRecentActionTypes();
    if (recentActionTypes.includes('debug')) {
      predictions.push({
        id: `pred-${++this.predictionIdCounter}`,
        predictedAction: 'Write tests for recently debugged code',
        confidence: 0.4,
        reasoning: 'Recent debugging activity suggests test coverage might be needed',
        suggestedPrompt: 'Write tests for the code I was just debugging',
      });
    }

    // Stub: Predict based on time-of-day patterns
    // e.g., user typically reviews PRs in the morning

    // Sort by confidence descending, limit results
    predictions.sort((a, b) => b.confidence - a.confidence);

    this.logger.debug(`Generated ${predictions.length} intent predictions`);
    return predictions.slice(0, limit);
  }

  /**
   * Record a user action for pattern analysis.
   */
  public recordAction(action: string): void {
    this.recentActions.push({ action, timestamp: Date.now() });

    // Keep only last 100 actions
    if (this.recentActions.length > 100) {
      this.recentActions = this.recentActions.slice(-100);
    }

    // Check if this action completes any objective milestones
    this.checkMilestoneCompletion(action);
  }

  /**
   * Generate context hints to inject into agent system prompts.
   * Combines profile data with predictions for personalized responses.
   */
  public async generateContextHints(): Promise<string> {
    const profile = this.profileEngine.getProfile();
    const predictions = await this.predictNextActions(3);

    const hints: string[] = [
      this.profileEngine.generateContextPrompt(),
    ];

    if (predictions.length > 0) {
      hints.push('<predicted_intents>');
      for (const pred of predictions) {
        hints.push(`- ${pred.predictedAction} (${(pred.confidence * 100).toFixed(0)}% confidence)`);
      }
      hints.push('</predicted_intents>');
    }

    return hints.join('\n');
  }

  /**
   * Suggest corrections when the user's behavior diverges from predictions.
   * This helps the predictor learn from prediction failures.
   */
  public reportPredictionOutcome(predictionId: string, wasAccurate: boolean): void {
    this.logger.debug(`Prediction ${predictionId} outcome: ${wasAccurate ? 'accurate' : 'inaccurate'}`);

    // Stub: Adjust prediction model weights based on accuracy feedback
    // In production, this would feed back into a reinforcement learning loop
  }

  // ─── Private ───────────────────────────────────────────────

  private getRecentActionTypes(): string[] {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return this.recentActions
      .filter(a => a.timestamp > oneHourAgo)
      .map(a => a.action);
  }

  private checkMilestoneCompletion(action: string): void {
    const profile = this.profileEngine.getProfile();

    for (const objective of profile.objectives) {
      for (const milestone of objective.milestones) {
        if (
          !objective.completedMilestones.includes(milestone) &&
          action.toLowerCase().includes(milestone.toLowerCase())
        ) {
          objective.completedMilestones.push(milestone);
          objective.progress = objective.milestones.length > 0
            ? objective.completedMilestones.length / objective.milestones.length
            : 0;
          objective.updatedAt = Date.now();

          this.profileEngine.upsertObjective(objective);
          this.logger.info(`Milestone completed: "${milestone}" for objective "${objective.title}"`);
        }
      }
    }
  }
}
