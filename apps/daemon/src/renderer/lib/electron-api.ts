/**
 * Typed Electron API bridge.
 * This mirrors the API exposed by preload.ts via contextBridge.
 */

export interface AdkAgent {
  name: string;
  description: string;
  capabilities: string[];
  icon: string;
}

export interface ElectronAPI {
  app: {
    quit: () => Promise<void>;
    minimize: () => Promise<void>;
    hide: () => Promise<void>;
    show: () => Promise<void>;
    restart: () => Promise<void>;
    execute: (command: string) => Promise<{ status: string; stdout?: string; error?: string; stderr?: string }>;
  };
  clipboard: {
    read: () => Promise<{ status: string; text?: string; error?: string }>;
  };
  config: {
    get: (key: string, defaultValue?: any) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  memory: {
    search: (options: { query: string; limit?: number }) => Promise<any[]>;
    searchTyped: (params: { type: string; query: string; limit?: number }) => Promise<any[]>;
    save: (params: { type: string; content: string; metadata?: any }) => Promise<string | null>;
    delete: (id: string) => Promise<{ status: string; error?: string }>;
    clear: () => Promise<{ status: string; error?: string }>;
    stats: () => Promise<{ points: number; vectors: number; status: string }>;
  };
  graph: {
    getProjects: () => Promise<any[]>;
    createProject: (params: { name: string; description?: string }) => Promise<string | null>;
    deleteProject: (id: string) => Promise<{ status: string; error?: string }>;
    getTasks: (projectId: string) => Promise<any[]>;
    createTask: (params: { projectId: string; title: string; description?: string; priority?: string }) => Promise<string | null>;
    updateTaskStatus: (id: string, status: string) => Promise<{ status: string; error?: string }>;
    deleteTask: (id: string) => Promise<{ status: string; error?: string }>;
  };
  agent: {
    chat: (params: { message: string; agentId?: string }) => Promise<{ message: string; done: boolean }>;
    chatStream: (params: { message: string; agentId?: string; conversationId: string; history?: any[] }) => Promise<void>;
    listAdkAgents: () => Promise<{ agents: AdkAgent[] }>;
    launch: (agentId: string) => Promise<{ status: string; agentId: string }>;
  };
  launcher: {
    hide: () => Promise<void>;
  };
  llm: {
    generate: (params: { prompt: string; model?: string; systemPrompt?: string }) => Promise<any>;
    stream: (params: { prompt: string; model?: string; systemPrompt?: string; conversationId: string }) => Promise<void>;
    models: (providerId: string) => Promise<string[]>;
    health: () => Promise<Record<string, { status: string; error?: string }>>;
    states: () => Promise<Record<string, any>>;
    trackerStats: () => Promise<any>;
    getCacheStats: () => Promise<any>;
    stopStream: (conversationId: string) => Promise<void>;
    keys: {
      set: (provider: string, key: string | string[]) => Promise<{ status: string; error?: string }>;
      get: (provider: string) => Promise<{ isSet: boolean; count: number }>;
      delete: (provider: string) => Promise<{ status: string; error?: string }>;
    };
    diagnostics: () => Promise<any>;
    config: {
      get: () => Promise<any>;
      set: (key: string, value: any) => Promise<{ status: string; error?: string }>;
    };
    disableProvider: (providerId: string) => Promise<{ status: string; error?: string }>;
    enableProvider: (providerId: string) => Promise<{ status: string; error?: string }>;
    disableModel: (modelId: string) => Promise<{ status: string; error?: string }>;
    setRoutingProfile: (profile: string) => Promise<{ status: string; error?: string }>;
    setCloudMode: (mode: string) => Promise<{ status: string; error?: string }>;
    setRoutingMode: (mode: string) => Promise<{ status: string; error?: string }>;
    setUserPreferences: (prefs: any) => Promise<{ status: string; error?: string }>;
    discoverModels: () => Promise<any>;
    localModels: () => Promise<{ general: string[]; coding: string[] }>;
  };
  research: {
    conduct: (params: { query: string }) => Promise<any>;
  };
  system: {
    status: () => Promise<{
      version: string;
      uptime: number;
      ollamaStatus: string;
      memoryStatus: string;
    }>;
    metrics: () => Promise<any>;
    ollamaModels: () => Promise<any[]>;
    ollamaPs: () => Promise<any[]>;
  };
  security: {
    resolveApproval: (id: string, approved: boolean | string) => Promise<void>;
    onRequestApproval: (callback: (request: any) => void) => () => void;
    getRules: () => Promise<{ persistent: any[], session: any[] }>;
    deleteRule: (id: string, type: 'persistent' | 'session') => Promise<boolean>;
    getAuditLogs: (limit?: number) => Promise<any[]>;
  };
  plugins: {
    list: () => Promise<any[]>;
    uninstall: (id: string) => Promise<{ status: string; error?: string }>;
  };
  voice: {
    recordStart: () => Promise<any>;
    recordStop: () => Promise<any>;
    synthesize: (text: string) => Promise<any>;
  };
  sandbox: {
    create: (name: string, task: string) => Promise<any>;
    execute: (id: string, command: string) => Promise<any>;
    promote: (id: string) => Promise<any>;
  };
  twin: {
    getProfile: () => Promise<any>;
  };
  federation: {
    getPeers: () => Promise<any[]>;
  };
  graphViz: {
    getSnapshot: () => Promise<any>;
  };
  workflow: {
    list: () => Promise<any[]>;
    save: (workflow: any) => Promise<{ status: string; error?: string }>;
    delete: (id: string) => Promise<{ status: string; error?: string }>;
    trigger: (eventName: string, payload: any) => Promise<{ status: string; error?: string }>;
    triggers: () => Promise<any[]>;
  };
  telemetry: {
    logs: (limit?: number, type?: string) => Promise<any[]>;
    clear: () => Promise<{ status: string; error?: string }>;
  };

  // Event listeners for streaming
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function getElectronAPI(): ElectronAPI {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  // Fallback for development without Electron
  return createMockAPI();
}

function createMockAPI(): ElectronAPI {
  console.warn('[AIOS] Running in browser mode — using mock Electron API');
  return {
    app: {
      quit: async () => console.log('Mock: quit'),
      minimize: async () => console.log('Mock: minimize'),
      hide: async () => console.log('Mock: hide'),
      show: async () => console.log('Mock: show'),
      restart: async () => console.log('Mock: restart'),
      execute: async (command) => ({ status: 'mock', stdout: `Mock executed: ${command}` }),
    },
    clipboard: {
      read: async () => ({ status: 'mock', text: 'Mock clipboard content' }),
    },
    config: {
      get: async (key: string, defaultValue?: any) => defaultValue,
      set: async () => {},
    },
    memory: {
      search: async () => [],
      searchTyped: async () => [],
      save: async () => 'mock-id',
      delete: async () => ({ status: 'mock' }),
      clear: async () => ({ status: 'mock' }),
      stats: async () => ({ points: 0, vectors: 0, status: 'mock' }),
    },
    graph: {
      getProjects: async () => [],
      createProject: async () => 'mock-id',
      deleteProject: async () => ({ status: 'mock' }),
      getTasks: async () => [],
      createTask: async () => 'mock-id',
      updateTaskStatus: async () => ({ status: 'mock' }),
      deleteTask: async () => ({ status: 'mock' }),
    },
    agent: {
      chat: async ({ message }) => ({
        message: `[Mock Response] You said: ${message}`,
        done: true,
      }),
      chatStream: async () => {},
      listAdkAgents: async () => ({
        agents: [
          { name: 'planner', description: 'Break tasks into structured work items.', capabilities: ['planning', 'decomposition', 'coordination'], icon: '🧠' },
          { name: 'research', description: 'Gather sources and synthesize findings.', capabilities: ['search', 'summarization', 'source_validation'], icon: '🔍' },
          { name: 'coding', description: 'Generate, refactor, debug, and explain code.', capabilities: ['code_generation', 'refactoring', 'debugging'], icon: '💻' },
          { name: 'website', description: 'Build frontend, backend, API, and database.', capabilities: ['frontend', 'backend', 'api_design', 'database_design'], icon: '🌐' },
          { name: 'testing', description: 'Create and interpret tests.', capabilities: ['unit_tests', 'integration_tests', 'e2e_tests'], icon: '🧪' },
          { name: 'security', description: 'Review dependencies and secret risks.', capabilities: ['dependency_scanning', 'static_analysis', 'secret_detection'], icon: '🛡️' },
          { name: 'docs', description: 'Produce architecture and API documentation.', capabilities: ['readme', 'architecture_docs', 'api_docs'], icon: '📝' },
        ],
      }),
      launch: async (agentId: string) => ({ status: 'mock', agentId }),
    },
    launcher: {
      hide: async () => console.log('Mock: hide launcher'),
    },
    llm: {
      generate: async () => ({ content: 'Mock LLM response' }),
      stream: async () => {},
      models: async (providerId: string) => ['qwen2.5:8b', 'llama3.1:8b'],
      health: async () => ({ ollama: { status: 'mock' } }),
      states: async () => ({}),
      trackerStats: async () => ({}),
      getCacheStats: async () => ({}),
      stopStream: async () => {},
      keys: {
        set: async (provider: string, key: string | string[]) => ({ status: 'mock' }),
        get: async (provider: string) => ({ isSet: false, count: 0 }),
        delete: async (provider: string) => ({ status: 'mock' }),
      },
      diagnostics: async () => ({ providerHealth: {}, availableModels: [], routingHistory: [], cooldowns: {} }),
      config: {
        get: async () => ({}),
        set: async () => ({ status: 'mock' }),
      },
      disableProvider: async () => ({ status: 'mock' }),
      enableProvider: async () => ({ status: 'mock' }),
      disableModel: async () => ({ status: 'mock' }),
      setRoutingProfile: async () => ({ status: 'mock' }),
      setCloudMode: async () => ({ status: 'mock' }),
      setRoutingMode: async () => ({ status: 'mock' }),
      setUserPreferences: async () => ({ status: 'mock' }),
      discoverModels: async () => ({}),
      localModels: async () => ({ general: [], coding: [] }),
    },
    research: {
      conduct: async ({ query }) => ({
        topic: query,
        summary: 'Mock research summary',
        keyFindings: [],
        suggestedFurtherReading: [],
        metadata: { startTime: Date.now(), endTime: Date.now(), sourcesAnalyzed: 0 },
      }),
    },
    security: {
      resolveApproval: async (id: string, approved: boolean | string) => { console.log('Mock resolveApproval', id, approved); },
      onRequestApproval: (callback: (request: any) => void) => { return () => {}; },
      getRules: async () => ({ persistent: [], session: [] }),
      deleteRule: async () => true,
      getAuditLogs: async () => [],
    },
    plugins: {
      list: async () => [],
      uninstall: async () => ({ status: 'mock' }),
    },
    workflow: {
      list: async () => [],
      save: async () => ({ status: 'mock' }),
      delete: async () => ({ status: 'mock' }),
      trigger: async () => ({ status: 'mock' }),
      triggers: async () => [],
    },
    telemetry: {
      logs: async () => [],
      clear: async () => ({ status: 'mock' }),
    },
    system: {
      status: async () => ({ version: '1.0', uptime: 0, ollamaStatus: 'mock', memoryStatus: 'mock' }),
      metrics: async () => ({ cpuUsage: 0, totalMem: 1, freeMem: 1, uptime: 0, platform: 'mock' }),
      ollamaModels: async () => [],
      ollamaPs: async () => [],
    },
    on: () => {},
    off: () => {},
  };
}
