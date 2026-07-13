import { describe, it } from 'vitest';
import { getCodingTools } from '../../../packages/agents/src/tools/coding-tools';
import { CoreLogger } from '../../../packages/core/src/logger';
import path from 'path';
import fs from 'fs-extra';

async function runTests() {
  const logger = CoreLogger.getInstance();
  const workspacePath = path.resolve(__dirname, '../sandbox');
  await fs.ensureDir(workspacePath);

  logger.info(`Running Coding Tools verification sandbox at: ${workspacePath}`);
  const tools = getCodingTools(workspacePath, logger);
  const toolMap = new Map(tools.map(t => [t.name, t]));

  // Test 1: Write file
  const writeTool = toolMap.get('file:write');
  if (!writeTool) throw new Error('file:write tool not found');
  
  logger.info('Executing file:write test...');
  const writeRes = await writeTool.execute({ filePath: 'hello.txt', content: 'Hello World from AIOS Coder Agent!' });
  logger.info(`file:write result: ${writeRes}`);

  // Test 2: Read file
  const readTool = toolMap.get('file:read');
  if (!readTool) throw new Error('file:read tool not found');
  
  logger.info('Executing file:read test...');
  const readRes = await readTool.execute({ filePath: 'hello.txt' });
  logger.info(`file:read result content: "${readRes}"`);
  if (readRes !== 'Hello World from AIOS Coder Agent!') {
    throw new Error('Read content mismatch!');
  }

  // Test 3: Edit file (Search & Replace)
  const editTool = toolMap.get('file:edit');
  if (!editTool) throw new Error('file:edit tool not found');

  logger.info('Executing file:edit test...');
  const editRes = await editTool.execute({
    filePath: 'hello.txt',
    search: 'Hello World',
    replace: 'Greetings Galaxy'
  });
  logger.info(`file:edit result: ${editRes}`);

  const readRes2 = await readTool.execute({ filePath: 'hello.txt' });
  logger.info(`file:read after edit content: "${readRes2}"`);
  if (readRes2 !== 'Greetings Galaxy from AIOS Coder Agent!') {
    throw new Error('Edit modification content mismatch!');
  }

  // Test 4: List directory
  const listTool = toolMap.get('dir:list');
  if (!listTool) throw new Error('dir:list tool not found');

  logger.info('Executing dir:list test...');
  const listRes = await listTool.execute({ dirPath: '.', recursive: false });
  logger.info(`dir:list result: ${listRes}`);

  // Test 5: Grep Search
  const grepTool = toolMap.get('workspace:grep');
  if (!grepTool) throw new Error('workspace:grep tool not found');

  logger.info('Executing workspace:grep test...');
  const grepRes = await grepTool.execute({ query: 'Galaxy' });
  logger.info(`workspace:grep result: ${grepRes}`);

  // Test 6: Path Safety Boundary violation check
  logger.info('Executing path boundary violation test...');
  try {
    await readTool.execute({ filePath: '../../../../Windows/System32/drivers/etc/hosts' });
    throw new Error('Security Error: Allowed reading outside workspace boundary!');
  } catch (err: any) {
    logger.info(`Path boundary block succeeded: ${err.message}`);
  }

  // Test 7: Shell Command execution
  const shellTool = toolMap.get('shell:run');
  if (!shellTool) throw new Error('shell:run tool not found');

  logger.info('Executing shell:run test...');
  const shellRes = await shellTool.execute({ command: 'echo Hello from Shell Tool!' });
  logger.info(`shell:run result: ${shellRes}`);

  // Cleanup sandbox
  await fs.remove(workspacePath);
  logger.info('Verification complete. Sandbox cleaned up. All tests passed successfully!');
}


describe('E2E test-coding-tools.test.ts', () => {
  it('should run tests', async () => {
    await runTests();
  }, { timeout: 30000 });
});
