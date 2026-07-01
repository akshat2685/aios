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
}
