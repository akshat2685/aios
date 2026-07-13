import { ipcMain, BrowserWindow, clipboard } from 'electron';
import { AIOSKernel } from '../kernel';
import { CoreLogger, TelemetryEngine } from '@aios/core';
import { ConfigManager } from '@aios/config';
import { SystemMonitor } from './system';

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
      return await kernel.memoryClient.search(options);
    } catch (e: any) {
      logger.error(`memory:search failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('memory:searchTyped', async (_, { type, query, limit }) => {
    try {
      // MemoryType might not be imported in ipc.ts, so we'll just cast or use string
      return await kernel.memory.searchTyped(type as any, query, limit);
    } catch (e: any) {
      logger.error(`memory:searchTyped failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('memory:save', async (_, { type, content, metadata }) => {
    try {
      return await kernel.memory.saveTypedMemory(type as any, content, metadata);
    } catch (e: any) {
      logger.error(`memory:save failed: ${e.message}`);
      return null;
    }
  });

  ipcMain.handle('memory:delete', async (_, { id }) => {
    try {
      await kernel.memoryClient.delete(id);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`memory:delete failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('memory:clear', async () => {
    try {
      await kernel.memoryClient.clear();
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`memory:clear failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('memory:stats', async () => {
    try {
      return await kernel.memoryClient.getStats();
    } catch (e: any) {
      logger.error(`memory:stats failed: ${e.message}`);
      return { points: 0, vectors: 0, status: 'unreachable' };
    }
  });

  // ─── 3. Graph Service Operations ─────────────────────────
  ipcMain.handle('graph:getProjects', async () => {
    try {
      return await kernel.graph.getProjects();
    } catch (e: any) {
      logger.error(`graph:getProjects failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('graph:createProject', async (_, { name, description }) => {
    try {
      return await kernel.graph.createProject(name, description);
    } catch (e: any) {
      logger.error(`graph:createProject failed: ${e.message}`);
      return null;
    }
  });

  ipcMain.handle('graph:deleteProject', async (_, { id }) => {
    try {
      await kernel.graph.deleteProject(id);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`graph:deleteProject failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('graph:getTasks', async (_, { projectId }) => {
    try {
      return await kernel.graph.getTasksForProject(projectId);
    } catch (e: any) {
      logger.error(`graph:getTasks failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('graph:createTask', async (_, { projectId, title, description, priority }) => {
    try {
      return await kernel.graph.createTask(projectId, title, description, priority);
    } catch (e: any) {
      logger.error(`graph:createTask failed: ${e.message}`);
      return null;
    }
  });

  ipcMain.handle('graph:updateTaskStatus', async (_, { id, status }) => {
    try {
      await kernel.graph.updateTaskStatus(id, status);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`graph:updateTaskStatus failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('graph:deleteTask', async (_, { id }) => {
    try {
      await kernel.graph.deleteTask(id);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`graph:deleteTask failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  // ─── 4. Agent and Chat operations ─────────────────────────
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

  ipcMain.handle('agent:chat-stream', async (event, { message, agentId, conversationId, history = [] }) => {
    try {
      logger.info(`Routing chat stream to agent ${agentId || 'assistant'} for conversation ${conversationId}`);
      
      // We pass the incoming history (from the UI) so the agent has full context
      const mappedHistory = history.map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || Date.now()
      }));

      // In the background, run the full agent reasoning + tool loop
      // We don't stream intermediate tool outputs to UI yet, but we will send the final answer via IPC events.
      // A more advanced implementation could stream thoughts/tool calls!
      kernel.agents.routeRequest(agentId || 'assistant', {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      }, mappedHistory).then((response) => {
        // We simulate streaming the final response back to the UI chunk by chunk
        const chunkSize = 15;
        let index = 0;
        
        function sendNextChunk() {
          if (index < response.message.length) {
            const chunk = response.message.substring(index, index + chunkSize);
            event.sender.send('llm:stream-chunk', conversationId, chunk);
            index += chunkSize;
            setTimeout(sendNextChunk, 10);
          } else {
            event.sender.send('llm:stream-end', conversationId);
          }
        }
        
        sendNextChunk();
      }).catch((e: any) => {
        event.sender.send('llm:stream-error', conversationId, e.message);
      });

    } catch (e: any) {
      logger.error(`agent:chat-stream failed: ${e.message}`);
      event.sender.send('llm:stream-error', conversationId, e.message);
    }
  });

  // ─── 5. LLM operations ────────────────────────────────────
  const activeStreams = new Map<string, boolean>();

  ipcMain.handle('llm:health', async () => {
    try {
      return await kernel.router.checkAllHealth();
    } catch (e: any) {
      logger.error(`llm:health failed: ${e.message}`);
      return { ollama: { status: 'unhealthy', error: e.message } };
    }
  });

  ipcMain.handle('llm:states', async () => {
    try {
      return kernel.router.getProviderStates();
    } catch (e: any) {
      logger.error(`llm:states failed: ${e.message}`);
      return {};
    }
  });

  ipcMain.handle('llm:tracker:stats', async () => {
    try {
      return kernel.router.tracker.getStats();
    } catch (e: any) {
      logger.error(`llm:tracker:stats failed: ${e.message}`);
      return {};
    }
  });

  ipcMain.handle('llm:cache:stats', async () => {
    try {
      return (kernel.router as any).cache?.stats;
    } catch (e: any) {
      logger.error(`llm:cache:stats failed: ${e.message}`);
      return null;
    }
  });

  ipcMain.handle('llm:models', async (_, providerId: string) => {
    try {
      const providers = (kernel.router as any).providers;
      const targetProvider = providers?.get(providerId || 'ollama');
      if (targetProvider && typeof targetProvider.getSupportedModels === 'function') {
        return await targetProvider.getSupportedModels();
      }
      return [];
    } catch (e: any) {
      logger.error(`llm:models failed for ${providerId}: ${e.message}`);
      return [];
    }
  });

  // ─── Router Diagnostics ──────────────────────────────────
  ipcMain.handle('llm:diagnostics', async () => {
    try {
      return kernel.router.getDiagnostics();
    } catch (e: any) {
      logger.error(`llm:diagnostics failed: ${e.message}`);
      return { providerHealth: {}, availableModels: [], routingHistory: [], cooldowns: {} };
    }
  });

  ipcMain.handle('llm:config:get', async () => {
    try {
      const allConfig = ConfigManager.getAll();
      return allConfig.llm;
    } catch (e: any) {
      logger.error(`llm:config:get failed: ${e.message}`);
      return {};
    }
  });

  ipcMain.handle('llm:config:set', async (_, key: string, value: any) => {
    try {
      ConfigManager.set(`llm.${key}`, value);
      ConfigManager.save();
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:config:set failed for ${key}: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:disable-provider', async (_, providerId: string) => {
    try {
      kernel.router.disableProvider(providerId as any);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:disable-provider failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:enable-provider', async (_, providerId: string) => {
    try {
      kernel.router.enableProvider(providerId as any);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:enable-provider failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:disable-model', async (_, modelId: string) => {
    try {
      kernel.router.disableModel(modelId);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:disable-model failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:set-routing-profile', async (_, profile: string) => {
    try {
      kernel.router.setRoutingProfile(profile as any);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:set-routing-profile failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:set-cloud-mode', async (_, mode: string) => {
    try {
      kernel.router.setCloudMode(mode as any);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:set-cloud-mode failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:set-routing-mode', async (_, mode: string) => {
    try {
      kernel.router.setRoutingMode(mode as any);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:set-routing-mode failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:set-user-preferences', async (_, prefs: any) => {
    try {
      kernel.router.setUserPreferences(prefs);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:set-user-preferences failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:discover-models', async () => {
    try {
      const providers = (kernel.router as any).providers;
      return await (kernel.router as any).registry.discoverModels(providers);
    } catch (e: any) {
      logger.error(`llm:discover-models failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('llm:local-models', async () => {
    try {
      return (kernel.router as any).registry.getLocalModels();
    } catch (e: any) {
      logger.error(`llm:local-models failed: ${e.message}`);
      return { general: [], coding: [] };
    }
  });

  ipcMain.handle('llm:keys:set', async (_, { provider, key }) => {
    try {
      if (Array.isArray(key)) {
        // Delete existing pool first (simple approach: delete up to 20 keys)
        for (let i = 1; i <= 20; i++) {
          try { await kernel.security.deleteSecret(`${provider}_api_key_${i}`); } catch (e) {}
        }
        // Save new pool
        for (let i = 0; i < key.length; i++) {
          await kernel.security.storeSecret(`${provider}_api_key_${i + 1}`, key[i], provider);
        }
        // Save base key for backward compatibility
        if (key.length > 0) {
          await kernel.security.storeSecret(`${provider}_api_key`, key[0], provider);
        }
      } else {
        await kernel.security.storeSecret(`${provider}_api_key`, key, provider);
        await kernel.security.storeSecret(`${provider}_api_key_1`, key, provider);
      }
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:keys:set failed for ${provider}: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:keys:get', async (_, provider) => {
    try {
      const keys = await kernel.security.getSecretPool(`${provider}_api_key`);
      return { isSet: keys.length > 0, count: keys.length };
    } catch (e: any) {
      logger.error(`llm:keys:get failed for ${provider}: ${e.message}`);
      return { isSet: false, count: 0 };
    }
  });

  ipcMain.handle('llm:keys:delete', async (_, provider) => {
    try {
      await kernel.security.deleteSecret(`${provider}_api_key`);
      for (let i = 1; i <= 20; i++) {
        try { await kernel.security.deleteSecret(`${provider}_api_key_${i}`); } catch (e) {}
      }
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`llm:keys:delete failed for ${provider}: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('llm:stream', async (event, { prompt, model, systemPrompt, conversationId, taskType, agentId }) => {
    try {
      logger.info(`Starting LLM stream for conversation ${conversationId}`);
      activeStreams.set(conversationId, true);

      const generator = await kernel.router.stream({
        prompt,
        model: model || '',
        systemPrompt,
        taskType: taskType || 'chat',
        agentId: agentId || 'user',
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

  // ─── 6. Research operations ───────────────────────────────
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

  // ─── 7. System operations ─────────────────────────────────
  ipcMain.handle('system:status', async () => {
    try {
      const health = await kernel.router.checkAllHealth();
      const memStats = await kernel.memoryClient.getStats();
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

  // ─── 8. Window controls ───────────────────────────────────
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

  ipcMain.handle('clipboard:read', async () => {
    try {
      const text = clipboard.readText();
      return { status: 'success', text };
    } catch (e: any) {
      logger.error(`clipboard:read failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
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
      const token = process.env.AIOS_IPC_SECRET || '';
      const response = await fetch('http://127.0.0.1:8765/agents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
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

  // ─── 9. Workflow / Automation Engine ───────────────────────
  ipcMain.handle('workflow:list', async () => {
    try {
      return kernel.automation.getWorkflows();
    } catch (e: any) {
      logger.error(`workflow:list failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('workflow:save', async (_, workflow: any) => {
    try {
      await kernel.automation.registerWorkflow(workflow);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`workflow:save failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('workflow:delete', async (_, { id }) => {
    try {
      await kernel.automation.deleteWorkflow(id);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`workflow:delete failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('workflow:trigger', async (_, { eventName, payload }) => {
    try {
      await kernel.automation.triggerEvent(eventName, payload);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`workflow:trigger failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  // ─── 10. Telemetry & System Monitoring ───────────────────────
  ipcMain.handle('telemetry:logs', async (_, { limit, type }) => {
    try {
      const engine = TelemetryEngine.getInstance();
      return engine.getRecentEvents(limit, type);
    } catch (e: any) {
      logger.error(`telemetry:logs failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('telemetry:clear', async () => {
    try {
      const engine = TelemetryEngine.getInstance();
      engine.clearLogs();
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`telemetry:clear failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('system:metrics', async () => {
    try {
      return SystemMonitor.getSystemMetrics();
    } catch (e: any) {
      logger.error(`system:metrics failed: ${e.message}`);
      return null;
    }
  });

  ipcMain.handle('system:ollama:models', async () => {
    try {
      return await SystemMonitor.getOllamaModels();
    } catch (e: any) {
      logger.error(`system:ollama:models failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('system:ollama:ps', async () => {
    try {
      return await SystemMonitor.getOllamaPs();
    } catch (e: any) {
      logger.error(`system:ollama:ps failed: ${e.message}`);
      return [];
    }
  });

  // ─── 11. Security GuardRails ───────────────────────────────
  ipcMain.handle('security:get-rules', async () => {
    try {
      return {
        persistent: kernel.guardRail.getPersistentRules(),
        session: kernel.guardRail.getSessionRules()
      };
    } catch (e: any) {
      logger.error(`security:get-rules failed: ${e.message}`);
      return { persistent: [], session: [] };
    }
  });

  ipcMain.handle('security:delete-rule', async (_, { id, type }) => {
    try {
      if (type === 'session') {
        return await kernel.guardRail.deleteSessionRule(id);
      } else {
        return await kernel.guardRail.deletePersistentRule(id);
      }
    } catch (e: any) {
      logger.error(`security:delete-rule failed: ${e.message}`);
      return false;
    }
  });

  ipcMain.handle('security:get-audit-logs', async (_, { limit }) => {
    try {
      return await kernel.guardRail.getAuditLogs(limit || 100);
    } catch (e: any) {
      logger.error(`security:get-audit-logs failed: ${e.message}`);
      return [];
    }
  });

  // ─── 12. Plugin Management ─────────────────────────────────
  ipcMain.handle('plugins:list', async () => {
    try {
      const plugins = kernel.plugins.getPlugins();
      return plugins.map(p => ({
        manifest: p.manifest,
        status: 'running', // Eventually implement enabled/disabled state
      }));
    } catch (e: any) {
      logger.error(`plugins:list failed: ${e.message}`);
      return [];
    }
  });

  ipcMain.handle('plugins:uninstall', async (_, { id }) => {
    try {
      await kernel.plugins.unloadPlugin(id);
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`plugins:uninstall failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  // Automation extensions
  ipcMain.handle('automation:triggers', async () => {
    // Expose active triggers if added to automation engine
    return []; // Placeholder until trigger list is fully exposed
  });

  // ─── 13. Phase 10 Spencer / Voice & Offline AI IPC ──────────
  ipcMain.handle('voice:record-start', async () => {
    try {
      logger.info('IPC: Voice record starting');
      return { status: 'success' };
    } catch (e: any) {
      logger.error(`voice:record-start failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('voice:record-stop', async () => {
    try {
      logger.info('IPC: Voice record stopped');
      return { status: 'success', text: 'What is machine learning?' };
    } catch (e: any) {
      logger.error(`voice:record-stop failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('voice:synthesize', async (_, { text }) => {
    try {
      logger.info(`IPC: Voice synthesize request for: ${text}`);
      return { status: 'success', durationMs: 450 };
    } catch (e: any) {
      logger.error(`voice:synthesize failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('sandbox:create', async (_, { name, task }) => {
    try {
      logger.info(`IPC: Sandbox create: ${name}`);
      return { status: 'success', id: 'sandbox-' + Math.random().toString(36).substring(7) };
    } catch (e: any) {
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('sandbox:execute', async (_, { id, command }) => {
    try {
      logger.info(`IPC: Sandbox execute: ${command} on ${id}`);
      return { status: 'success', exitCode: 0, stdout: 'Command passed.', stderr: '' };
    } catch (e: any) {
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('sandbox:promote', async (_, { id }) => {
    try {
      logger.info(`IPC: Sandbox promote: ${id}`);
      return { status: 'success', appliedFiles: 3 };
    } catch (e: any) {
      return { status: 'error', error: e.message };
    }
  });

  ipcMain.handle('twin:getProfile', async () => {
    try {
      return {
        codingStyle: {
          indentation: 'spaces-2',
          namingConvention: 'camelCase',
          commentDensity: 0.35,
          preferredLanguages: ['TypeScript', 'Python'],
          typeStrictness: 'strict',
          complexityPreference: 'moderate'
        },
        tone: {
          formality: 0.4,
          verbosity: 0.55,
          technicalDepth: 0.8
        },
        confidence: 0.42,
        observations: 42
      };
    } catch (e: any) {
      return null;
    }
  });

  ipcMain.handle('federation:getPeers', async () => {
    return [
      { id: 'peer-1', displayName: 'AIOS-Laptop', status: 'online', latencyMs: 15 },
      { id: 'peer-2', displayName: 'AIOS-Workstation', status: 'offline', latencyMs: 0 }
    ];
  });

  ipcMain.handle('graph-viz:getSnapshot', async () => {
    return {
      nodes: [
        { id: 'n1', type: 'agent', label: 'Spencer', x: 0, y: 0, weight: 1.5, createdAt: Date.now(), lastAccessedAt: Date.now() },
        { id: 'n2', type: 'memory', label: 'User Preference', x: 100, y: 50, weight: 1.0, createdAt: Date.now(), lastAccessedAt: Date.now() }
      ],
      edges: [
        { id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'REFERENCES', weight: 1.0, confidence: 0.95 }
      ],
      layout: { algorithm: 'force-directed', positions: {}, clusters: [], computedAt: Date.now() },
      stats: { totalNodes: 2, totalEdges: 1, clusterCount: 1, averageDegree: 1, density: 0.5 }
    };
  });
}
