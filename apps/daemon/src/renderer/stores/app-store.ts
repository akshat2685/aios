import { create } from 'zustand';

export type AgentStatus = 'idle' | 'thinking' | 'active' | 'error';

export interface AppState {
  // Navigation
  activePage: string;
  setActivePage: (page: string) => void;

  // Command Palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  // Agent statuses
  agentStatuses: Record<string, AgentStatus>;
  setAgentStatus: (agentId: string, status: AgentStatus) => void;

  // System
  ollamaStatus: 'online' | 'offline' | 'checking';
  setOllamaStatus: (status: 'online' | 'offline' | 'checking') => void;
  memoryStatus: 'online' | 'offline' | 'checking';
  setMemoryStatus: (status: 'online' | 'offline' | 'checking') => void;

  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),

  // Command Palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

  // Agent statuses
  agentStatuses: {
    assistant: 'idle',
    coder: 'idle',
    researcher: 'idle',
    planner: 'idle',
  },
  setAgentStatus: (agentId, status) =>
    set((s) => ({
      agentStatuses: { ...s.agentStatuses, [agentId]: status },
    })),

  // System
  ollamaStatus: 'checking',
  setOllamaStatus: (status) => set({ ollamaStatus: status }),
  memoryStatus: 'checking',
  setMemoryStatus: (status) => set({ memoryStatus: status }),

  // Sidebar
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
