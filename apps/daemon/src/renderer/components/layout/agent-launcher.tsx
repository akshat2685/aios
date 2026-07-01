import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { getElectronAPI, type AdkAgent } from '@/lib/electron-api';

const AGENT_COLORS: Record<string, { gradient: string; glow: string; badge: string }> = {
  planner: { gradient: 'from-violet-500/20 to-purple-600/10', glow: 'shadow-violet-500/20', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/20' },
  research: { gradient: 'from-amber-500/20 to-orange-600/10', glow: 'shadow-amber-500/20', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/20' },
  coding: { gradient: 'from-emerald-500/20 to-green-600/10', glow: 'shadow-emerald-500/20', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' },
  website: { gradient: 'from-sky-500/20 to-blue-600/10', glow: 'shadow-sky-500/20', badge: 'bg-sky-500/15 text-sky-300 border-sky-500/20' },
  testing: { gradient: 'from-rose-500/20 to-pink-600/10', glow: 'shadow-rose-500/20', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/20' },
  security: { gradient: 'from-red-500/20 to-rose-600/10', glow: 'shadow-red-500/20', badge: 'bg-red-500/15 text-red-300 border-red-500/20' },
  docs: { gradient: 'from-cyan-500/20 to-teal-600/10', glow: 'shadow-cyan-500/20', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20' },
};

const DEFAULT_COLORS = { gradient: 'from-blue-500/20 to-indigo-600/10', glow: 'shadow-blue-500/20', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20' };

interface AgentLauncherProps {
  standalone?: boolean;
}

export function AgentLauncher({ standalone = false }: AgentLauncherProps) {
  const navigate = useNavigate();
  const api = getElectronAPI();
  const { agentLauncherOpen, setAgentLauncherOpen, setSelectedAgentId } = useAppStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [agents, setAgents] = useState<AdkAgent[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = standalone || agentLauncherOpen;

  // Load agents on mount
  useEffect(() => {
    api.agent.listAdkAgents().then(({ agents: list }) => setAgents(list));
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  const filtered = query
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.description.toLowerCase().includes(query.toLowerCase()) ||
          a.capabilities.some((c) => c.toLowerCase().includes(query.toLowerCase()))
      )
    : agents;

  const close = useCallback(() => {
    setAgentLauncherOpen(false);
    setQuery('');
    setSelectedIndex(0);
    if (standalone) api.launcher.hide();
  }, [setAgentLauncherOpen, standalone, api]);

  const launchAgent = useCallback(
    (agent: AdkAgent) => {
      setSelectedAgentId(agent.name);
      if (standalone) {
        // In standalone launcher window — tell main process to open main window
        api.agent.launch(agent.name);
      } else {
        // In main window — navigate directly
        navigate('/chat');
        close();
      }
    },
    [standalone, api, navigate, close, setSelectedAgentId]
  );

  // Keyboard handler for standalone (Escape closes)
  useEffect(() => {
    if (!standalone) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [standalone, close]);

  // Keyboard handler for inline mode
  useEffect(() => {
    if (standalone) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && agentLauncherOpen) close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [standalone, agentLauncherOpen, close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const cols = 3;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + cols, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - cols, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      launchAgent(filtered[selectedIndex]);
    }
  };

  const colors = (name: string) => AGENT_COLORS[name] || DEFAULT_COLORS;

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -20 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'w-full max-w-[660px] overflow-hidden',
        standalone
          ? 'h-full rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(9,9,11,0.92)] backdrop-blur-2xl shadow-2xl shadow-black/60'
          : 'rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(9,9,11,0.92)] backdrop-blur-2xl shadow-2xl shadow-black/60'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-blue-500/20">
          AI
        </div>
        <span className="text-sm font-semibold tracking-wide text-[#F4F4F5] flex-1" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
          AIOS Agents
        </span>
        <kbd className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[rgba(244,244,245,0.4)]">
          Ctrl+Alt+Space
        </kbd>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
        <Search size={14} className="text-[rgba(244,244,245,0.4)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search agents..."
          className="flex-1 bg-transparent outline-none text-sm text-[#F4F4F5] placeholder:text-[rgba(244,244,245,0.3)]"
          style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
          autoComplete="off"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[rgba(244,244,245,0.3)] hover:text-[rgba(244,244,245,0.6)] transition-colors">
            <X size={14} />
          </button>
        )}
        <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[rgba(244,244,245,0.4)]">
          ESC
        </kbd>
      </div>

      {/* Agent Grid */}
      <div className="p-4 overflow-y-auto" style={{ maxHeight: standalone ? 'calc(100% - 110px)' : '400px' }}>
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((agent, i) => {
            const c = colors(agent.name);
            const isSelected = i === selectedIndex;
            return (
              <motion.button
                key={agent.name}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => launchAgent(agent)}
                className={cn(
                  'relative flex flex-col items-start gap-2 p-4 rounded-2xl text-left transition-all duration-200',
                  'bg-gradient-to-br border',
                  c.gradient,
                  isSelected
                    ? 'border-[rgba(255,255,255,0.2)] shadow-lg ' + c.glow
                    : 'border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
                )}
              >
                {/* Icon */}
                <span className="text-2xl leading-none">{agent.icon}</span>

                {/* Name */}
                <span
                  className="text-sm font-semibold text-[#F4F4F5] capitalize"
                  style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
                >
                  {agent.name}
                </span>

                {/* Description */}
                <span
                  className="text-[11px] leading-snug text-[rgba(244,244,245,0.5)]"
                  style={{ fontFamily: 'Outfit, system-ui, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                >
                  {agent.description}
                </span>

                {/* Capability badges */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {agent.capabilities.slice(0, 2).map((cap) => (
                    <span
                      key={cap}
                      className={cn('px-1.5 py-0.5 rounded-md text-[9px] font-medium border', c.badge)}
                    >
                      {cap.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {agent.capabilities.length > 2 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-[rgba(255,255,255,0.04)] text-[rgba(244,244,245,0.3)] border border-[rgba(255,255,255,0.06)]">
                      +{agent.capabilities.length - 2}
                    </span>
                  )}
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="agent-selector"
                    className="absolute inset-0 rounded-2xl border-2 border-[rgba(59,130,246,0.4)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-[rgba(244,244,245,0.3)] text-sm" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
            No agents match "{query}"
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)]">
          <span className="text-[10px] text-[rgba(244,244,245,0.25)] font-mono">
            ↑↓←→ Navigate
          </span>
          <span className="text-[10px] text-[rgba(244,244,245,0.25)] font-mono">
            ⏎ Launch
          </span>
          <span className="text-[10px] text-[rgba(244,244,245,0.25)] font-mono">
            ESC Close
          </span>
        </div>
      </div>
    </motion.div>
  );

  // Standalone mode — always render (the BrowserWindow controls visibility)
  if (standalone) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'transparent' }}>
        {content}
      </div>
    );
  }

  // Inline mode — AnimatePresence controls visibility
  return (
    <AnimatePresence>
      {agentLauncherOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[998] flex items-start justify-center pt-[12vh]"
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
