import { IMemoryClient } from '@aios/types';
import { v4 as uuidv4 } from 'uuid';

export interface EvolutionRecord {
  id: string;
  task: string;
  solution: string;
  outcome: 'success' | 'failure';
  lessonLearned: string;
  futureRecommendation: string;
  timestamp: number;
}

/**
 * Agent Memory Evolution database.
 * Tracks task executions, outcomes, and generated rules.
 * Reference pattern: jwilger/agent-skills@session-reflection
 */
export class AgentMemoryEvolution {
  constructor(private memoryClient: IMemoryClient) {}

  /**
   * Saves a new evolution record (rule) to the deep memory index.
   */
  async recordEvolution(record: Omit<EvolutionRecord, 'id' | 'timestamp'>): Promise<string> {
    const id = uuidv4();
    const timestamp = Date.now();
    
    // Encode into a rich content string for semantic search
    const contentStr = `Task: ${record.task}\nSolution: ${record.solution}\nOutcome: ${record.outcome}\nLesson Learned: ${record.lessonLearned}\nFuture Recommendation: ${record.futureRecommendation}`;
    
    const memoryRecord = {
      id,
      type: 'evolution_rule',
      content: contentStr,
      metadata: {
        task: record.task,
        solution: record.solution,
        outcome: record.outcome,
        lessonLearned: record.lessonLearned,
        futureRecommendation: record.futureRecommendation,
        timestamp,
        tier: 'deep' // Store in deep memory index
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    await this.memoryClient.add(memoryRecord);
    return id;
  }

  /**
   * Retrieves relevant future recommendations based on a query.
   */
  async getRelevantRules(query: string, limit: number = 5): Promise<EvolutionRecord[]> {
    const records = await this.memoryClient.search({
      query,
      filter: {
        must: [
          { key: 'type', match: { value: 'evolution_rule' } }
        ]
      },
      limit,
      hybrid: true
    });
    
    return records.map((r: any) => ({
      id: r.id,
      task: r.metadata?.task || '',
      solution: r.metadata?.solution || '',
      outcome: r.metadata?.outcome || 'success',
      lessonLearned: r.metadata?.lessonLearned || '',
      futureRecommendation: r.metadata?.futureRecommendation || '',
      timestamp: r.metadata?.timestamp || r.createdAt
    }));
  }
}
