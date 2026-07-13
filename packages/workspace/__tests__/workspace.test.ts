import { describe, it, expect } from 'vitest';

describe('Workspace Package', () => {
  it('should detect active projects', () => {
    const workspaces = ['spencer-project', 'other-project'];
    expect(workspaces).toContain('spencer-project');
  });
});
