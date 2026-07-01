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
  };
  config: {
    get: (key: string, defaultValue?: any) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  memory: {
    search: (options: { query: string; limit?: number }) => Promise<any[]>;
    clear: () => Promise<{ status: string; error?: string }>;
    stats: () => Promise<{ points: number; vectors: number; status: string }>;
  };
  agent: {
    chat: (params: { message: string; agentId?: string }) => Promise<{ message: string; done: boolean }>;
    listAdkAgents: () => Promise<{ agents: AdkAgent[] }>;
    launch: (agentId: string) => Promise<{ status: string; agentId: string }>;
  };
  launcher: {
    hide: () => Promise<void>;
  };
  llm: {
    generate: (params: { prompt: string; model?: string; systemPrompt?: string }) => Promise<any>;
    stream: (params: { prompt: string; model?: string; systemPrompt?: string; conversationId: string }) => Promise<void>;
    models: () => Promise<string[]>;
    health: () => Promise<Record<string, { status: string; error?: string }>>;
    stopStream: (conversationId: string) => Promise<void>;
    keys: {
      set: (provider: string, key: string) => Promise<{ status: string; error?: string }>;
      get: (provider: string) => Promise<{ isSet: boolean }>;
      delete: (provider: string) => Promise<{ status: string; error?: string }>;
    };
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
    },
    config: {
      get: async (key: string, defaultValue?: any) => defaultValue,
      set: async () => {},
    },
    memory: {
      search: async () => [],
      clear: async () => ({ status: 'mock' }),
      stats: async () => ({ points: 0, vectors: 0, status: 'mock' }),
    },
    agent: {
      chat: async ({ message }) => ({
        message: `[Mock Response] You said: ${message}`,
        done: true,
      }),
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
      models: async () => ['qwen2.5:8b', 'llama3.1:8b'],
      health: async () => ({ ollama: { status: 'mock' } }),
      stopStream: async () => {},
      keys: {
        set: async () => ({ status: 'mock' }),
        get: async () => ({ isSet: false }),
        delete: async () => ({ status: 'mock' }),
      },
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
    system: {
      status: async () => ({
        version: '0.1.0',
        uptime: 0,
        ollamaStatus: 'mock',
        memoryStatus: 'mock',
      }),
    },
    on: () => {},
    off: () => {},
  };
}
