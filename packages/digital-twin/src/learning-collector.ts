import { CoreLogger } from '@aios/core';
import { StyleObservation } from '@aios/types';
import { ProfileEngine } from './profile-engine';

/**
 * LearningCollector — Passive observation pipeline for the Digital Twin.
 *
 * Hooks into agent conversation history and code diffs to extract style
 * signals. Analyzes patterns in user behavior and feeds observations into
 * the ProfileEngine with confidence scores.
 */
export class LearningCollector {
  private logger: CoreLogger;
  private profileEngine: ProfileEngine;
  private observationIdCounter: number = 0;

  constructor(logger: CoreLogger, profileEngine: ProfileEngine) {
    this.logger = logger;
    this.profileEngine = profileEngine;
    this.logger.info('Digital Twin LearningCollector initialized');
  }

  /**
   * Analyze a conversation message for tone and preference signals.
   */
  public analyzeConversation(userMessage: string, agentResponse: string): void {
    this.logger.debug('Analyzing conversation for style signals...');

    // Detect formality level
    const formalityScore = this.estimateFormality(userMessage);
    if (formalityScore !== null) {
      this.emitObservation('tone.formality', formalityScore, 0.3, 'conversation');
    }

    // Detect verbosity preference from message length patterns
    const verbositySignal = this.estimateVerbosityPreference(userMessage);
    if (verbositySignal !== null) {
      this.emitObservation('tone.verbosity', verbositySignal, 0.2, 'conversation');
    }

    // Detect explicit preference statements
    const explicitPrefs = this.extractExplicitPreferences(userMessage);
    for (const pref of explicitPrefs) {
      this.emitObservation(pref.dimension, pref.value, 0.9, 'explicit_statement');
    }
  }

  /**
   * Analyze a code diff to detect coding style patterns.
   */
  public analyzeCodeDiff(diff: string, filePath: string): void {
    this.logger.debug(`Analyzing code diff for style signals: ${filePath}`);

    // Detect indentation style
    const indentation = this.detectIndentation(diff);
    if (indentation) {
      this.emitObservation('codingStyle.indentation', indentation, 0.7, 'code_diff');
    }

    // Detect naming convention
    const naming = this.detectNamingConvention(diff);
    if (naming) {
      this.emitObservation('codingStyle.namingConvention', naming, 0.6, 'code_diff');
    }

    // Detect language from file extension
    const language = this.detectLanguageFromPath(filePath);
    if (language) {
      this.emitObservation('codingStyle.preferredLanguages', [language], 0.5, 'code_diff');
    }

    // Detect comment density
    const commentRatio = this.measureCommentDensity(diff);
    if (commentRatio !== null) {
      this.emitObservation('codingStyle.commentDensity', commentRatio, 0.4, 'code_diff');
    }
  }

  /**
   * Analyze tool usage patterns to infer framework preferences.
   */
  public analyzeToolUsage(toolName: string, toolArgs: Record<string, any>): void {
    this.logger.debug(`Analyzing tool usage: ${toolName}`);

    // Stub: Detect framework mentions in tool arguments
    // e.g., if the user frequently asks for React code, add 'React' to preferredFrameworks
  }

  /**
   * Analyze user behavior patterns (e.g., time of activity, task types).
   */
  public analyzeBehavior(action: string, metadata: Record<string, any>): void {
    this.logger.debug(`Analyzing behavior: ${action}`);

    // Stub: Track behavioral patterns
    // e.g., user prefers working late at night, frequently switches between projects
  }

  // ─── Private Analysis Methods ──────────────────────────────

  private estimateFormality(text: string): number | null {
    if (!text || text.length < 10) return null;

    // Simple heuristic: count formal indicators vs casual ones
    const formalWords = ['please', 'kindly', 'would you', 'could you', 'thank you', 'regards'];
    const casualWords = ['hey', 'yo', 'lol', 'btw', 'gonna', 'wanna', 'kinda', 'nah', 'yep'];

    const lowerText = text.toLowerCase();
    let formalCount = formalWords.filter(w => lowerText.includes(w)).length;
    let casualCount = casualWords.filter(w => lowerText.includes(w)).length;

    if (formalCount + casualCount === 0) return null;
    return formalCount / (formalCount + casualCount);
  }

