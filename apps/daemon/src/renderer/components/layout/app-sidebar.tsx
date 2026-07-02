import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, FlaskConical, Zap, Settings,
  PanelLeftClose, PanelLeft, Database, FolderGit, ActivitySquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

const navItems = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', path: '/chat', label: 'Companion Chat', icon: MessageSquare },
  { id: 'projects', path: '/projects', label: 'Projects', icon: FolderGit },
  { id: 'research', path: '/research', label: 'Research Lab', icon: FlaskConical },
  { id: 'automation', path: '/automation', label: 'Automation', icon: Zap },
  { id: 'memory', path: '/memory', label: 'Memory', icon: Database },
  { id: 'diagnostics', path: '/diagnostics', label: 'Diagnostics', icon: ActivitySquare },
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
      <motion.button
        key={item.id}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(item.path)}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left w-full',
          active
            ? 'bg-accent/15 text-accent border border-accent/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-glass-strong border border-transparent'
        )}
      >
        <Icon size={18} className={cn(active && 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]')} />
        {!sidebarCollapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium truncate">
            {item.label}
          </motion.span>
        )}
      </motion.button>
    );
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 60 : 220 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="h-full glass-strong border-r border-glass-border flex flex-col no-select relative z-10 overflow-hidden"
    >
      {/* Brand */}
      <div className="p-4 flex items-center gap-3 border-b border-glass-border min-h-[60px]">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-secondary flex items-center justify-center text-xs font-bold text-white">AI</div>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent to-secondary opacity-40 blur-lg" />
        </div>
        {!sidebarCollapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
            <span className="font-semibold text-sm tracking-wide">AIOS</span>
            <span className="text-[10px] text-muted-foreground">v0.1.0</span>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 flex flex-col gap-1">
        {navItems.map(renderNavButton)}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-2 flex flex-col gap-1">
        {bottomItems.map(renderNavButton)}
        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          onClick={toggleSidebar}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-glass-strong transition-all duration-200 w-full"
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          {!sidebarCollapsed && <span className="text-sm font-medium">Collapse</span>}
        </motion.button>
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-glass-border flex items-center gap-2">
        <div className={cn('status-dot', ollamaStatus === 'online' ? 'online' : ollamaStatus === 'offline' ? 'offline' : 'thinking')} />
        {!sidebarCollapsed && (
          <span className="hud-text">
            {ollamaStatus === 'online' ? 'OLLAMA ONLINE' : ollamaStatus === 'offline' ? 'OLLAMA OFFLINE' : 'CHECKING...'}
          </span>
        )}
      </div>
    </motion.aside>
  );
}
