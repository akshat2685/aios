import fs from 'fs-extra';
import path from 'path';
import * as os from 'os';
import { AgentTool, Task, Plan, LLMRequest } from '@aios/types';

// We need to import LLMRouter, but since @aios/llm might not be fully available in types,
// we can use a structural interface or import from the package if it's there.
// For now, we will type it as any to avoid circular dependencies if LLMRouter isn't exported in types,
// or we can import it from '@aios/llm'.
import { LLMRouter } from '@aios/llm';

const PLANS_FILE = path.join(os.homedir(), '.aios', 'plans.json');

export async function loadPlans(): Promise<Plan[]> {
  try {
    if (await fs.pathExists(PLANS_FILE)) {
      return await fs.readJson(PLANS_FILE);
    }
  } catch (e) {
    // ignore load errors
  }
  return [];
}

export async function savePlans(plans: Plan[]) {
  await fs.ensureDir(path.dirname(PLANS_FILE));
  await fs.writeJson(PLANS_FILE, plans, { spaces: 2 });
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function buildTaskTreeStr(tasks: Task[], parentId?: string, prefix: string = ''): string {
  const children = tasks.filter(t => t.parentId === parentId);
  let result = '';
  
  children.forEach((child, index) => {
    const isLast = index === children.length - 1;
    const marker = isLast ? '└── ' : '├── ';
    
    let statusIcon = '⏳';
    if (child.status === 'in_progress') statusIcon = '🔄';
    if (child.status === 'completed') statusIcon = '✅';
    if (child.status === 'failed') statusIcon = '❌';

    const assignStr = child.assignedAgent ? ` [@${child.assignedAgent}]` : '';
    const depsStr = child.dependencies.length > 0 ? ` (deps: ${child.dependencies.join(', ')})` : '';

    result += `${prefix}${marker}[${child.id}] ${statusIcon} ${child.title}${assignStr}${depsStr}\n`;
    
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    result += buildTaskTreeStr(tasks, child.id, newPrefix);
  });
  
  return result;
}

export function getPlannerTools(router?: LLMRouter): AgentTool[] {
  return [
    {
      name: 'plan:create',
      description: 'Creates a new root project plan with a high-level goal.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The overall high-level goal to accomplish' },
          title: { type: 'string', description: 'A short title for this plan' }
        },
        required: ['goal', 'title']
      },
      async execute({ goal, title }) {
        const plans = await loadPlans();
        const rootTask: Task = {
          id: generateId(),
          title: title,
          description: goal,
          status: 'pending',
          dependencies: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const newPlan: Plan = {
          id: generateId(),
          goal,
          tasks: [rootTask],
          createdAt: Date.now(),
        };

        plans.push(newPlan);
        await savePlans(plans);
        return `Successfully created plan with ID: ${newPlan.id}. Root task ID is ${rootTask.id}.`;
      }
    },
    {
      name: 'plan:list',
      description: 'Lists all active plans and outputs a visual task tree for a specific plan.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'The ID of the plan to retrieve. If omitted, lists all active plans.' }
        }
      },
      async execute({ planId }) {
        const plans = await loadPlans();
        if (planId) {
          const plan = plans.find(p => p.id === planId);
          if (!plan) return `Error: Plan with ID ${planId} not found.`;
          
          let output = `Plan: ${plan.goal}\n`;
          output += buildTaskTreeStr(plan.tasks);
          return output;
        }
        
        return JSON.stringify(plans.map(p => ({
          id: p.id,
          goal: p.goal,
          taskCount: p.tasks.length,
          completedCount: p.tasks.filter(t => t.status === 'completed').length,
          createdAt: p.createdAt
        })), null, 2);
      }
    },
    {
      name: 'plan:update',
      description: 'Updates the status or description of a specific task within a plan.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'The ID of the plan' },
          taskId: { type: 'string', description: 'The ID of the task to update' },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed'],
            description: 'New execution status'
          },
          description: { type: 'string', description: 'New description (optional)' }
        },
        required: ['planId', 'taskId', 'status']
      },
      async execute({ planId, taskId, status, description }) {
        const plans = await loadPlans();
        const plan = plans.find(p => p.id === planId);
        if (!plan) return `Error: Plan with ID ${planId} not found.`;

        const task = plan.tasks.find(t => t.id === taskId);
        if (!task) return `Error: Task ${taskId} not found in plan ${planId}.`;

        task.status = status;
        if (description) task.description = description;
        task.updatedAt = Date.now();
        
        await savePlans(plans);
        return `Successfully updated task ${taskId} in plan ${planId} to status: ${status}`;
      }
    },
    {
      name: 'plan:delete',
      description: 'Deletes a task and all of its subtasks from a plan.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'The ID of the plan' },
          taskId: { type: 'string', description: 'The ID of the task to delete' }
        },
        required: ['planId', 'taskId']
      },
      async execute({ planId, taskId }) {
        const plans = await loadPlans();
        const plan = plans.find(p => p.id === planId);
        if (!plan) return `Error: Plan with ID ${planId} not found.`;

        // Recursive function to find all subtasks
        const getSubtasks = (parentId: string): string[] => {
          const children = plan.tasks.filter(t => t.parentId === parentId).map(t => t.id);
          let all = [...children];
          for (const childId of children) {
            all = all.concat(getSubtasks(childId));
          }
          return all;
        };

        const toDelete = [taskId, ...getSubtasks(taskId)];
        plan.tasks = plan.tasks.filter(t => !toDelete.includes(t.id));
        
        await savePlans(plans);
        return `Successfully deleted task ${taskId} and its ${toDelete.length - 1} subtasks.`;
      }
    },
    {
      name: 'plan:assign',
      description: 'Assigns a specific agent to a task.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'The ID of the plan' },
          taskId: { type: 'string', description: 'The ID of the task' },
          agentId: { type: 'string', description: 'The ID of the agent to assign (e.g., coder, researcher)' }
        },
        required: ['planId', 'taskId', 'agentId']
      },
      async execute({ planId, taskId, agentId }) {
        const plans = await loadPlans();
        const plan = plans.find(p => p.id === planId);
        if (!plan) return `Error: Plan with ID ${planId} not found.`;

        const task = plan.tasks.find(t => t.id === taskId);
        if (!task) return `Error: Task ${taskId} not found.`;

        task.assignedAgent = agentId;
        task.updatedAt = Date.now();
        
        await savePlans(plans);
        return `Successfully assigned agent ${agentId} to task ${taskId}.`;
      }
    },
    {
      name: 'plan:dependencies',
      description: 'Sets the dependencies for a task (tasks that must be completed before this one).',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'The ID of the plan' },
          taskId: { type: 'string', description: 'The ID of the task' },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of task IDs this task depends on'
          }
        },
        required: ['planId', 'taskId', 'dependencies']
      },
      async execute({ planId, taskId, dependencies }) {
        const plans = await loadPlans();
        const plan = plans.find(p => p.id === planId);
        if (!plan) return `Error: Plan with ID ${planId} not found.`;

        const task = plan.tasks.find(t => t.id === taskId);
        if (!task) return `Error: Task ${taskId} not found.`;

        // Validate dependencies exist
        for (const depId of dependencies) {
          if (!plan.tasks.find(t => t.id === depId)) {
            return `Error: Dependency task ${depId} does not exist in the plan.`;
          }
        }

        task.dependencies = dependencies;
        task.updatedAt = Date.now();
        
        await savePlans(plans);
        return `Successfully updated dependencies for task ${taskId}.`;
      }
    },
    {
      name: 'plan:expand',
      description: 'Uses the LLM Task Decomposition Engine to automatically break down a task into subtasks.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'The ID of the plan' },
          taskId: { type: 'string', description: 'The ID of the task to decompose' }
        },
        required: ['planId', 'taskId']
      },
      async execute({ planId, taskId }) {
        if (!router) {
          return `Error: LLMRouter is not available. Cannot perform automatic decomposition.`;
        }

        const plans = await loadPlans();
        const plan = plans.find(p => p.id === planId);
        if (!plan) return `Error: Plan with ID ${planId} not found.`;

        const task = plan.tasks.find(t => t.id === taskId);
        if (!task) return `Error: Task ${taskId} not found.`;

        const prompt = `You are an expert Project Planner. Break down the following task into 3-5 subtasks.
Task Title: ${task.title}
Task Description: ${task.description}

Output ONLY a strict JSON array of objects. Do not include markdown code blocks, do not include any other text.
Each object must have exactly two string fields:
- "title": A short, clear title for the subtask
- "description": A slightly longer explanation of what needs to be done.`;

        try {
          const llmReq: LLMRequest = {
            prompt: prompt,
            model: '',
            systemPrompt: 'You are an AIOS internal component. Output raw JSON only.',
            priority: 1,
            taskType: 'REASONING'
          };

          const response = await router.generate(llmReq);
          let content = response.content.trim();
          
          // clean up if the LLM adds markdown wrappers
          if (content.startsWith('\`\`\`json')) {
             content = content.substring(7);
             if (content.endsWith('\`\`\`')) {
               content = content.substring(0, content.length - 3);
             }
          }

          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            throw new Error('LLM did not return an array');
          }

          const newTasks: Task[] = parsed.map(p => ({
            id: generateId(),
            title: p.title,
            description: p.description,
            status: 'pending',
            parentId: taskId,
            dependencies: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

          plan.tasks.push(...newTasks);
          await savePlans(plans);

          return `Successfully decomposed task ${taskId} into ${newTasks.length} subtasks.\n\nNew subtasks:\n${newTasks.map(t => '- [' + t.id + '] ' + t.title).join('\n')}`;
        } catch (e: any) {
          return `Error during task decomposition: ${e.message}`;
        }
      }
    }
  ];
}
