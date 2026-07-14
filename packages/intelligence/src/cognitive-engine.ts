import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { Epic } from './task-types';

export class CognitiveEngine {
  private router: LLMRouter;
  private logger: CoreLogger;
  private defaultModel = 'gpt-4o'; // Or fallback model

  constructor(router: LLMRouter, logger: CoreLogger) {
    this.router = router;
    this.logger = logger;
  }

  async parseGoalIntoEpic(goal: string, availableAgents: string[]): Promise<Epic> {
    this.logger.info(`Cognitive Engine parsing goal into Epic: ${goal}`);
    
    const prompt = `You are the AIOS Cognitive Engine. 
Based on the qodex-ai/ai-agent-skills@multi-agent-orchestration and stablyai/orca@orchestration patterns, 
parse the following goal into a structured Epic with multiple sub-tasks.
Strictly adhere to the AIOS principles: Local-first execution, Enterprise Security, Zero Trust, Autonomous Software Engineering, high performance, low latency, and zero hallucinations.
Goal: ${goal}

Available Agents: ${availableAgents.join(', ')}

For each task, provide:
1. id (string, unique)
2. title (string)
3. description (string, detailed instruction)
4. dependencies (array of task ids that must be completed before this task)
5. assignedAgent (string, chosen from available agents)
6. complexity ('low', 'medium', or 'high')

Respond ONLY with valid JSON in the following format:
{
  "id": "epic-123",
  "goal": "The original goal",
  "tasks": [
    {
      "id": "task-1",
      "title": "...",
      "description": "...",
      "dependencies": [],
      "assignedAgent": "...",
      "complexity": "..."
    }
  ]
}`;

    try {
      const response = await this.router.generate({
        prompt: prompt,
        model: this.defaultModel,
        taskType: 'PLANNING'
      });

      const rawJson = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawJson);
      
      const epic: Epic = {
        id: parsed.id || `epic-${Date.now()}`,
        goal: parsed.goal || goal,
        tasks: parsed.tasks.map((t: any) => ({
          ...t,
          status: 'pending',
        })),
        status: 'pending'
      };
      
      this.logger.info(`Cognitive Engine created Epic with ${epic.tasks.length} tasks.`);
      return epic;
    } catch (e: any) {
      this.logger.error(`Failed to parse cognitive engine output: ${e.message}`);
      throw new Error("Failed to parse cognitive engine output");
    }
  }
}
