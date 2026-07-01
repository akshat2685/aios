import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, FlaskConical, Zap, Settings,
  Search, Trash2, RotateCcw, Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { getElectronAPI } from '@/lib/electron-api';

interface Command {
  id: string; name: string; category: string; icon: React.ReactNode; shortcut?: string; action: () => void;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const api = getElectronAPI();
  const { commandPaletteOpen, setCommandPaletteOpen } = useAppStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: 'nav-dashboard', name: 'Go to Dashboard', category: 'Navigation', icon: <LayoutDashboard size={16} />, shortcut: 'G D', action: () => { navigate('/'); close(); } },
    { id: 'nav-chat', name: 'Open Companion Chat', category: 'Navigation', icon: <MessageSquare size={16} />, shortcut: 'G C', action: () => { navigate('/chat'); close(); } },
    { id: 'nav-research', name: 'Open Research Lab', category: 'Navigation', icon: <FlaskConical size={16} />, shortcut: 'G R', action: () => { navigate('/research'); close(); } },
    { id: 'nav-automation', name: 'Open Automation Hub', category: 'Navigation', icon: <Zap size={16} />, shortcut: 'G A', action: () => { navigate('/automation'); close(); } },
    { id: 'nav-settings', name: 'Open Settings', category: 'Navigation', icon: <Settings size={16} />, shortcut: 'G S', action: () => { navigate('/settings'); close(); } },
    { id: 'sys-clear-memory', name: 'Clear Vector Memory', category: 'System', icon: <Trash2 size={16} />, action: async () => { await api.memory.clear(); close(); } },
    { id: 'sys-restart', name: 'Restart AIOS Kernel', category: 'System', icon: <RotateCcw size={16} />, action: () => { api.app.restart(); } },
    { id: 'sys-quit', name: 'Shutdown AIOS', category: 'System', icon: <Power size={16} />, shortcut: 'Ctrl Q', action: () => { api.app.quit(); } },
  ];

  const filtered = query ? commands.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())) : commands;
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  const close = useCallback(() => { setCommandPaletteOpen(false); setQuery(''); setSelectedIndex(0); }, [setCommandPaletteOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(!commandPaletteOpen); }
      if (e.key === 'Escape' && commandPaletteOpen) close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, setCommandPaletteOpen, close]);

  useEffect(() => { if (commandPaletteOpen) setTimeout(() => inputRef.current?.focus(), 50); }, [commandPaletteOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[selectedIndex]) { filtered[selectedIndex].action(); }
  };

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh]" onClick={close}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }} onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg glass-strong shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-glass-border">
              <Search size={16} className="text-muted-foreground" />
              <input ref={inputRef} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleKeyDown} placeholder="Type a command or search AIOS..." className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground" autoComplete="off" />
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-glass-strong border border-glass-border text-muted-foreground">ESC</kbd>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2">
              {Object.entries(grouped).map(([category, cmds]) => (
                <div key={category} className="mb-2">
                  <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{category}</div>
                  {cmds.map((cmd) => {
                    const flatIndex = filtered.indexOf(cmd);
                    return (
                      <motion.button key={cmd.id} whileHover={{ x: 2 }} onClick={cmd.action}
                        className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150',
                          flatIndex === selectedIndex ? 'bg-accent/15 text-accent' : 'text-foreground/80 hover:bg-glass-strong')}>
                        <span className="text-muted-foreground">{cmd.icon}</span>
                        <span className="flex-1 text-left">{cmd.name}</span>
                        {cmd.shortcut && <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-glass border border-glass-border text-muted-foreground">{cmd.shortcut}</kbd>}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
              {filtered.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">No commands found for "{query}"</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
