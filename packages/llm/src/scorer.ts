import { TaskType, ModelCapability, RoutingProfile } from '@aios/types';

export class IntelligentScorer {
  public static score(
    capability: ModelCapability,
    taskType: TaskType,
    profile: RoutingProfile
  ): number {
    let score = 0;

    // Default weights
    let wCoding = 0;
    let wReasoning = 0;
    let wSpeed = 0;
    let wCost = 0;

    // 1. Task Type Base Weights
    switch (taskType) {
      case 'CODING':
        wCoding = 0.5; wReasoning = 0.3; wSpeed = 0.1; wCost = 0.1; break;
      case 'REASONING':
      case 'PLANNING':
      case 'RESEARCH':
        wReasoning = 0.6; wCoding = 0.1; wSpeed = 0.1; wCost = 0.2; break;
      case 'GENERAL_CHAT':
      case 'SUMMARIZATION':
      case 'TRANSLATION':
        wSpeed = 0.4; wCost = 0.3; wReasoning = 0.2; wCoding = 0.1; break;
      case 'TOOL_USE':
      case 'RAG':
        wReasoning = 0.4; wCoding = 0.3; wSpeed = 0.2; wCost = 0.1; break;
      default:
        wSpeed = 0.25; wCost = 0.25; wReasoning = 0.25; wCoding = 0.25; break;
    }

    // 2. Profile Overrides
    switch (profile) {
      case 'FASTEST':
        wSpeed *= 3; wCost *= 1.5; wReasoning *= 0.5; wCoding *= 0.5; break;
      case 'CHEAPEST':
        wCost *= 4; wSpeed *= 1.5; wReasoning *= 0.2; wCoding *= 0.2; break;
      case 'HIGHEST_QUALITY':
        wReasoning *= 3; wCoding *= 3; wCost *= 0.1; wSpeed *= 0.5; break;
      case 'BALANCED':
      default:
        break; // keep task weights
    }

    // Normalize weights
    const totalWeight = wCoding + wReasoning + wSpeed + wCost;
    wCoding /= totalWeight;
    wReasoning /= totalWeight;
    wSpeed /= totalWeight;
    wCost /= totalWeight;

    // 3. Compute Base Score
    score = (
      (capability.coding * wCoding) +
      (capability.reasoning * wReasoning) +
      (capability.speed * wSpeed) +
      (capability.cost * wCost)
    );

    // 4. Hard Constraints (Penalties)
    if (taskType === 'VISION' && !capability.vision) {
      score *= 0.01; // severely penalize models without vision for vision tasks
    }
    if (taskType === 'TOOL_USE' && !capability.toolCalling) {
      score *= 0.1;
    }

    return score;
  }
}
