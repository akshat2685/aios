import { TaskType } from '@aios/types';

interface HeuristicRule {
  keywords: string[];
  weight: number;
  taskType: TaskType;
}

const HEURISTIC_RULES: HeuristicRule[] = [
  // CODING - highest priority for code-related tasks
  {
    keywords: ['python', 'javascript', 'typescript', 'rust', 'c++', 'c#', 'java', 'go', 'golang', 'html', 'css', 'sql', 'bash', 'shell', 'script'],
    weight: 3,
    taskType: 'CODING'
  },
  {
    keywords: ['function', 'class', 'method', 'variable', 'debug', 'error', 'bug', 'refactor', 'refactoring', 'repo', 'repository', 'npm', 'pip', 'cargo', 'maven', 'gradle', 'git', 'github', 'gitlab', 'api', 'endpoint', 'database', 'query', 'schema'],
    weight: 2,
    taskType: 'CODING'
  },
  {
    keywords: ['code', 'program', 'script', 'algorithm', 'implementation', 'compile', 'build', 'deploy', 'docker', 'kubernetes', 'ci/cd', 'pipeline', 'test', 'testing', 'unit test', 'integration test'],
    weight: 2,
    taskType: 'CODING'
  },

  // REASONING - analytical thinking
  {
    keywords: ['compare', 'analyze', 'analysis', 'why', 'logic', 'explain', 'theory', 'philosophy', 'math', 'calculate', 'prove', 'reason', 'deduce', 'infer', 'evaluate', 'assess'],
    weight: 2,
    taskType: 'REASONING'
  },
  {
    keywords: ['pros and cons', 'trade-off', 'tradeoff', 'advantage', 'disadvantage', 'critique', 'evaluate', 'argument', 'debate', 'perspective', 'viewpoint'],
    weight: 2,
    taskType: 'REASONING'
  },

  // PLANNING - task decomposition
  {
    keywords: ['plan', 'planning', 'roadmap', 'strategy', 'step by step', 'break down', 'decompose', 'milestone', 'timeline', 'schedule', 'organize', 'prioritize'],
    weight: 3,
    taskType: 'PLANNING'
  },

  // RESEARCH - information gathering
  {
    keywords: ['research', 'paper', 'papers', 'study', 'studies', 'history', 'discover', 'timeline', 'find', 'search', 'investigate', 'explore', 'survey', 'literature', 'academic', 'arxiv', 'pubmed'],
    weight: 3,
    taskType: 'RESEARCH'
  },

  // SUMMARIZATION - condensing content
  {
    keywords: ['summarize', 'summary', 'tldr', 'tl;dr', 'brief', 'shorten', 'condense', 'digest', 'synopsis', 'overview', 'key points', 'main points'],
    weight: 3,
    taskType: 'SUMMARIZATION'
  },

  // TRANSLATION - language conversion
  {
    keywords: ['translate', 'translation', 'in spanish', 'in french', 'in german', 'in chinese', 'in japanese', 'in korean', 'in italian', 'in portuguese', 'in russian', 'in arabic', 'meaning in', 'what does', 'mean in'],
    weight: 3,
    taskType: 'TRANSLATION'
  },

  // VISION - image analysis
  {
    keywords: ['image', 'picture', 'photo', 'screenshot', 'diagram', 'chart', 'graph', 'visual', 'look at', 'see this', 'analyze image', 'describe image'],
    weight: 5,
    taskType: 'VISION'
  },

  // RAG - retrieval augmented generation
  {
    keywords: ['document', 'pdf', 'file', 'knowledge base', 'vector', 'embedding', 'retrieve', 'retrieval', 'context', 'search documents', 'my files', 'my notes'],
    weight: 2,
    taskType: 'RAG'
  },

  // TOOL_USE - function calling
  {
    keywords: ['call', 'invoke', 'execute', 'run', 'function', 'tool', 'api call', 'webhook', 'automation', 'trigger', 'schedule'],
    weight: 2,
    taskType: 'TOOL_USE'
  }
];

export class TaskClassifier {
  /**
   * Classify a prompt using heuristic rules first
   * Returns task type and confidence score (0-1)
   */
  public static classify(prompt: string, hasImages?: boolean): { type: TaskType; confidence: number } {
    // Vision takes priority if images are present
    if (hasImages) {
      return { type: 'VISION', confidence: 1.0 };
    }

    const lower = prompt.toLowerCase();
    const words = lower.split(/[\s.,;:!?()\[\]{}"'`/\\]+/).filter(w => w.length > 0);
    
    // Score each task type
    const scores: Record<TaskType, number> = {
      GENERAL_CHAT: 0,
      CODING: 0,
      REASONING: 0,
      RESEARCH: 0,
      VISION: 0,
      SUMMARIZATION: 0,
      TRANSLATION: 0,
      PLANNING: 0,
      RAG: 0,
      TOOL_USE: 0
    };

    // Apply heuristic rules
    for (const rule of HEURISTIC_RULES) {
      let matches = 0;
      for (const keyword of rule.keywords) {
        // Check for word boundaries
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(lower)) {
          matches++;
        }
      }
      
      if (matches > 0) {
        // Weight by number of matches and rule weight
        scores[rule.taskType] += matches * rule.weight;
      }
    }

    // Find best match
    let bestType: TaskType = 'GENERAL_CHAT';
    let maxScore = scores.GENERAL_CHAT;

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestType = type as TaskType;
      }
    }

