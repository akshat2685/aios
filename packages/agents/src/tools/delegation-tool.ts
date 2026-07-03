import { AgentTool } from '@aios/types';

export function getDelegationTool(
  delegate: (agentId: string, task: string, planId?: string, taskId?: string) => Promise<string>
): AgentTool {
  return {
    name: 'agent:delegate',
    description: 'Delegates a sub-task or question to another specialized agent (e.g. Coder, Researcher, Planner, Assistant). Returns their final response. If this task belongs to a Plan, provide the planId and taskId.',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          enum: ['coder', 'researcher', 'planner', 'assistant'],
          description: 'The target agent ID to delegate the task to'
        },
        task: { type: 'string', description: 'The task description or question to ask the agent' },
        planId: { type: 'string', description: 'Optional. The ID of the plan this task belongs to.' },
        taskId: { type: 'string', description: 'Optional. The ID of the task in the plan to mark as in_progress and later completed.' }
      },
      required: ['agentId', 'task']
    },
    async execute({ agentId, task, planId, taskId }) {
      try {
        return await delegate(agentId, task, planId, taskId);
      } catch (err: any) {
        return `Error delegating to agent ${agentId}: ${err.message}`;
      }
    }
  };
}
