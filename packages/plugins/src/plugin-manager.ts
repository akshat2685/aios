import fs from 'fs-extra';
import path from 'path';
import * as os from 'os';
import { CoreLogger } from '@aios/core';
import { AgentTool } from '@aios/types';

export class PluginManager {
  private logger: CoreLogger;
  private pluginsDir: string;
  private loadedPlugins: Map<string, any> = new Map();

  constructor(logger: CoreLogger) {
    this.logger = logger;
    this.pluginsDir = path.join(os.homedir(), '.aios', 'plugins');
  }

  /**
   * Scans and loads custom plugins from ~/.aios/plugins
   */
  async loadPlugins(): Promise<AgentTool[]> {
    const tools: AgentTool[] = [];
    this.logger.info(`Scanning plugins directory: ${this.pluginsDir}`);

    try {
      if (!fs.existsSync(this.pluginsDir)) {
        await fs.ensureDir(this.pluginsDir);
        this.logger.info('Created plugins directory');
        return [];
      }

      const files = await fs.readdir(this.pluginsDir);
      for (const file of files) {
        if (path.extname(file) === '.js') {
          const pluginPath = path.resolve(this.pluginsDir, file);
          try {
            // Clear require cache to enable clean reload
            if (require.cache[require.resolve(pluginPath)]) {
              delete require.cache[require.resolve(pluginPath)];
            }
            
            const plugin = require(pluginPath);
            if (plugin && typeof plugin.getTools === 'function') {
              const pluginTools = plugin.getTools();
              if (Array.isArray(pluginTools)) {
                tools.push(...pluginTools);
                this.loadedPlugins.set(file, plugin);
                this.logger.info(`Successfully loaded ${pluginTools.length} tools from plugin: ${file}`);
              }
            } else {
              this.logger.warn(`Plugin ${file} does not export a getTools() function`);
            }
          } catch (e: any) {
            this.logger.error(`Failed to load plugin ${file}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      this.logger.error(`Plugin loading failed: ${e.message}`);
    }

    return tools;
  }
}
