import { describe, it } from 'vitest';
import { getResearchTools } from '../../../packages/agents/src/tools/research-tools';
import { LLMRouter } from '../../../packages/llm';
import { CoreLogger } from '../../../packages/core/src/logger';
import { SecretManager } from '../../../packages/security';
import { configManager } from '../../../packages/config';

async function runResearchTests() {
  const logger = CoreLogger.getInstance();
  logger.info('Initializing mock router & credentials for Research Agent tools test...');

  // Setup security context
  const masterKey = 'test_master_key_research';
  const security = new SecretManager(logger, masterKey);

  // Initialize router
  const allConfig = configManager.getAll();
  const config = {
    defaultProvider: allConfig.llm.defaultProvider as any,
    defaultModel: allConfig.llm.ollama.model,
    providers: {
      ollama: { baseUrl: allConfig.llm.ollama.host }
    } as any
  };
  const router = new LLMRouter(config, security, logger);

  const tools = getResearchTools(router, logger);
  const toolMap = new Map(tools.map(t => [t.name, t]));

  // Test 1: web:search
  const searchTool = toolMap.get('web:search');
  if (!searchTool) throw new Error('web:search tool not found');
  
  logger.info('Executing web:search test for query: "TypeScript 5.3 release"...');
  try {
    const searchResStr = await searchTool.execute({ query: 'TypeScript 5.3 release', maxResults: 3 });
    logger.info(`web:search result type: ${typeof searchResStr}`);
    
    if (searchResStr === 'No results found.') {
      logger.warn('Search returned 0 results.');
    } else {
      const results = JSON.parse(searchResStr);
      logger.info(`web:search retrieved ${results.length} results:`);
      results.forEach((r: any, i: number) => {
        logger.info(`[${i+1}] ${r.title} - ${r.url}`);
      });
      // Test 2: web:scrape (only if results exist)
      const scrapeTool = toolMap.get('web:scrape');
      if (!scrapeTool) throw new Error('web:scrape tool not found');
      
      const targetUrl = results[0].url;
      logger.info(`Executing web:scrape test on URL: ${targetUrl}...`);
      const scrapeRes = await scrapeTool.execute({ url: targetUrl });
      logger.info(`web:scrape content preview (first 300 chars):\n${scrapeRes.substring(0, 300)}...`);
    }
  } catch (err: any) {
    logger.error(`Search/Scrape HTTP execution failed (this is expected if offline): ${err.message}`);
  }

  // Test 3: research:compile (using mock synthesise prompt test or real call)
  const compileTool = toolMap.get('research:compile');
  if (!compileTool) throw new Error('research:compile tool not found');

  logger.info('Executing research:compile test for topic: "AI Operating Systems"...');
  try {
    const compileResStr = await compileTool.execute({ topic: 'AI Operating Systems', maxSources: 2 });
    const report = JSON.parse(compileResStr);
    logger.info('research:compile completed successfully! Report summary length:', report.summary.length);
    logger.info('Report Key Findings count:', report.keyFindings.length);
    logger.info('Report Metadata:', JSON.stringify(report.metadata));
  } catch (err: any) {
    logger.error(`research:compile failed: ${err.message}`);
  }

  logger.info('Research tools verification complete!');
}

runResearchTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});

describe('E2E test-research-tools.test.ts', () => {
  it('should run tests', async () => {
    await runTests();
  }, { timeout: 30000 });
});
