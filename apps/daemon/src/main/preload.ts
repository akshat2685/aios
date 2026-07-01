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
  'memory:clear',
  'memory:stats',
  'agent:chat',
  'agent:launch',
  'agent-launcher:toggle',
  'research:conduct',
  'adk:list-agents',
  'launcher:hide',
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
    clear: () => ipcRenderer.invoke('memory:clear'),
    stats: () => ipcRenderer.invoke('memory:stats'),
  },
  agent: {
    chat: (message: string, agentId?: string) => ipcRenderer.invoke('agent:chat', { message, agentId }),
    listAdkAgents: () => ipcRenderer.invoke('adk:list-agents'),
    launch: (agentId: string) => ipcRenderer.invoke('agent:launch', { agentId }),
  },
  launcher: {
    hide: () => ipcRenderer.invoke('launcher:hide'),
  },
  research: {
    conduct: (query: string) => ipcRenderer.invoke('research:conduct', { query }),
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (!validChannels.includes(channel)) return;
    const listener = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  once: (channel: string, callback: (...args: any[]) => void) => {
    if (!validChannels.includes(channel)) return;
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
        clear: () => Promise<{ status: string }>;
        stats: () => Promise<{ points: number; vectors: number; status: string }>;
      };
      agent: {
        chat: (message: string, agentId?: string) => Promise<any>;
        listAdkAgents: () => Promise<{ agents: Array<{ name: string; description: string; capabilities: string[]; icon: string }> }>;
        launch: (agentId: string) => Promise<{ status: string; agentId: string }>;
      };
      launcher: {
        hide: () => Promise<void>;
      };
      research: {
        conduct: (query: string) => Promise<any>;
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