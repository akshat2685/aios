import fs from 'fs-extra';
import path from 'path';
import * as os from 'os';
import { AgentTool } from '@aios/types';

interface TaskItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[]; // List of task IDs this task depends on
}

interface Plan {
  id: string;
  goal: string;
  tasks: TaskItem[];
  createdAt: number;
}

const PLANS_FILE = path.join(os.homedir(), '.aios', 'plans.json');

async function loadPlans(): Promise<Plan[]> {
  try {
    if (await fs.pathExists(PLANS_FILE)) {
      return await fs.readJson(PLANS_FILE);
    }
  } catch (e) {
    // ignore load errors
  }
  return [];
}

async function savePlans(plans: Plan[]) {
  await fs.ensureDir(path.dirname(PLANS_FILE));
  await fs.writeJson(PLANS_FILE, plans, { spaces: 2 });
}

export function getPlannerTools(): AgentTool[] {
  return [
    {
      name: 'planner:create',
      description: 'Creates a new roadmap plan decomposing a high-level goal into actionable tasks and dependencies.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The overall high-level goal to accomplish' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique identifier for the task (e.g. task1, compile_docs)' },
                description: { type: 'string', description: 'Short description of the task action' },
                dependencies: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of task IDs this task depends on (optional)'
                }
              },
              required: ['id', 'description']
            }
          }
        },
        required: ['goal', 'tasks']
      },
      async execute({ goal, tasks }) {
        const plans = await loadPlans();
        const newPlan: Plan = {
          id: Math.random().toString(36).substring(7),
          goal,
          tasks: tasks.map((t: any) => ({
            id: t.id,
            description: t.description,
            status: 'pending',
            dependencies: t.dependencies || [],
          })),
          createdAt: Date.now(),
        };

        plans.push(newPlan);
        await savePlans(plans);
        return `Successfully created plan with ID: ${newPlan.id}. Tasks list:\n${JSON.stringify(newPlan.tasks, null, 2)}`;
      }
    },
    {
      name: 'planner:update_task',
      description: 'Updates the execution status of a specific task within an active plan.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'The ID of the plan to modify' },
          taskId: { type: 'string', description: 'The ID of the task to update' },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed'],
            description: 'New execution status'
          }
        },
        required: ['planId', 'taskId', 'status']
      },
      async execute({ planId, taskId, status }) {
        const plans = await loadPlans();
        const plan = plans.find(p => p.id === planId);
        if (!plan) return `Error: Plan with ID ${planId} not found.`;

        const task = plan.tasks.find(t => t.id === taskId);
        if (!task) return `Error: Task ${taskId} not found in plan ${planId}.`;

        task.status = status;
        await savePlans(plans);
        return `Successfully updated task ${taskId} in plan ${planId} to status: ${status}`;
      }
    },
    {
      name: 'planner:get_plan',
      description: 'Retrieves all tasks and statuses for a specific plan or lists all active plans.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'The ID of the plan to retrieve (optional). If omitted, lists all active plans.' }
        }
      },
      async execute({ planId }) {
        const plans = await loadPlans();
        if (planId) {
          const plan = plans.find(p => p.id === planId);
          if (!plan) return `Error: Plan with ID ${planId} not found.`;
          return JSON.stringify(plan, null, 2);
        }
        return JSON.stringify(plans.map(p => ({
          id: p.id,
          goal: p.goal,
          taskCount: p.tasks.length,
          completedCount: p.tasks.filter(t => t.status === 'completed').length,
          createdAt: p.createdAt
        })), null, 2);
      }
    }
  ];
}
