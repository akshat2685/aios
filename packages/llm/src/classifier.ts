import { TaskType } from '@aios/types';

export class TaskClassifier {
  public static classify(prompt: string, hasImages?: boolean): { type: TaskType, confidence: number } {
    if (hasImages) {
      return { type: 'VISION', confidence: 1.0 };
    }

    const lower = prompt.toLowerCase();
    
    // Heuristic Rules
    const codingKeywords = ['python', 'javascript', 'typescript', 'rust', 'c++', 'html', 'css', 'function', 'script', 'debug', 'error', 'refactor', 'repo', 'npm', 'git'];
    const reasoningKeywords = ['compare', 'analyze', 'why', 'logic', 'explain', 'theory', 'philosophy', 'math', 'calculate', 'prove'];
    const researchKeywords = ['research', 'papers', 'studies', 'history', 'discover', 'timeline'];
    const summarizationKeywords = ['summarize', 'tldr', 'tl;dr', 'summary', 'brief', 'shorten'];
    const translationKeywords = ['translate', 'in spanish', 'in french', 'in german', 'in chinese', 'meaning in'];

    let counts = {
      CODING: 0,
      REASONING: 0,
      RESEARCH: 0,
      SUMMARIZATION: 0,
      TRANSLATION: 0
    };

    const words = lower.split(/[\s.,;:!?]+/);
    
    for (const w of words) {
      if (codingKeywords.includes(w)) counts.CODING += 2;
      if (reasoningKeywords.includes(w)) counts.REASONING += 1.5;
      if (researchKeywords.includes(w)) counts.RESEARCH += 2;
      if (summarizationKeywords.includes(w)) counts.SUMMARIZATION += 3;
      if (translationKeywords.includes(w)) counts.TRANSLATION += 3;
    }

    // Find max score
    let bestType: TaskType = 'GENERAL_CHAT';
    let maxScore = 0;

    for (const [type, score] of Object.entries(counts)) {
      if (score > maxScore) {
        maxScore = score;
        bestType = type as TaskType;
      }
    }

    // Calculate confidence based on score density
    let confidence = 0.5; // base
    if (maxScore > 5) confidence = 0.9;
    else if (maxScore > 3) confidence = 0.7;
    else if (maxScore > 0) confidence = 0.6;
    else confidence = 0.3; // no keywords matched, low confidence it's general chat

    return { type: bestType, confidence };
  }
}
