import fs from 'fs-extra';
import path from 'path';
import * as os from 'os';
import chokidar from 'chokidar';
import { CoreLogger } from '@aios/core';
import { AIOSPlugin, AgentTool, Workflow, PluginAPI, PluginStorage, PluginLogger, PluginEventBus } from '@aios/types';
import { EventEmitter } from 'events';

export class PluginManager {
  private logger: CoreLogger;
  private globalEventBus: EventEmitter;
  private pluginsDir: string;
  private dataDir: string;
  
  // Registries
  private loadedPlugins: Map<string, AIOSPlugin> = new Map();
  public toolRegistry: Map<string, AgentTool> = new Map();
  public actionRegistry: Map<string, any> = new Map();
  public workflowRegistry: Map<string, Workflow> = new Map();
  
  private watcher?: chokidar.FSWatcher;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(logger: CoreLogger, globalEventBus: EventEmitter) {
    this.logger = logger;
    this.globalEventBus = globalEventBus;
    this.pluginsDir = path.join(os.homedir(), '.aios', 'plugins');
    this.dataDir = path.join(os.homedir(), '.aios', 'plugins-data');
  }

  async init() {
    this.logger.info(`Initializing PluginManager...`);
    await fs.ensureDir(this.pluginsDir);
    await fs.ensureDir(this.dataDir);

    await this.scanAndLoadPlugins();
    this.setupHotReload();
  }

  private setupHotReload() {
    this.logger.info(`Watching ${this.pluginsDir} for hot-reloading...`);
    this.watcher = chokidar.watch(this.pluginsDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      depth: 2, // watch top-level folders and their direct children (index.js, manifest.json)
      ignoreInitial: true,
    });

    const handleEvent = (filePath: string) => {
      // Find which plugin folder changed
      const relative = path.relative(this.pluginsDir, filePath);
      const pluginId = relative.split(path.sep)[0];
      
      if (!pluginId || pluginId === relative) return; // Ignore root level files

      const timer = this.debounceTimers.get(pluginId);
      if (timer) clearTimeout(timer);

      this.debounceTimers.set(pluginId, setTimeout(() => {
        this.debounceTimers.delete(pluginId);
        this.reloadPlugin(pluginId).catch(e => {
          this.logger.error(`Hot-reload failed for ${pluginId}: ${e.message}`);
        });
      }, 500));
    };

