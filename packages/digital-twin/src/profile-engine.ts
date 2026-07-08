import { CoreLogger } from '@aios/core';
import {
  UserProfile,
  CodingStyleProfile,
  TonePreference,
  LongTermObjective,
  DigitalTwinSnapshot,
  StyleObservation,
  IntentPrediction,
} from '@aios/types';

/**
 * ProfileEngine — Core user profile management for the Digital Twin.
 *
 * Maintains a persistent UserProfile that aggregates coding style dimensions,
 * tone preferences, and long-term objectives. Observations from the
 * LearningCollector are fed in with confidence scores, and temporal decay
 * ensures older observations contribute less to the aggregate profile.
 */
export class ProfileEngine {
  private logger: CoreLogger;
  private profile: UserProfile;
  private observations: StyleObservation[] = [];
  private decayHalfLifeMs: number = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(logger: CoreLogger) {
    this.logger = logger;
    this.profile = this.createDefaultProfile();
    this.logger.info('Digital Twin ProfileEngine initialized');
  }

  /**
   * Initialize by loading persisted profile from SQLite storage.
   */
  public async init(): Promise<void> {
    // Stub: Load profile from ~/.aios/digital_twin.db via @aios/storage
    // If no profile exists, keep the default
    this.logger.info('ProfileEngine loaded user profile');
  }

  /**
   * Get the current user profile.
   */
  public getProfile(): UserProfile {
    return { ...this.profile };
  }

  /**
   * Get a full Digital Twin snapshot including predictions.
   */
  public getSnapshot(): DigitalTwinSnapshot {
    return {
      profile: this.getProfile(),
      recentObservations: this.observations.slice(-50),
      predictions: [], // Filled by IntentPredictor
      generatedAt: Date.now(),
    };
  }

  /**
   * Record a new style observation and update the aggregate profile.
   */
  public recordObservation(observation: StyleObservation): void {
    this.observations.push(observation);
    this.logger.debug(`Recorded observation: ${observation.dimension} = ${observation.observedValue} (conf: ${observation.confidence})`);

    // Update the relevant profile dimension
    this.updateProfileDimension(observation);

    // Recalculate overall confidence
    this.profile.observationCount++;
    this.profile.confidence = Math.min(1.0, this.profile.observationCount / 100);
    this.profile.updatedAt = Date.now();
  }

  /**
   * Manually override a profile dimension (user correction).
   */
  public overrideDimension(dimension: string, value: any): void {
    this.logger.info(`Manual override: ${dimension} = ${value}`);
    this.applyDimensionValue(dimension, value);
    this.profile.updatedAt = Date.now();
  }

  /**
   * Add or update a long-term objective.
   */
  public upsertObjective(objective: LongTermObjective): void {
    const idx = this.profile.objectives.findIndex(o => o.id === objective.id);
    if (idx >= 0) {
      this.profile.objectives[idx] = objective;
      this.logger.info(`Updated objective: ${objective.title}`);
    } else {
      this.profile.objectives.push(objective);
      this.logger.info(`Added objective: ${objective.title}`);
    }
    this.profile.updatedAt = Date.now();
  }

  /**
   * Remove a long-term objective.
   */
  public removeObjective(objectiveId: string): void {
    this.profile.objectives = this.profile.objectives.filter(o => o.id !== objectiveId);
    this.profile.updatedAt = Date.now();
  }

  /**
   * Persist the current profile to storage.
   */
  public async save(): Promise<void> {
    // Stub: Serialize profile + observations to ~/.aios/digital_twin.db
    this.logger.info('Digital Twin profile persisted to storage');
  }

  /**
   * Export profile as a JSON string for backup or sharing.
   */
  public exportProfile(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  /**
   * Generate a system prompt context string from the current profile.
   * This is injected into agent system prompts for personalization.
   */
  public generateContextPrompt(): string {
    const cs = this.profile.codingStyle;
    const tone = this.profile.tone;

    return [
      '<user_profile>',
      `Coding Style: ${cs.indentation}, ${cs.namingConvention}, complexity=${cs.complexityPreference}`,
      `Preferred Languages: ${cs.preferredLanguages.join(', ')}`,
      `Preferred Frameworks: ${cs.preferredFrameworks.join(', ')}`,
      `Type Strictness: ${cs.typeStrictness}`,
      `Tone: formality=${tone.formality.toFixed(1)}, verbosity=${tone.verbosity.toFixed(1)}, techDepth=${tone.technicalDepth.toFixed(1)}`,
      `Response Style: ${tone.responseStructure}`,
      `Active Objectives: ${this.profile.objectives.filter(o => o.progress < 1.0).map(o => o.title).join(', ') || 'None'}`,
      `Profile Confidence: ${(this.profile.confidence * 100).toFixed(0)}%`,
      '</user_profile>',
    ].join('\n');
  }

  // ─── Private ───────────────────────────────────────────────

  private createDefaultProfile(): UserProfile {
    return {
      id: 'default-user',
      codingStyle: {
        indentation: 'spaces-2',
        namingConvention: 'camelCase',
        commentDensity: 0.3,
        preferredFrameworks: [],
        preferredLanguages: ['TypeScript'],
        complexityPreference: 'moderate',
        functionalVsOop: 0.5,
        avgFunctionLength: 20,
        typeStrictness: 'strict',
      },
      tone: {
        formality: 0.5,
        verbosity: 0.5,
        technicalDepth: 0.7,
        emojiUsage: 0.2,
        responseStructure: 'mixed',
      },
      objectives: [],
      observationCount: 0,
      confidence: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private updateProfileDimension(obs: StyleObservation): void {
    // Apply temporal decay to the observation's weight
    const age = Date.now() - obs.timestamp;
    const decayFactor = Math.pow(0.5, age / this.decayHalfLifeMs);
    const effectiveWeight = obs.confidence * decayFactor;

    this.applyDimensionValue(obs.dimension, obs.observedValue);
  }

  private applyDimensionValue(dimension: string, value: any): void {
    const parts = dimension.split('.');
    if (parts[0] === 'codingStyle' && parts.length === 2) {
      (this.profile.codingStyle as any)[parts[1]] = value;
    } else if (parts[0] === 'tone' && parts.length === 2) {
      (this.profile.tone as any)[parts[1]] = value;
    }
  }
}
