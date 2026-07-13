import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { AgentMemoryEvolution } from '@aios/memory';

export interface TaskExecutionDetails {
  task: string;
  solution: string;
  outcome: 'success' | 'failure';
  errorDetails?: string;
}

/**
 * AIOS Reflection Loop
 * Analyzes task executions, especially failures, and appends new rules to the deep memory index.
 * Reference pattern: jwilger/agent-skills@session-reflection
 */
export class ReflectionLoop {
  private router: LLMRouter;
  private logger: CoreLogger;
  private memoryEvolution: AgentMemoryEvolution;
  private defaultModel = 'gpt-4o';

  constructor(router: LLMRouter, logger: CoreLogger, memoryEvolution: AgentMemoryEvolution) {
    this.router = router;
    this.logger = logger;
    this.memoryEvolution = memoryEvolution;
  }

  /**
   * Runs the reflection process after a task finishes.
   */
  async runReflection(details: TaskExecutionDetails): Promise<void> {
    this.logger.info(`Running AIOS Reflection Loop for task: ${details.task}`);

    let lessonLearned = 'Task completed successfully.';
    let futureRecommendation = 'Continue using the current approach for similar tasks.';

    if (details.outcome === 'failure') {
      this.logger.info('Task failed. Analyzing failure to extract lessons and future recommendations...');
      
      const prompt = `You are the AIOS Reflection Loop.
Based on the jwilger/agent-skills@session-reflection pattern, analyze the following task failure and generate a lesson learned and a future recommendation.

Task: ${details.task}
Solution Attempted: ${details.solution}
Outcome: ${details.outcome}
Error Details: ${details.errorDetails || 'None provided'}

Provide your response in strict JSON format:
{
  "lessonLearned": "Detailed explanation of what went wrong and why.",
  "futureRecommendation": "Actionable rule or advice to prevent this failure in the future."
}`;

      try {
        const response = await this.router.generate({
          prompt,
          model: this.defaultModel,
          taskType: 'complex' as any // Force to complex for deep analysis
        });

        const rawJson = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawJson);
        
        lessonLearned = parsed.lessonLearned || 'Failed to extract lesson.';
        futureRecommendation = parsed.futureRecommendation || 'Failed to extract recommendation.';
        
        this.logger.info('Successfully extracted reflection insights.');
      } catch (e: any) {
        this.logger.error(`Failed to generate reflection analysis: ${e.message}`);
        lessonLearned = 'Error during reflection analysis.';
        futureRecommendation = 'Review logs to determine the cause of the task failure manually.';
      }
    }

    // Append new rule to the deep memory index
    await this.memoryEvolution.recordEvolution({
      task: details.task,
      solution: details.solution,
      outcome: details.outcome,
      lessonLearned,
      futureRecommendation
    });
    
    this.logger.info('Reflection Loop completed and rule appended to deep memory index.');
  }
}
