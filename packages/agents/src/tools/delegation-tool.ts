import { AgentTool } from '@aios/types';

export function getDelegationTool(
  delegate: (agentId: string, task: string) => Promise<string>
): AgentTool {
  return {
    name: 'agent:delegate',
    description: 'Delegates a sub-task or question to another specialized agent (e.g. Coder, Researcher, Planner, Assistant). Returns their final response.',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          enum: ['coder', 'researcher', 'planner', 'assistant'],
          description: 'The target agent ID to delegate the task to'
        },
        task: { type: 'string', description: 'The task description or question to ask the agent' }
      },
      required: ['agentId', 'task']
    },
    async execute({ agentId, task }) {
      try {
        return await delegate(agentId, task);
      } catch (err: any) {
        return `Error delegating to agent ${agentId}: ${err.message}`;
      }
    }
  };
}
