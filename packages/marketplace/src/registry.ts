import { BaseAgent, AgentOrchestrator } from '@aios/agents';
import { CoreLogger } from '@aios/core';
import { LLMRouter } from '@aios/llm';
import * as fs from 'fs';
import * as path from 'path';
import { MarketplaceAgentManifest, InstallOptions } from './types';

export class MarketplaceRegistry {
  private installedAgents: Map<string, MarketplaceAgentManifest> = new Map();
  private logger: CoreLogger;
  private orchestrator: AgentOrchestrator;
  private router: LLMRouter;
  private marketplaceDir: string;

  constructor(logger: CoreLogger, orchestrator: AgentOrchestrator, router: LLMRouter, workspacePath: string) {
    this.logger = logger;
    this.orchestrator = orchestrator;
    this.router = router;
    this.marketplaceDir = path.join(workspacePath, '.aios', 'marketplace');
    this.initializeDirectory();
  }

  private initializeDirectory() {
    if (!fs.existsSync(this.marketplaceDir)) {
      fs.mkdirSync(this.marketplaceDir, { recursive: true });
    }
    const agentsDir = path.join(this.marketplaceDir, 'agents');
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }
  }

  /**
   * Load all previously installed agents from the local filesystem and inject them into the Orchestrator.
   */
  public async loadInstalledAgents(): Promise<void> {
    const agentsDir = path.join(this.marketplaceDir, 'agents');
    if (!fs.existsSync(agentsDir)) return;

    const dirs = fs.readdirSync(agentsDir);
    for (const dir of dirs) {
      const manifestPath = path.join(agentsDir, dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as MarketplaceAgentManifest;
          await this.loadAndInjectAgent(manifest, path.join(agentsDir, dir));
        } catch (e) {
          this.logger.error(`Failed to load external agent from ${dir}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
  }

  /**
   * Install a new agent (e.g., from a downloaded bundle) and inject it into the Orchestrator.
   * In a real implementation, this might download a package, extract it, install dependencies, and then load.
   */
  public async installAgent(manifest: MarketplaceAgentManifest, code: string, options?: InstallOptions): Promise<void> {
    const agentDir = path.join(this.marketplaceDir, 'agents', manifest.id);
    
    if (fs.existsSync(agentDir) && !options?.force) {
      throw new Error(`Agent ${manifest.id} is already installed. Use force option to overwrite.`);
    }

    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(agentDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(agentDir, manifest.entryPoint), code);
    
    this.logger.info(`Successfully installed external agent: ${manifest.name} (${manifest.id})`);
    
    await this.loadAndInjectAgent(manifest, agentDir);
  }

  /**
   * Remove an installed agent from the registry and delete its files.
   */
  public async uninstallAgent(id: string): Promise<void> {
    const agentDir = path.join(this.marketplaceDir, 'agents', id);
    if (!fs.existsSync(agentDir)) {
      throw new Error(`Agent ${id} is not installed.`);
    }

    fs.rmSync(agentDir, { recursive: true, force: true });
    this.installedAgents.delete(id);
    this.logger.info(`Successfully uninstalled external agent: ${id}`);
    
    // Note: Orchestrator currently doesn't have an unregisterAgent method.
    // If it did, we would call it here.
    this.orchestrator.unregisterAgent(id);
  }

  private async loadAndInjectAgent(manifest: MarketplaceAgentManifest, agentDir: string): Promise<void> {
    const entryPointPath = path.join(agentDir, manifest.entryPoint);
    
    if (!fs.existsSync(entryPointPath)) {
      throw new Error(`Entry point ${manifest.entryPoint} not found for agent ${manifest.id}`);
    }

    try {
      // Clear require cache to allow reloading
      const requirePath = path.resolve(entryPointPath);
      delete require.cache[require.resolve(requirePath)];
      
      const agentModule = require(requirePath);
      
      if (typeof agentModule.createAgent !== 'function') {
        throw new Error(`Agent module ${manifest.id} does not export a 'createAgent' factory function.`);
      }

      const agentInstance = agentModule.createAgent(this.router, this.logger) as BaseAgent;
      
      // Inject into orchestrator
      this.orchestrator.registerAgent(manifest.id, agentInstance);
      this.installedAgents.set(manifest.id, manifest);
      this.logger.info(`Injected marketplace agent '${manifest.id}' into orchestrator.`);
      
    } catch (e) {
      this.logger.error(`Error loading marketplace agent ${manifest.id}: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public getInstalledAgents(): MarketplaceAgentManifest[] {
    return Array.from(this.installedAgents.values());
  }
}
