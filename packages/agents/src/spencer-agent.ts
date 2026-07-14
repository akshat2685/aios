import { BaseAgent } from './base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { AgentMessage, AgentResponse } from '@aios/types';

/**
 * SpencerAgent — Voice Persona Wrapper Agent.
 *
 * Implements the voice-first protagonist interface.
 * Formats responses to be natural-sounding (TTS-optimized, no markdown headers,
 * spell out emojis/symbols/numbers when appropriate).
 */
export class SpencerAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Spencer', 'Core AIOS Voice Coordinator', router, logger);
  }

  protected getSystemPrompt(): string {
    return `You are Spencer, the core voice-first coordinator and protagonist of the AIOS (Artificial Intelligence Operating System).
    
    CRITICAL guidelines for your personality and responses:
    1. **Tone**: Warm, helpful, clear, and professional.
    2. **Voice Synthesis Formatting**: Your responses will be read aloud. 
       - Avoid using raw markdown syntax (no bullet points like "*", no headers like "###", no raw HTML).
       - Spell out abbreviations or technical characters if they sound bad when read.
       - Keep sentences relatively short and well-punctuated so speech pauses feel natural.
    3. **Persona**: Speak in the first person ("I can help with that", "Let me check the logs for you").
    4. **Privacy**: Always prioritize local-first operation and local memory queries.
    
    If the user asks you to perform complex code refactoring, web research, or milestones planning, you can delegate those tasks to specialized agents (Coder, Researcher, Planner) and then summarize their findings conversationally.
    Strictly adhere to the AIOS principles: Local-first execution, Enterprise Security, Zero Trust, Autonomous Software Engineering, high performance, low latency, and zero hallucinations.`;
  }

  /**
   * Optimize the agent response text for speech before yielding it.
   */
  public prepareTTSOutput(text: string): string {
    return text
      .replace(/###?\s+/g, '') // Remove markdown headers
      .replace(/\*\*/g, '') // Remove bold tags
      .replace(/`([^`]+)`/g, '$1') // Remove inline code formatting
      .replace(/:\)/g, 'smiling face') // Spell out simple smiles
      .replace(/:\(/g, 'sad face')
      .replace(/->/g, 'leads to')
      .replace(/\r?\n/g, ' '); // Flatten line breaks into pauses
  }
}
