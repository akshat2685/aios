import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

const validChannels = [
  'config:get',
  'config:set',
  'app:quit',
  'app:minimize',
  'app:hide',
  'app:show',
  'app:restart',
  'dialog:open',
  'shell:openExternal',
  'theme:get',
  'theme:set',
  'update:available',
  'update:downloaded',
  'memory:search',
  'memory:searchTyped',
  'memory:save',
  'memory:delete',
  'memory:clear',
  'memory:stats',
  'graph:getProjects',
  'graph:createProject',
  'graph:deleteProject',
  'graph:getTasks',
  'graph:createTask',
  'graph:updateTaskStatus',
  'graph:deleteTask',
  'agent:chat',
  'agent:chat-stream',
  'agent:launch',
  'agent-launcher:toggle',
  'research:conduct',
  'adk:list-agents',
  'launcher:hide',
  'security:resolve-approval',
  'workflow:list',
  'workflow:save',
  'workflow:delete',
  'workflow:trigger',
  'telemetry:logs',
  'telemetry:clear',
  'system:metrics',
  'system:ollama:models',
  'system:ollama:ps',
  'llm:cache:stats',
  'llm:tracker:stats',
  'llm:states',
  'llm:diagnostics',
  'llm:config:get',
  'llm:config:set',
  'llm:disable-provider',
  'llm:enable-provider',
  'llm:disable-model',
  'llm:set-routing-profile',
  'llm:set-cloud-mode',
  'llm:set-routing-mode',
  'llm:set-user-preferences',
  'llm:discover-models',
  'llm:local-models',
  'security:get-rules',
  'security:delete-rule',
  'security:get-audit-logs',
  'plugins:list',
  'plugins:uninstall',
  'automation:triggers',
  'voice:record-start',
  'voice:record-stop',
  'voice:synthesize',
  'sandbox:create',
  'sandbox:execute',
  'sandbox:promote',
  'twin:getProfile',
  'federation:getPeers',
  'graph-viz:getSnapshot'
];

