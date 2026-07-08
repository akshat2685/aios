import { BaseAgent } from './base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import * as fs from 'fs';
import * as path from 'path';

export interface AgentManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  systemPrompt: string;
  requiredSkills: string[];
}

export class DynamicAgent extends BaseAgent {
  private manifest: AgentManifest;

  constructor(manifest: AgentManifest, router: LLMRouter, logger: CoreLogger) {
    super(manifest.name, manifest.description, router, logger);
    this.manifest = manifest;
  }

  protected getSystemPrompt(): string {
    return this.manifest.systemPrompt;
  }
}

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();
  private logger: CoreLogger;
  private router: LLMRouter;
  private registryPath: string;

  constructor(logger: CoreLogger, router: LLMRouter, registryPath: string) {
    this.logger = logger;
    this.router = router;
    this.registryPath = registryPath;
  }

  registerAgent(agent: BaseAgent) {
    this.logger.info(`Registering static agent: ${agent.state.name}`);
    this.agents.set(agent.state.name, agent);
  }

  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  async loadDynamicAgents(): Promise<void> {
    if (!fs.existsSync(this.registryPath)) {
      this.logger.warn(`Agent registry path does not exist: ${this.registryPath}`);
      return;
    }

    const entries = await fs.promises.readdir(this.registryPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(this.registryPath, entry.name, 'manifest.json');
        
        if (fs.existsSync(manifestPath)) {
          try {
            const content = await fs.promises.readFile(manifestPath, 'utf8');
            const manifest: AgentManifest = JSON.parse(content);
            
            const agent = new DynamicAgent(manifest, this.router, this.logger);
            this.agents.set(manifest.id, agent);
            this.logger.info(`Loaded dynamic agent: ${manifest.id} v${manifest.version}`);
          } catch (e) {
            this.logger.error(`Failed to load agent manifest at ${manifestPath}: ${e}`);
          }
        }
      }
    }
  }
}