  private estimateVerbosityPreference(text: string): number | null {
    if (!text) return null;

    // Heuristic based on message length
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 3) return 0.2; // Very terse
    if (wordCount < 15) return 0.4;
    if (wordCount < 50) return 0.6;
    if (wordCount < 150) return 0.8;
    return 1.0; // Very verbose
  }

  private extractExplicitPreferences(text: string): Array<{ dimension: string; value: any }> {
    const prefs: Array<{ dimension: string; value: any }> = [];
    const lower = text.toLowerCase();

    // Detect explicit preference statements
    if (lower.includes('prefer tabs') || lower.includes('use tabs')) {
      prefs.push({ dimension: 'codingStyle.indentation', value: 'tabs' });
    }
    if (lower.includes('prefer spaces') || lower.includes('use spaces')) {
      prefs.push({ dimension: 'codingStyle.indentation', value: 'spaces-2' });
    }
    if (lower.includes('4 spaces') || lower.includes('four spaces')) {
      prefs.push({ dimension: 'codingStyle.indentation', value: 'spaces-4' });
    }
    if (lower.includes('snake_case') || lower.includes('snake case')) {
      prefs.push({ dimension: 'codingStyle.namingConvention', value: 'snake_case' });
    }
    if (lower.includes('camelcase') || lower.includes('camel case')) {
      prefs.push({ dimension: 'codingStyle.namingConvention', value: 'camelCase' });
    }
    if (lower.includes('be concise') || lower.includes('keep it short')) {
      prefs.push({ dimension: 'tone.verbosity', value: 0.2 });
    }
    if (lower.includes('be detailed') || lower.includes('explain thoroughly')) {
      prefs.push({ dimension: 'tone.verbosity', value: 0.9 });
    }

    return prefs;
  }

  private detectIndentation(diff: string): string | null {
    const lines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
    if (lines.length === 0) return null;

    let tabCount = 0;
    let space2Count = 0;
    let space4Count = 0;

    for (const line of lines) {
      const content = line.substring(1); // Remove the '+' prefix
      if (content.startsWith('\t')) tabCount++;
      else if (content.startsWith('    ')) space4Count++;
      else if (content.startsWith('  ')) space2Count++;
    }

    const total = tabCount + space2Count + space4Count;
    if (total === 0) return null;
    if (tabCount > space2Count && tabCount > space4Count) return 'tabs';
    if (space4Count > space2Count) return 'spaces-4';
    return 'spaces-2';
  }

  private detectNamingConvention(diff: string): string | null {
    // Stub: Analyze variable/function names in the diff
    // Look for patterns: camelCase, snake_case, PascalCase
    const camelCasePattern = /[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*/g;
    const snakeCasePattern = /[a-z]+_[a-z]+/g;

    const camelMatches = diff.match(camelCasePattern)?.length || 0;
    const snakeMatches = diff.match(snakeCasePattern)?.length || 0;

    if (camelMatches + snakeMatches === 0) return null;
    return camelMatches >= snakeMatches ? 'camelCase' : 'snake_case';
  }

  private detectLanguageFromPath(filePath: string): string | null {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
      py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', cpp: 'C++',
      cs: 'C#', rb: 'Ruby', swift: 'Swift', kt: 'Kotlin',
    };
    return ext ? langMap[ext] || null : null;
  }

  private measureCommentDensity(diff: string): number | null {
    const addedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
    if (addedLines.length < 5) return null;

    const commentLines = addedLines.filter(l => {
      const trimmed = l.substring(1).trim();
      return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    });

    return commentLines.length / addedLines.length;
  }

  private emitObservation(
    dimension: string,
    value: any,
    confidence: number,
    source: StyleObservation['source']
  ): void {
    const observation: StyleObservation = {
      id: `obs-${++this.observationIdCounter}-${Date.now()}`,
      dimension,
      observedValue: value,
      confidence,
      source,
      timestamp: Date.now(),
    };

    this.profileEngine.recordObservation(observation);
  }
}
