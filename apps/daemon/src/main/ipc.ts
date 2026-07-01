import { ipcMain, BrowserWindow } from 'electron';
import { AIOSKernel } from '../kernel';
import { CoreLogger } from '@aios/core';
import { ConfigManager } from '@aios/config';

export function setupIPC(kernel: AIOSKernel, logger: CoreLogger) {
  // ─── 1. Config management ──────────────────────────────────
  ipcMain.handle('config:get', async (_, key: string, defaultValue?: any) => {
    try {
      return ConfigManager.get(key, defaultValue);
    } catch (e: any) {
      logger.error(`config:get failed for key ${key}: ${e.message}`);
      return defaultValue;
    }
  });

  ipcMain.handle('config:set', async (_, key: string, value: any) => {
    try {
      ConfigManager.set(key, value);
      ConfigManager.save();
    } catch (e: any) {
      logger.error(`config:set failed for key ${key}: ${e.message}`);
    }
  });

  // ─── 2. Memory service operations ─────────────────────────
  ipcMain.handle('memory:search', async (_, options: any) => {
    try {
      return await kernel.memory.searchMemory(options);
    } catch (e: any) {
      logger.error(`memory:search failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('memory:clear', async () => {
    try {
      await kernel.memory.clear();
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`memory:clear failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('memory:stats', async () => {
    try {
      return await kernel.memory.getStats();
    } catch (e: any) {
      logger.error(`memory:stats failed: ${e.message}`);
      return { points: 0, vectors: 0, status: 'unreachable' };
    }
  });

  // ─── 3. Agent and Chat operations ─────────────────────────
  ipcMain.handle('agent:chat', async (_, { message, agentId }) => {
    try {
      logger.info(`Routing chat request to agent ${agentId || 'assistant'}`);
      const response = await kernel.agents.routeRequest(agentId || 'assistant', {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });
      return response;
    } catch (e: any) {
      logger.error(`agent:chat failed: ${e.message}`);
      return {
        message: `Error: ${e.message}`,
        done: true,
      };
    }
  });

  // ─── 4. LLM operations ────────────────────────────────────
  const activeStreams = new Map<string, boolean>();

  ipcMain.handle('llm:health', async () => {
    try {
      return await kernel.router.checkAllHealth();
    } catch (e: any) {
      logger.error(`llm:health failed: ${e.message}`);
      return { ollama: { status: 'unhealthy', error: e.message } };
    }
  });

  ipcMain.handle('llm:models', async () => {
    try {
      const providers = (kernel.router as any).providers;
      const ollamaProvider = providers?.get('ollama');
      if (ollamaProvider && typeof ollamaProvider.getSupportedModels === 'function') {
        return await ollamaProvider.getSupportedModels();
      }
      return [];
    } catch (e: any) {
      logger.error(`llm:models failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('llm:keys:set', async (_, { provider, key }) => {
    try {
      await kernel.security.storeSecret(`${provider}_api_key`, key, provider);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:keys:set failed for ${provider}: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:keys:get', async (_, provider) => {
    try {
      const value = await kernel.security.getSecret(`${provider}_api_key`);
      return { isSet: !!value };
    } catch (e: any) {
      logger.error(`llm:keys:get failed for ${provider}: ${e.message}`);
      return { isSet: false };
    }
  });

  ipcMain.handle('llm:keys:delete', async (_, provider) => {
    try {
      await kernel.security.deleteSecret(`${provider}_api_key`);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:keys:delete failed for ${provider}: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:stream', async (event, { prompt, model, systemPrompt, conversationId }) => {
    try {
      logger.info(`Starting LLM stream for conversation ${conversationId}`);
      activeStreams.set(conversationId, true);

      const generator = await kernel.router.stream({
        prompt,
        model: model || 'qwen2.5:8b',
        systemPrompt,
      });

      for await (const chunk of generator) {
        if (!activeStreams.get(conversationId)) {
          logger.info(`Stream aborted for conversation ${conversationId}`);
          break;
        }
        event.sender.send('llm:stream-chunk', conversationId, chunk.chunk);
        if (chunk.done) {
          event.sender.send('llm:stream-end', conversationId);
        }
      }
      activeStreams.delete(conversationId);
    } catch (e: any) {
      logger.error(`llm:stream failed: ${e.message}`);
      event.sender.send('llm:stream-error', conversationId, e.message);
      activeStreams.delete(conversationId);
    }
  });

  ipcMain.handle('llm:stopStream', async (_, conversationId) => {
    activeStreams.set(conversationId, false);
    return { status: 'stopped' };
  });

  // ─── 5. Research operations ───────────────────────────────
  ipcMain.handle('research:conduct', async (_, { query }) => {
    try {
      logger.info(`Starting research for query: ${query}`);
      const report = await kernel.research.conductResearch({
        query,
        maxSources: 4,
        depth: 'shallow',
        includePapers: false,
        includeWeb: true,
      });
      return report;
    } catch (e: any) {
      logger.error(`research:conduct failed: ${e.message}`);
      return {
        topic: query,
        summary: `Research process failed: ${e.message}`,
        keyFindings: [],
        suggestedFurtherReading: [],
        metadata: {
          startTime: Date.now(),
          endTime: Date.now(),
          sourcesAnalyzed: 0,
        },
      };
    }
  });

  // ─── 6. System operations ─────────────────────────────────
  ipcMain.handle('system:status', async () => {
    try {
      const health = await kernel.router.checkAllHealth();
      const memStats = await kernel.memory.getStats();
      return {
        version: '0.1.0',
        uptime: process.uptime(),
        ollamaStatus: health.ollama?.status || 'unknown',
        memoryStatus: memStats.status || 'unknown',
      };
    } catch (e: any) {
      return {
        version: '0.1.0',
        uptime: process.uptime(),
        ollamaStatus: 'error',
        memoryStatus: 'error',
      };
    }
  });

  // ─── 7. Window controls ───────────────────────────────────
  ipcMain.handle('app:quit', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) win.close();
  });

  ipcMain.handle('app:minimize', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) win.minimize();
  });

  ipcMain.handle('app:hide', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) win.hide();
  });

  ipcMain.handle('app:show', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.show();
  });

  ipcMain.handle('app:restart', () => {
    const { app } = require('electron');
    app.relaunch();
    app.exit(0);
  });

  // ─── 8. ADK Agent Launcher ─────────────────────────────────
  const adkAgents = [
    { name: 'planner', description: 'Break tasks into structured work items and route them to specialists.', capabilities: ['planning', 'decomposition', 'coordination'], icon: '🧠' },
    { name: 'research', description: 'Gather sources and synthesize findings.', capabilities: ['search', 'summarization', 'source_validation'], icon: '🔍' },
    { name: 'coding', description: 'Generate, refactor, debug, and explain code.', capabilities: ['code_generation', 'refactoring', 'debugging'], icon: '💻' },
    { name: 'website', description: 'Build frontend, backend, API, and database work items.', capabilities: ['frontend', 'backend', 'api_design', 'database_design'], icon: '🌐' },
    { name: 'testing', description: 'Create and interpret unit, integration, and end-to-end tests.', capabilities: ['unit_tests', 'integration_tests', 'e2e_tests'], icon: '🧪' },
    { name: 'security', description: 'Review dependencies, static analysis findings, and secret risks.', capabilities: ['dependency_scanning', 'static_analysis', 'secret_detection'], icon: '🛡️' },
    { name: 'docs', description: 'Produce architecture, API, and user-facing documentation.', capabilities: ['readme', 'architecture_docs', 'api_docs'], icon: '📝' },
  ];

  ipcMain.handle('adk:list-agents', async () => {
    try {
      const response = await fetch('http://127.0.0.1:8765/agents');
      const data: any = await response.json();
      return {
        agents: data.agents.map((a: any, i: number) => ({
          ...a,
          icon: adkAgents[i]?.icon || '🤖',
        })),
      };
    } catch {
      return { agents: adkAgents };
    }
  });

  ipcMain.handle('agent:launch', async (_, { agentId }: { agentId: string }) => {
    logger.info(`Launching agent: ${agentId}`);

    // Hide the launcher window
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      if (win.isAlwaysOnTop()) {
        win.hide();
      }
    }

    // Show & focus the main window, send the agent ID to renderer
    const main = allWindows.find((w) => !w.isAlwaysOnTop() && !w.isDestroyed());
    if (main) {
      main.show();
      main.focus();
      main.webContents.send('agent:launch', agentId);
    }

    return { status: 'launched', agentId };
  });

  ipcMain.handle('launcher:hide', async () => {
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      if (win.isAlwaysOnTop()) {
        win.hide();
      }
    }
  });
}
