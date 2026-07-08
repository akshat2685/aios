import { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Titlebar } from '@/components/layout/titlebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { AgentLauncher } from '@/components/layout/agent-launcher';
import { ApprovalModal } from '@/components/layout/approval-modal';
import { StatusBar } from '@/components/layout/status-bar';
import { NotificationCenter } from '@/components/layout/notification-center';
import { ParticleCanvas } from '@/components/effects/particle-canvas';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { getElectronAPI } from '@/lib/electron-api';
import DashboardPage from '@/pages/dashboard';
import ChatPage from '@/pages/chat';
import ResearchPage from '@/pages/research';
import AutomationPage from '@/pages/automation';
import SettingsPage from '@/pages/settings';
import LauncherPage from '@/pages/launcher';
import OverlayPage from '@/pages/overlay';
import MemoryPage from '@/pages/memory';
import { ProjectsPage } from '@/pages/projects';
import DiagnosticsPage from '@/pages/diagnostics';
import SecurityPage from '@/pages/security';
import PluginsPage from '@/pages/plugins';
import ActivityMonitorPage from '@/pages/activity';
import BrainMapPage from '@/pages/brain-map';
import TwinPage from '@/pages/twin-page';
import SandboxPage from '@/pages/sandbox-page';
import FederationPage from '@/pages/federation-page';
import OfflinePage from '@/pages/offline-page';

function AppLayout() {
  const location = useLocation();
  const isLauncher = location.pathname === '/launcher' || location.pathname === '/overlay';

  if (isLauncher) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-transparent">
        <Routes>
          <Route path="/launcher" element={<LauncherPage />} />
          <Route path="/overlay" element={<OverlayPage />} />
        </Routes>
      </div>
    );
  }

  return (
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
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/research" element={<ResearchPage />} />
              <Route path="/automation" element={<AutomationPage />} />
              <Route path="/plugins" element={<PluginsPage />} />
              <Route path="/memory" element={<MemoryPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/diagnostics" element={<DiagnosticsPage />} />
              <Route path="/activity" element={<ActivityMonitorPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/brain-map" element={<BrainMapPage />} />
              <Route path="/digital-twin" element={<TwinPage />} />
              <Route path="/sandbox" element={<SandboxPage />} />
              <Route path="/federation" element={<FederationPage />} />
              <Route path="/offline-ai" element={<OfflinePage />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>

      {/* Global Overlays */}
      <CommandPalette />
      <AgentLauncher />
      <ApprovalModal />
      <NotificationCenter />

      {/* Footer Status Bar */}
      <StatusBar />
    </div>
  );
}

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

  // Sync model with cloud mode
  useEffect(() => {
    const syncModel = async () => {
      const { cloudMode } = useAppStore.getState();
      const chatStore = useChatStore.getState();
      const current = chatStore.selectedModel;
      
      if (cloudMode === 'local') {
        // If current model is already a typical local model (no gpt, gemini, claude), keep it
        if (!current || current.includes('gpt-') || current.includes('gemini-') || current.includes('claude-')) {
          try {
            const api = getElectronAPI();
            const models = await api.system.ollamaModels();
            if (models && models.length > 0) {
              chatStore.setSelectedModel(models[0].name);
            } else {
              chatStore.setSelectedModel('llama3.2:latest');
            }
          } catch {
            chatStore.setSelectedModel('llama3.2:latest');
          }
        }
      } else {
        // If switching to cloud and current is a typical local model, pick a cloud default
        if (!current || !current.includes('-')) {
           chatStore.setSelectedModel('gemini-1.5-flash');
        }
      }
    };
    syncModel();
  }, [useAppStore.getState().cloudMode]);

  // Listen for agent:launch events from main process
  useEffect(() => {
    const api = getElectronAPI();
    const handler = (agentId: string) => {
      setSelectedAgentId(agentId);
      const chatStore = useChatStore.getState();
      const newConvId = chatStore.createConversation(agentId);
      chatStore.setActiveConversation(newConvId);
      // Navigation happens via hash
      window.location.hash = '#/chat';
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
      <AppLayout />
    </HashRouter>
  );
}