    // Calculate confidence based on score
    // Score thresholds: 0=0.3, 1-2=0.5, 3-5=0.7, 6-10=0.85, 10+=0.95
    let confidence = 0.3; // base confidence for GENERAL_CHAT
    
    if (maxScore === 0) {
      confidence = 0.3;
      bestType = 'GENERAL_CHAT';
    } else if (maxScore <= 2) {
      confidence = 0.5;
    } else if (maxScore <= 5) {
      confidence = 0.7;
    } else if (maxScore <= 10) {
      confidence = 0.85;
    } else {
      confidence = 0.95;
    }

    // Boost confidence for very specific keywords
    const strongIndicators = {
      CODING: ['write a python', 'write a javascript', 'create a function', 'debug this', 'fix this code'],
      PLANNING: ['create a plan', 'step by step plan', 'project plan'],
      SUMMARIZATION: ['tldr:', 'tl;dr:', 'summarize this'],
      TRANSLATION: ['translate to', 'translate into']
    };

    for (const [type, phrases] of Object.entries(strongIndicators)) {
      for (const phrase of phrases) {
        if (lower.includes(phrase)) {
          confidence = Math.min(0.98, confidence + 0.15);
          bestType = type as TaskType;
        }
      }
    }

    return { type: bestType, confidence: Math.min(1.0, confidence) };
  }

  /**
   * Analyze the complexity of a task based on prompt heuristics
   */
  public static analyzeComplexity(prompt: string): 'simple' | 'complex' | 'security' {
    const lower = prompt.toLowerCase();
    
    // 1. Security Check
    const securityKeywords = ['password', 'secret', 'key', 'token', 'credential', 'auth', 'vulnerability', 'exploit', 'hack', 'pii', 'confidential'];
    if (securityKeywords.some(kw => lower.includes(kw))) {
      return 'security';
    }

    // 2. Complex Check
    const complexKeywords = ['architect', 'design', 'refactor', 'system', 'analyze', 'explain', 'compare', 'evaluate', 'plan', 'strategy', 'why', 'prove'];
    if (prompt.length > 500 || complexKeywords.some(kw => lower.includes(kw))) {
      return 'complex';
    }

    // 3. Simple Check
    return 'simple';
  }

  /**
   * Classify using a local LLM as fallback when confidence is low
   * This should be called only when heuristic confidence < threshold
   */
  public static async classifyWithLocalLLM(
    prompt: string, 
    localLLM: { generate: (req: any) => Promise<any> },
    threshold: number = 0.6
  ): Promise<{ type: TaskType; confidence: number; usedLLM: boolean }> {
    const heuristic = this.classify(prompt);
    
    // High confidence - return heuristic result
    if (heuristic.confidence >= threshold) {
      return { ...heuristic, usedLLM: false };
    }

    // Low confidence - use local LLM to classify
    try {
      const classificationPrompt = `Classify this prompt into exactly one task type. Return only the task type.

Task Types:
- GENERAL_CHAT: General conversation, questions, casual chat
- CODING: Writing, debugging, explaining code
- REASONING: Logical analysis, problem solving, math
- PLANNING: Creating plans, roadmaps, strategies
- RESEARCH: Finding information, literature review
- SUMMARIZATION: Condensing text, TL;DR
- TRANSLATION: Converting between languages
- VISION: Analyzing images, screenshots
- RAG: Querying documents, knowledge bases
- TOOL_USE: Calling functions, APIs, automation

Prompt: "${prompt}"

Task Type:`;

      const response = await localLLM.generate({
        prompt: classificationPrompt,
        systemPrompt: 'You are a task classifier. Output only the task type.',
        model: 'llama3.2:latest',
        temperature: 0.1,
        maxTokens: 20
      });

      const predictedType = response.content.trim().toUpperCase() as TaskType;
      
      // Validate the predicted type
      const validTypes: TaskType[] = ['GENERAL_CHAT', 'CODING', 'REASONING', 'PLANNING', 'RESEARCH', 'SUMMARIZATION', 'TRANSLATION', 'VISION', 'RAG', 'TOOL_USE'];
      if (validTypes.includes(predictedType)) {
        return { type: predictedType, confidence: 0.85, usedLLM: true };
      }
    } catch (error) {
      console.warn('Local LLM classification failed, falling back to heuristic:', error);
    }

    return { ...heuristic, usedLLM: false };
  }
}