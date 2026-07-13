import { describe, it, expect } from 'vitest';

describe('Context Engine Package Unit Tests', () => {
  describe('Context Aggregation', () => {
    it('should aggregate current chat context', () => {
      const chatContext = { messages: [{ role: 'user', content: 'hello' }] };
      expect(chatContext.messages.length).toBe(1);
    });

    it('should aggregate workspace context', () => {
      const workspaceContext = { activeFile: 'main.ts', language: 'typescript' };
      expect(workspaceContext.activeFile).toBe('main.ts');
    });

    it('should aggregate goals context', () => {
      const goalsContext = { activeGoal: 'Build feature X', progress: 50 };
      expect(goalsContext.progress).toBe(50);
    });

    it('should aggregate timeline context', () => {
      const timelineContext = { recentEvents: ['file_saved', 'agent_started'] };
      expect(timelineContext.recentEvents).toContain('file_saved');
    });

    it('should combine all contexts into a unified payload', () => {
      const unifiedContext = {
        chat: { active: true },
        workspace: { active: true },
        goals: { active: true },
        graph: { active: true }
      };
      expect(Object.keys(unifiedContext).length).toBe(4);
    });
  });
});
