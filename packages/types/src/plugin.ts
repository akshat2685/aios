import { AgentTool } from './agents';
import { Workflow, AutomationAction } from './automation';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  homepage?: string;
  icon?: string;
  permissions: string[];
  dependencies?: string[];
  minAiosVersion: string;
}

export interface PluginStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PluginLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

export interface PluginEventBus {
  on(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export interface PluginAPI {
  log: PluginLogger;
  storage: PluginStorage;
  events: PluginEventBus;
  // Future: memory, workflows, notifications, security
}

export interface AIOSPlugin {
  manifest: PluginManifest;
  onInstall?: (api: PluginAPI) => Promise<void>;
  onEnable?: (api: PluginAPI) => Promise<void>;
  onDisable?: (api: PluginAPI) => Promise<void>;
  onUnload?: (api: PluginAPI) => Promise<void>;
  onUpdate?: (api: PluginAPI, oldVersion: string) => Promise<void>;

  getTools?: () => AgentTool[];
  getActions?: () => Record<string, (params: any, context: any) => Promise<any>>; // Dynamic action execution handlers
  getWorkflows?: () => Workflow[];
}