contextBridge.exposeInMainWorld('electronAPI', {
  config: {
    get: (key: string, defaultValue?: any) => ipcRenderer.invoke('config:get', key, defaultValue),
    set: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
  },
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    minimize: () => ipcRenderer.invoke('app:minimize'),
    hide: () => ipcRenderer.invoke('app:hide'),
    show: () => ipcRenderer.invoke('app:show'),
    restart: () => ipcRenderer.invoke('app:restart'),
    execute: (command: string) => ipcRenderer.invoke('app:execute', command),
  },
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
  },
  dialog: {
    open: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('dialog:open', options),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
  },
  memory: {
    search: (options: any) => ipcRenderer.invoke('memory:search', options),
    searchTyped: (params: { type: string; query: string; limit?: number }) => ipcRenderer.invoke('memory:searchTyped', params),
    save: (params: { type: string; content: string; metadata?: any }) => ipcRenderer.invoke('memory:save', params),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', { id }),
    clear: () => ipcRenderer.invoke('memory:clear'),
    stats: () => ipcRenderer.invoke('memory:stats'),
  },
  graph: {
    getProjects: () => ipcRenderer.invoke('graph:getProjects'),
    createProject: (params: { name: string; description?: string }) => ipcRenderer.invoke('graph:createProject', params),
    deleteProject: (id: string) => ipcRenderer.invoke('graph:deleteProject', { id }),
    getTasks: (projectId: string) => ipcRenderer.invoke('graph:getTasks', { projectId }),
    createTask: (params: { projectId: string; title: string; description?: string; priority?: string }) => ipcRenderer.invoke('graph:createTask', params),
    updateTaskStatus: (id: string, status: string) => ipcRenderer.invoke('graph:updateTaskStatus', { id, status }),
    deleteTask: (id: string) => ipcRenderer.invoke('graph:deleteTask', { id }),
  },
  agent: {
    chat: (message: string, agentId?: string) => ipcRenderer.invoke('agent:chat', { message, agentId }),
    chatStream: (params: { message: string; agentId?: string; conversationId: string; history?: any[] }) => ipcRenderer.invoke('agent:chat-stream', params),
    listAdkAgents: () => ipcRenderer.invoke('adk:list-agents'),
    launch: (agentId: string) => ipcRenderer.invoke('agent:launch', { agentId }),
  },
  launcher: {
    hide: () => ipcRenderer.invoke('launcher:hide'),
  },
  llm: {
    generate: (params: any) => ipcRenderer.invoke('llm:generate', params),
    stream: (params: any) => ipcRenderer.invoke('llm:stream', params),
    models: (providerId: string) => ipcRenderer.invoke('llm:models', providerId),
    health: () => ipcRenderer.invoke('llm:health'),
    states: () => ipcRenderer.invoke('llm:states'),
    getTrackerStats: () => ipcRenderer.invoke('llm:tracker:stats'),
    getCacheStats: () => ipcRenderer.invoke('llm:cache:stats'),
    stopStream: (conversationId: string) => ipcRenderer.invoke('llm:stopStream', conversationId),
    keys: {
      set: (provider: string, key: string) => ipcRenderer.invoke('llm:keys:set', { provider, key }),
      get: (provider: string) => ipcRenderer.invoke('llm:keys:get', provider),
      delete: (provider: string) => ipcRenderer.invoke('llm:keys:delete', provider),
    },
  },
  security: {
    resolveApproval: (id: string, approved: boolean | string) => ipcRenderer.invoke('security:resolve-approval', { id, approved }),
    onRequestApproval: (callback: (request: any) => void) => {
      ipcRenderer.on('security:request-approval', (_, request) => callback(request));
      return () => {
        ipcRenderer.removeAllListeners('security:request-approval');
      };
    },
    getRules: () => ipcRenderer.invoke('security:get-rules'),
    deleteRule: (id: string, type: 'persistent' | 'session') => ipcRenderer.invoke('security:delete-rule', { id, type }),
    getAuditLogs: (limit?: number) => ipcRenderer.invoke('security:get-audit-logs', { limit }),
  },
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    uninstall: (id: string) => ipcRenderer.invoke('plugins:uninstall', { id }),
  },
  research: {
    conduct: (query: string) => ipcRenderer.invoke('research:conduct', { query }),
  },
  workflow: {
    list: () => ipcRenderer.invoke('workflow:list'),
    save: (workflow: any) => ipcRenderer.invoke('workflow:save', workflow),
    delete: (id: string) => ipcRenderer.invoke('workflow:delete', { id }),
    trigger: (eventName: string, payload: any) => ipcRenderer.invoke('workflow:trigger', { eventName, payload }),
    triggers: () => ipcRenderer.invoke('automation:triggers'),
  },
  telemetry: {
    logs: (limit?: number, type?: string) => ipcRenderer.invoke('telemetry:logs', { limit, type }),
    clear: () => ipcRenderer.invoke('telemetry:clear'),
  },
  system: {
    metrics: () => ipcRenderer.invoke('system:metrics'),
    ollamaModels: () => ipcRenderer.invoke('system:ollama:models'),
    ollamaPs: () => ipcRenderer.invoke('system:ollama:ps'),
  },
  voice: {
    recordStart: () => ipcRenderer.invoke('voice:record-start'),
    recordStop: () => ipcRenderer.invoke('voice:record-stop'),
    synthesize: (text: string) => ipcRenderer.invoke('voice:synthesize', { text }),
  },
  sandbox: {
    create: (name: string, task: string) => ipcRenderer.invoke('sandbox:create', { name, task }),
    execute: (id: string, command: string) => ipcRenderer.invoke('sandbox:execute', { id, command }),
    promote: (id: string) => ipcRenderer.invoke('sandbox:promote', { id }),
  },
  twin: {
    getProfile: () => ipcRenderer.invoke('twin:getProfile'),
  },
  federation: {
    getPeers: () => ipcRenderer.invoke('federation:getPeers'),
  },
  graphViz: {
    getSnapshot: () => ipcRenderer.invoke('graph-viz:getSnapshot'),
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (!validChannels.includes(channel) && !channel.startsWith('llm:')) return;
    const listener = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  once: (channel: string, callback: (...args: any[]) => void) => {
    if (!validChannels.includes(channel) && !channel.startsWith('llm:')) return;
    ipcRenderer.once(channel, (_event: IpcRendererEvent, ...args: any[]) => callback(...args));
  },
});

contextBridge.exposeInMainWorld('versions', {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
});

declare global {
  interface Window {
    electronAPI: {
      config: {
        get: (key: string, defaultValue?: any) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
      };
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
      dialog: {
        open: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      theme: {
        get: () => Promise<'light' | 'dark'>;
        set: (theme: 'light' | 'dark' | 'system') => Promise<void>;
      };
      memory: {
        search: (options: any) => Promise<any[]>;
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
        chat: (message: string, agentId?: string) => Promise<any>;
        chatStream: (params: { message: string; agentId?: string; conversationId: string; history?: any[] }) => Promise<void>;
        listAdkAgents: () => Promise<{ agents: Array<{ name: string; description: string; capabilities: string[]; icon: string }> }>;
        launch: (agentId: string) => Promise<{ status: string; agentId: string }>;
      };
      launcher: {
        hide: () => Promise<void>;
      };
      research: {
        conduct: (query: string) => Promise<any>;
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
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
      once: (channel: string, callback: (...args: any[]) => void) => void;
    };
    versions: {
      node: string;
      chrome: string;
      electron: string;
    };
  }
}