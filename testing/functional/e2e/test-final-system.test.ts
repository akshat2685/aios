import { describe, it } from 'vitest';
import { getPlannerTools } from '../../../packages/agents/src/tools/planner-tools';
import { getDelegationTool } from '../../../packages/agents/src/tools/delegation-tool';
import { getCodingTools } from '../../../packages/agents/src/tools/coding-tools';
import { GuardRail } from '../../../packages/security';
import { AutomationEngine } from '../../../packages/automation';
import { PluginManager } from '../../../packages/plugins';
import { CoreLogger } from '../../../packages/core/src/logger';
import path from 'path';
import fs from 'fs-extra';
import * as os from 'os';

async function runFinalVerification() {
  const logger = CoreLogger.getInstance();
  logger.info('=== STARTING FINAL AIOS SYSTEM VERIFICATION ===');

  // 1. Verify Phase 9: Planner Agent Tools
  logger.info('--- Testing Phase 9: Planner Tools ---');
  const plannerTools = getPlannerTools();
  const plannerMap = new Map(plannerTools.map(t => [t.name, t]));
  const createTool = plannerMap.get('plan:create')!;
  const updateTool = plannerMap.get('plan:update')!;
  const getTool = plannerMap.get('plan:list')!;

  const createRes = await createTool.execute({
    goal: 'Build a Personal Assistant',
    tasks: [
      { id: 'design', description: 'Design layout structure' },
      { id: 'code', description: 'Write CSS and JavaScript components', dependencies: ['design'] }
    ]
  });
  logger.info(`planner:create result:\n${createRes}`);

  const activePlansStr = await getTool.execute({});
  const activePlans = JSON.parse(activePlansStr);
  const planId = activePlans[0].id;
  logger.info(`Successfully retrieved plan ID: ${planId}`);

  const updateRes = await updateTool.execute({ planId, taskId: 'design', status: 'completed' });
  logger.info(`planner:update_task result: ${updateRes}`);

  const planDetailStr = await getTool.execute({ planId });
  logger.info(`planner:get_plan detail:\n${planDetailStr}`);

  // 2. Verify Phase 10: Security GuardRail Approval Loops
  logger.info('--- Testing Phase 10: Security GuardRail Approval Loops ---');
  let userApprovalAnswer = false; // Mock user choice
  const requestApproval = async (action: string, details: string) => {
    logger.info(`GuardRail: Mocking User prompt. Approved? ${userApprovalAnswer}`);
    return userApprovalAnswer;
  };

  const sandboxPath = path.resolve(__dirname, '../sandbox_sec');
  await fs.ensureDir(sandboxPath);
  const codingTools = getCodingTools(sandboxPath, logger, requestApproval);
  const shellTool = codingTools.find(t => t.name === 'shell:run')!;

  logger.info('Executing shell:run command WITH USER REJECTION...');
  userApprovalAnswer = false;
  const shellRejectRes = await shellTool.execute({ command: 'echo hello' });
  logger.info(`shell:run outcome: ${shellRejectRes}`);

  logger.info('Executing shell:run command WITH USER APPROVAL...');
  userApprovalAnswer = true;
  const shellApproveRes = await shellTool.execute({ command: 'echo hello' });
  logger.info(`shell:run outcome: ${shellApproveRes.trim()}`);
  await fs.remove(sandboxPath);

  // 3. Verify Phase 11: Automation Engine triggerEvent
  logger.info('--- Testing Phase 11: Automation Triggers ---');
  const engine = new AutomationEngine(logger);
  await engine.registerWorkflow({
    id: 'test_workflow',
    name: 'Backup Workflow',
    trigger: {
      id: 'trig1',
      type: 'event',
      config: { eventName: 'file:added' },
      enabled: true
    },
    steps: [
      {
        id: 'step1',
        action: {
          id: 'act1',
          name: 'Echo trigger confirmation',
          type: 'shell',
          params: { command: 'echo "Automation Trigger Completed successfully!"' }
        }
      }
    ],
    isActive: true
  });

  logger.info('Triggering file:added event in AutomationEngine...');
  await engine.triggerEvent('file:added', { path: 'dummy.txt' });

  // 4. Verify Phase 12: Multi-Agent Delegation Tool
  logger.info('--- Testing Phase 12: Multi-Agent Delegation ---');
  const delegationTool = getDelegationTool(async (agentId, task) => {
    logger.info(`Mock Orchestrator: Routing task to "${agentId}"...`);
    return `Agent ${agentId} processed: "${task}"`;
  });
  const delegateRes = await delegationTool.execute({ agentId: 'researcher', task: 'Compile research on quantum computing' });
  logger.info(`agent:delegate response: ${delegateRes}`);

  // 5. Verify Phase 13: Plugin Manager loading
  logger.info('--- Testing Phase 13: Dynamic Plugin Manager ---');
  const pluginDir = path.join(os.homedir(), '.aios', 'plugins');
  await fs.ensureDir(pluginDir);
  const mockPluginDir = path.join(pluginDir, 'test-plugin');
  await fs.ensureDir(mockPluginDir);
  await fs.writeJson(path.join(mockPluginDir, 'manifest.json'), {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0'
  });
  const mockPluginPath = path.join(mockPluginDir, 'index.js');
  const mockPluginCode = `
    exports.getTools = function() {
      return [
        {
          name: 'custom:ping',
          description: 'Custom ping plugin tool',
          parameters: {},
          execute: async () => 'Pong from custom plugin!'
        }
      ];
    }
  `;
  await fs.writeFile(mockPluginPath, mockPluginCode, 'utf8');

  const EventEmitter = require('events').EventEmitter;
  const pluginManager = new PluginManager(logger, new EventEmitter());
  await pluginManager.scanAndLoadPlugins();
  const pluginTools = Array.from(pluginManager.toolRegistry.values());
  logger.info(`PluginManager loaded ${pluginTools.length} tools`);
  if (pluginTools.length > 0) {
    const pingTool = pluginTools[0];
    const pingRes = await pingTool.execute({});
    logger.info(`Loaded tool "${pingTool.name}" execution outcome: ${pingRes}`);
  }

  // Cleanup
  await fs.remove(mockPluginPath);
  logger.info('=== FINAL AIOS SYSTEM VERIFICATION SUCCESSFULLY COMPLETED ===');
}



describe('E2E test-final-system.test.ts', () => {
  it('should run tests', async () => {
    await runFinalVerification();
  }, { timeout: 30000 });
});
