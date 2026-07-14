import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, FlaskConical, Zap, Settings,
  PanelLeftClose, PanelLeft, Database, FolderGit, ActivitySquare,
  Brain, User, Globe, Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { GlassNavItem, GlassContainer } from '@aios/ui';

const navItems = [
  { id: 'dashboard', path: '/', label: 'Home', icon: LayoutDashboard },
  { id: 'chat', path: '/chat', label: 'Chats', icon: MessageSquare },
  { id: 'memory', path: '/memory', label: 'Memory', icon: Database },
  { id: 'automation', path: '/automation', label: 'Automation', icon: Zap },
  { id: 'plugins', path: '/plugins', label: 'Plugins', icon: FolderGit },
  { id: 'security', path: '/security', label: 'Security', icon: ActivitySquare },
  { id: 'diagnostics', path: '/diagnostics', label: 'Diagnostics', icon: ActivitySquare },
  { id: 'activity', path: '/activity', label: 'Activity Monitor', icon: ActivitySquare },
  { id: 'brain-map', path: '/brain-map', label: 'Brain Map', icon: Brain },
  { id: 'digital-twin', path: '/digital-twin', label: 'Digital Twin', icon: User },
  { id: 'sandbox', path: '/sandbox', label: 'Sandbox', icon: FlaskConical },
  { id: 'federation', path: '/federation', label: 'Federation', icon: Globe },
  { id: 'offline-ai', path: '/offline-ai', label: 'Offline AI', icon: Cpu },
];

const bottomItems = [
  { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, ollamaStatus } = useAppStore();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const renderNavButton = (item: typeof navItems[0]) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <GlassNavItem
        key={item.id}
        active={active}
        onClick={() => navigate(item.path)}
        className="w-full text-left"
        title={sidebarCollapsed ? item.label : undefined}
      >
        <Icon size={18} className={cn(active && 'text-accent drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]', 'flex-shrink-0')} />
        {!sidebarCollapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium truncate">
            {item.label}
          </motion.span>
        )}
      </GlassNavItem>
    );
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.4, type: 'spring', bounce: 0.15 }}
      className="h-full glass-strong border-r border-glass-border flex flex-col no-select relative z-10 overflow-hidden"
    >
      {/* Brand */}
      <div className="p-4 flex items-center gap-3 border-b border-glass-border min-h-[64px]">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center text-xs font-bold text-white shadow-purple-glow ring-1 ring-white/20">AI</div>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent to-secondary opacity-50 blur-xl z-[-1]" />
        </div>
        {!sidebarCollapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col flex-1 overflow-hidden">
            <span className="font-bold text-sm tracking-widest text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">AIOS</span>
            <span className="text-[10px] text-white/50 tracking-wider">LIQUID ENGINE</span>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 flex flex-col gap-1.5 scrollbar-hide">
        {navItems.map(renderNavButton)}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-3 pt-2 border-t border-glass-border flex flex-col gap-1.5 bg-black/10">
        {bottomItems.map(renderNavButton)}
        <GlassNavItem
          onClick={toggleSidebar}
          className="w-full text-left"
          title="Toggle Sidebar"
        >
          {sidebarCollapsed ? <PanelLeft size={18} className="flex-shrink-0 text-white/60" /> : <PanelLeftClose size={18} className="flex-shrink-0 text-white/60" />}
          {!sidebarCollapsed && <span className="text-sm font-medium">Collapse</span>}
        </GlassNavItem>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-glass-border flex items-center gap-3 bg-black/20 backdrop-blur-md">
        <div className={cn('status-dot flex-shrink-0', ollamaStatus === 'online' ? 'online' : ollamaStatus === 'offline' ? 'offline' : 'thinking')} />
        {!sidebarCollapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hud-text truncate">
            {ollamaStatus === 'online' ? 'SYSTEM ONLINE' : ollamaStatus === 'offline' ? 'OFFLINE MODE' : 'INITIALIZING...'}
          </motion.span>
        )}
      </div>
    </motion.aside>
  );
}
