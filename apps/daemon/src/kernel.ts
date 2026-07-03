import { CoreLogger, MemoryService } from '@aios/core';
import { LLMRouter } from '@aios/llm';
import { OllamaProvider } from '@aios/llm';
import { AgentOrchestrator } from '@aios/agents';
import { ConnectorManager } from '@aios/connectors';
import { FileSystemConnector } from '@aios/connectors';
import { AutomationEngine } from '@aios/automation';
import { GitService, CodeAnalyzer } from '@aios/devtools';
import { ResearchService } from '@aios/research';
import { LLMConfig } from '@aios/types';
import { SecretManager, GuardRail } from '@aios/security';
import { ConfigManager } from '@aios/config';
import { GraphService } from '@aios/graph';
import * as os from 'os';
import { PluginManager } from '@aios/plugins';
import { EventEmitter } from 'events';
import { ApprovalRequest, RiskLevel } from '@aios/types';

export class AIOSKernel {
  public logger: CoreLogger;
  public router: LLMRouter;
  public agents: AgentOrchestrator;
  public connectors: ConnectorManager;
  public automation: AutomationEngine;
  public research: ResearchService;
  public git: GitService;
  public analyzer: CodeAnalyzer;
  public memory: MemoryService;
  public graph: GraphService;
  public security: SecretManager;
  public plugins: PluginManager;
  public guardRail: GuardRail;

  private isRunning = false;
  private globalEventBus = new EventEmitter();
  private approvalCallback?: (request: ApprovalRequest, risk: RiskLevel) => Promise<"allow_once" | "allow_session" | "allow_always" | "deny_once" | "deny_always" | "timeout">;

  constructor(config: LLMConfig, logger: CoreLogger, approvalCallback?: (request: ApprovalRequest, risk: RiskLevel) => Promise<"allow_once" | "allow_session" | "allow_always" | "deny_once" | "deny_always" | "timeout">) {
    this.logger = logger;
    this.approvalCallback = approvalCallback;
    this.logger.info('Initializing AIOS Kernel...');

    const workspacePath = process.env.AIOS_WORKSPACE_PATH || 'C:\\Users\\ijain\\AIOS';

    const masterKey = os.userInfo().username + '_' + os.hostname();
    this.security = new SecretManager(logger, masterKey);

    this.guardRail = new GuardRail(logger, {
      allowDangerousActions: ConfigManager.get('privacy.localOnly') || false,
      requireApprovalFor: ['shell'],
      encryptionEnabled: false,
      airGappedMode: false
    }, this.approvalCallback);

    this.router = new LLMRouter(config, this.security, logger);
    this.memory = new MemoryService();
    this.graph = new GraphService(logger);
    this.graph.init().catch(e => logger.error(`Failed to initialize Graph Schema: ${e}`));

    this.agents = new AgentOrchestrator(
      this.router, 
      logger, 
      workspacePath,
      async (action, details) => {
        return await this.guardRail.requestApproval({
          id: Math.random().toString(36).substring(7),
          agentId: 'coder',
          action: 'shell',
          target: 'shell',
          params: { details },
          timestamp: Date.now()
        });
      },
      this.memory
    );

    this.connectors = new ConnectorManager(logger);
    
    const ingestionConfig = ConfigManager.get('memoryIngestion') || {};
    const fileWatcherConfig = ingestionConfig.fileWatcher || {};
    const watchPaths = (fileWatcherConfig.enabled && fileWatcherConfig.paths) ? fileWatcherConfig.paths : [];

    if (watchPaths.length > 0) {
      this.connectors.registerConnector(new FileSystemConnector({
        watchPaths,
        onIngest: async (payload) => {
          this.logger.debug(`Kernel received ingestion: ${payload.metadata.path || payload.source}`);
          try {
            await this.memory.ingest(payload);
            await this.automation.triggerEvent('file:added', payload);
          } catch (e: any) {
            this.logger.error(`Kernel ingestion routing failed: ${e.message}`);
          }
        }
      }, logger));
    } else {
      this.logger.info('No watched paths configured for file system ingestion.');
    }

    this.automation = new AutomationEngine(logger);
    this.research = new ResearchService(this.router, logger);
    this.git = new GitService(workspacePath, logger);
    this.analyzer = new CodeAnalyzer(logger);
    this.plugins = new PluginManager(logger, this.globalEventBus);
  }

  async boot() {
    try {
      this.logger.info('AIOS Kernel Booting...');
      
      try {
        await this.memory.initialize();
      } catch (memError: any) {
        this.logger.warn(`Memory Service initialization failed: ${memError.message}. Vector database might be offline.`);
      }

      try {
        await this.connectors.startAll();
      } catch (connError: any) {
        this.logger.warn(`Connectors failed to start: ${connError.message}`);
      }

      try {
        await this.agents.init();
      } catch (agentError: any) {
        this.logger.warn(`Agent orchestrator initialization failed: ${agentError.message}`);
      }

      try {
        await this.automation.init();
      } catch (autoError: any) {
        this.logger.warn(`Automation engine initialization failed: ${autoError.message}`);
      }

      try {
        await this.plugins.init();
      } catch (pluginError: any) {
        this.logger.warn(`Plugin manager initialization failed: ${pluginError.message}`);
      }

      this.isRunning = true;
      this.logger.info('AIOS Kernel Online. System Ready.');
    } catch (error: any) {
      this.logger.error(`Kernel boot failed: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    this.logger.info('Shutting down AIOS Kernel...');
    await this.connectors.stopAll();
    this.isRunning = false;
    this.logger.info('Kernel Offline.');
  }
}