    this.watcher.on('add', handleEvent);
    this.watcher.on('change', handleEvent);
    this.watcher.on('unlink', handleEvent);
  }

  private createPluginAPI(pluginId: string): PluginAPI {
    const pluginDataDir = path.join(this.dataDir, pluginId);
    fs.ensureDirSync(pluginDataDir);

    const storage: PluginStorage = {
      async get(key: string) {
        const file = path.join(pluginDataDir, `${key}.json`);
        if (await fs.pathExists(file)) return await fs.readJson(file);
        return null;
      },
      async set(key: string, value: any) {
        const file = path.join(pluginDataDir, `${key}.json`);
        await fs.writeJson(file, value, { spaces: 2 });
      },
      async delete(key: string) {
        const file = path.join(pluginDataDir, `${key}.json`);
        if (await fs.pathExists(file)) await fs.remove(file);
      },
      async clear() {
        await fs.emptyDir(pluginDataDir);
      }
    };

    const log: PluginLogger = {
      info: (msg) => this.logger.info(`[${pluginId}] ${msg}`),
      warn: (msg) => this.logger.warn(`[${pluginId}] ${msg}`),
      error: (msg) => this.logger.error(`[${pluginId}] ${msg}`),
      debug: (msg) => this.logger.debug(`[${pluginId}] ${msg}`),
    };

    const events: PluginEventBus = {
      on: (event, listener) => this.globalEventBus.on(event, listener),
      emit: (event, ...args) => this.globalEventBus.emit(event, ...args)
    };

    return { log, storage, events };
  }

  async scanAndLoadPlugins() {
    const dirs = await fs.readdir(this.pluginsDir);
    for (const dir of dirs) {
      const fullPath = path.join(this.pluginsDir, dir);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await this.loadPlugin(dir);
      }
    }
  }

  async loadPlugin(pluginFolder: string) {
    const pluginPath = path.join(this.pluginsDir, pluginFolder);
    const manifestPath = path.join(pluginPath, 'manifest.json');
    const indexPath = path.join(pluginPath, 'index.js');

    try {
      if (!(await fs.pathExists(manifestPath))) {
        this.logger.warn(`Skipping ${pluginFolder}: No manifest.json found.`);
        return;
      }
      if (!(await fs.pathExists(indexPath))) {
        this.logger.warn(`Skipping ${pluginFolder}: No index.js found.`);
        return;
      }

      const manifest = await fs.readJson(manifestPath);
      // Ensure require cache is clear for hot reloading
      if (require.cache[require.resolve(indexPath)]) {
        delete require.cache[require.resolve(indexPath)];
      }

      const pluginFactory = require(indexPath);
      if (typeof pluginFactory !== 'function') {
        throw new Error(`Plugin index.js must export a factory function`);
      }

      const api = this.createPluginAPI(manifest.id);
      
      let plugin: AIOSPlugin;
      try {
        plugin = pluginFactory(api);
        plugin.manifest = manifest;
      } catch (e: any) {
        throw new Error(`Plugin factory crashed: ${e.message}`);
      }

      // Security check (Simulation of GuardRails blocking high-risk things)
      // In production, Orchestrator handles real permissions. We trust here.
      
      if (plugin.onEnable) {
        try {
          await plugin.onEnable(api);
        } catch (e: any) {
          throw new Error(`Plugin onEnable crashed: ${e.message}`);
        }
      }

      this.loadedPlugins.set(manifest.id, plugin);
      this.registerPluginContents(plugin);
      
      this.logger.info(`Successfully loaded plugin: ${manifest.name} v${manifest.version}`);
    } catch (e: any) {
      this.logger.error(`Failed to load plugin ${pluginFolder}: ${e.message}`);
      // Crash isolation: AIOS continues running even if this plugin fails.
    }
  }

  private registerPluginContents(plugin: AIOSPlugin) {
    if (plugin.getTools) {
      try {
        const tools = plugin.getTools();
        for (const tool of tools) {
          this.toolRegistry.set(tool.name, tool); // Using name instead of id for simplicity, or prefix it
        }
        this.logger.info(`Registered ${tools.length} tools for ${plugin.manifest.id}`);
      } catch (e: any) {
        this.logger.error(`Error loading tools for ${plugin.manifest.id}: ${e.message}`);
      }
    }

    if (plugin.getActions) {
      try {
        const actions = plugin.getActions();
        for (const [key, handler] of Object.entries(actions)) {
          this.actionRegistry.set(`${plugin.manifest.id}.${key}`, handler);
        }
      } catch (e: any) {
        this.logger.error(`Error loading actions for ${plugin.manifest.id}: ${e.message}`);
      }
    }

    if (plugin.getWorkflows) {
      try {
        const workflows = plugin.getWorkflows();
        for (const wf of workflows) {
          this.workflowRegistry.set(wf.id, wf);
        }
      } catch (e: any) {
        this.logger.error(`Error loading workflows for ${plugin.manifest.id}: ${e.message}`);
      }
    }
  }

  private unregisterPluginContents(pluginId: string) {
    // Naive cleanup: Iterate registries and remove entries belonging to this plugin
    // (A real implementation would track exactly what each plugin registered)
    
    // Cleanup toolRegistry (Assuming tool naming convention or full flush)
    // For now, if we hot-reload, the next load will just overwrite.
    // A complete implementation would map them properly.
  }

  async unloadPlugin(pluginId: string) {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return;

    const api = this.createPluginAPI(pluginId);

    if (plugin.onDisable) {
      try {
        await plugin.onDisable(api);
      } catch (e: any) {
        this.logger.error(`Plugin onDisable crashed for ${pluginId}: ${e.message}`);
      }
    }

    this.unregisterPluginContents(pluginId);
    this.loadedPlugins.delete(pluginId);
    this.logger.info(`Unloaded plugin: ${pluginId}`);
  }

  async reloadPlugin(pluginFolder: string) {
    const pluginPath = path.join(this.pluginsDir, pluginFolder);
    let manifestId = pluginFolder;
    
    try {
      const manifest = await fs.readJson(path.join(pluginPath, 'manifest.json'));
      manifestId = manifest.id;
    } catch(e) {}

    this.logger.info(`Hot-reloading plugin: ${manifestId}`);
    await this.unloadPlugin(manifestId);
    await this.loadPlugin(pluginFolder);
  }

  public getPlugins(): AIOSPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }
}
