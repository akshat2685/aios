const { contextBridge, ipcRenderer } = require('electron');

/**
 * AIOS Preload Script
 * Exposes a typed, secure API to the renderer process via contextBridge.
 * No Node.js APIs are directly exposed — all communication is through IPC.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ─── App Controls ─────────────────────────────────────────
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    minimize: () => ipcRenderer.invoke('app:minimize'),
    hide: () => ipcRenderer.invoke('app:hide'),
    show: () => ipcRenderer.invoke('app:show'),
    restart: () => ipcRenderer.invoke('app:restart'),
  },

  // ─── Configuration ────────────────────────────────────────
  config: {
    get: (key, defaultValue) => ipcRenderer.invoke('config:get', key, defaultValue),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
  },

  // ─── Memory ───────────────────────────────────────────────
  memory: {
    search: (options) => ipcRenderer.invoke('memory:search', options),
    clear: () => ipcRenderer.invoke('memory:clear'),
    stats: () => ipcRenderer.invoke('memory:stats'),
  },

  // ─── Agent Chat ───────────────────────────────────────────
  agent: {
    chat: (params) => ipcRenderer.invoke('agent:chat', params),
  },

  // ─── LLM ──────────────────────────────────────────────────
  llm: {
    generate: (params) => ipcRenderer.invoke('llm:generate', params),
    stream: (params) => ipcRenderer.invoke('llm:stream', params),
    models: () => ipcRenderer.invoke('llm:models'),
    health: () => ipcRenderer.invoke('llm:health'),
    stopStream: (conversationId) => ipcRenderer.invoke('llm:stopStream', conversationId),
    keys: {
      set: (provider, key) => ipcRenderer.invoke('llm:keys:set', { provider, key }),
      get: (provider) => ipcRenderer.invoke('llm:keys:get', provider),
      delete: (provider) => ipcRenderer.invoke('llm:keys:delete', provider),
    },
  },

  // ─── Research ─────────────────────────────────────────────
  research: {
    conduct: (params) => ipcRenderer.invoke('research:conduct', params),
  },

  // ─── System ───────────────────────────────────────────────
  system: {
    status: () => ipcRenderer.invoke('system:status'),
  },

  // ─── Event Listeners (for streaming) ──────────────────────
  on: (channel, callback) => {
    const validChannels = ['llm:stream-chunk', 'llm:stream-end', 'llm:stream-error'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  off: (channel, callback) => {
    const validChannels = ['llm:stream-chunk', 'llm:stream-end', 'llm:stream-error'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
});