import { IMemoryClient } from '@aios/types';
import { v4 as uuidv4 } from 'uuid';

export interface Experience {
  id: string;
  timestamp: number;
  tier: 'hot' | 'deep'; // Inspired by anthropics/knowledge-work-plugins memory tiers
  state: Record<string, any>;
  action: Record<string, any>;
  outcome: Record<string, any>;
  reward?: number;
}

/**
 * Experience Replay tracking for the AIOS memory system.
 * Allows tracking past states, actions, and outcomes for future sampling and hybrid search retrieval.
 */
export class ExperienceReplay {
  constructor(private memoryClient: IMemoryClient) {}

  /**
   * Saves a new experience record to the memory system.
   */
  async saveExperience(experience: Omit<Experience, 'id' | 'timestamp'>): Promise<string> {
    const id = uuidv4();
    const timestamp = Date.now();
    
    // We encode the structured experience into a content string to support semantic/hybrid search
    const contentStr = `State: ${JSON.stringify(experience.state)}\nAction: ${JSON.stringify(experience.action)}\nOutcome: ${JSON.stringify(experience.outcome)}`;
    
    const record = {
      id,
      type: 'experience',
      content: contentStr,
      metadata: {
        tier: experience.tier,
        reward: experience.reward,
        timestamp,
        raw_state: experience.state,
        raw_action: experience.action,
        raw_outcome: experience.outcome,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    await this.memoryClient.add(record);
    return id;
  }

  /**
   * Retrieves high-priority 'hot' context experiences (e.g. recent active context).
   */
  async getHotContext(limit: number = 10): Promise<Experience[]> {
    const records = await this.memoryClient.search({
      query: 'recent high priority active context',
      filter: {
        must: [
          { key: 'type', match: { value: 'experience' } },
          { key: 'metadata.tier', match: { value: 'hot' } }
        ]
      },
      limit
    });
    return this.mapToExperiences(records);
  }

  /**
   * Samples deep/historical experiences, optionally using hybrid search (vector + keyword) 
   * to find relevant past interactions based on a query.
   */
  async sampleExperiences(query: string = 'past experiences', limit: number = 10, useHybridSearch: boolean = true): Promise<Experience[]> {
    const records = await this.memoryClient.search({
      query,
      filter: {
        must: [
          { key: 'type', match: { value: 'experience' } }
        ]
      },
      limit,
      hybrid: useHybridSearch
    });
    return this.mapToExperiences(records);
  }

  /**
   * Helper to deserialize memory records back to Experience objects
   */
  private mapToExperiences(records: any[]): Experience[] {
    return records.map(record => ({
      id: record.id,
      timestamp: record.metadata?.timestamp || record.createdAt,
      tier: record.metadata?.tier || 'deep',
      state: record.metadata?.raw_state || {},
      action: record.metadata?.raw_action || {},
      outcome: record.metadata?.raw_outcome || {},
      reward: record.metadata?.reward,
    }));
  }
}
