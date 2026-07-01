import { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Titlebar } from '@/components/layout/titlebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { AgentLauncher } from '@/components/layout/agent-launcher';
import { ParticleCanvas } from '@/components/effects/particle-canvas';
import { useAppStore } from '@/stores/app-store';
import { getElectronAPI } from '@/lib/electron-api';
import DashboardPage from '@/pages/dashboard';
import ChatPage from '@/pages/chat';
import ResearchPage from '@/pages/research';
import AutomationPage from '@/pages/automation';
import SettingsPage from '@/pages/settings';
import LauncherPage from '@/pages/launcher';

export function App() {
  const { setOllamaStatus, setMemoryStatus, setSelectedAgentId, setAgentLauncherOpen, setCloudMode } = useAppStore();

  // Load config on boot
  useEffect(() => {
    const api = getElectronAPI();
    api.config.get('cloudMode').then((mode) => {
      if (mode) setCloudMode(mode as 'local' | 'online');
    });
  }, [setCloudMode]);

  // Check system health on boot
  useEffect(() => {
    const api = getElectronAPI();

    const checkHealth = async () => {
      try {
        const health = await api.llm.health();
        setOllamaStatus(health.ollama?.status === 'healthy' ? 'online' : 'offline');
      } catch {
        setOllamaStatus('offline');
      }

      try {
        const stats = await api.memory.stats();
        setMemoryStatus(stats.status !== 'unreachable' ? 'online' : 'offline');
      } catch {
        setMemoryStatus('offline');
      }
    };

    checkHealth();
    // Re-check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [setOllamaStatus, setMemoryStatus]);

  // Listen for agent:launch events from main process (when launched from standalone window)
  useEffect(() => {
    const api = getElectronAPI();
    const handler = (agentId: string) => {
      setSelectedAgentId(agentId);
      // Navigation happens via hash, the chat page reads selectedAgentId from store
    };
    api.on('agent:launch', handler);
    return () => api.off('agent:launch', handler);
  }, [setSelectedAgentId]);

  // Listen for agent-launcher:toggle from tray
  useEffect(() => {
    const api = getElectronAPI();
    const handler = () => setAgentLauncherOpen(true);
    api.on('agent-launcher:toggle', handler);
    return () => api.off('agent-launcher:toggle', handler);
  }, [setAgentLauncherOpen]);

  return (
    <HashRouter>
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Ambient Effects */}
        <ParticleCanvas />
        <div className="ambient-gradient-blue" />
        <div className="ambient-gradient-purple" />

        {/* Titlebar */}
        <Titlebar />

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          {/* Sidebar */}
          <AppSidebar />

          {/* Page Content */}
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/research" element={<ResearchPage />} />
                <Route path="/automation" element={<AutomationPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/launcher" element={<LauncherPage />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>

        {/* Command Palette (floating overlay) */}
        <CommandPalette />
        {/* Agent Launcher (Ctrl+Alt+Space overlay — also has standalone window) */}
        <AgentLauncher />
      </div>
    </HashRouter>
  );
}
