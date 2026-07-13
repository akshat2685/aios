import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Database,
  Cpu,
  Brain,
  Code2,
  FlaskConical,
  ListTodo,
  Sparkles,
  MessageSquare,
  Zap,
  HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type AgentStatus } from '@/stores/app-store';
import { getElectronAPI } from '@/lib/electron-api';
import { GlassPanel, GlassContainer, GlassButton } from '../components/ui/glass';

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const cardVariants: any = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

// ─── System Status Card ─────────────────────────────────────
function SystemStatusCard() {
  const { ollamaStatus, memoryStatus } = useAppStore();
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => setUptime(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div variants={cardVariants}>
      <GlassPanel interactive className="h-full">
        <div className="flex items-center gap-3 border-b border-glass-border pb-3">
          <div className="p-2 rounded-xl bg-accent/20 text-accent">
            <Activity size={18} />
          </div>
          <span className="text-base font-semibold tracking-wide">System Status</span>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('status-dot', ollamaStatus === 'online' ? 'online' : ollamaStatus === 'offline' ? 'offline' : 'thinking')} />
              <span className="text-sm text-muted-foreground">Ollama LLM Engine</span>
            </div>
            <span className="hud-text text-success tracking-widest">{ollamaStatus.toUpperCase()}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('status-dot', memoryStatus === 'online' ? 'online' : memoryStatus === 'offline' ? 'offline' : 'thinking')} />
              <span className="text-sm text-muted-foreground">Qdrant Vector Memory</span>
            </div>
            <span className="hud-text tracking-widest">{memoryStatus.toUpperCase()}</span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-glass-border">
            <span className="text-sm text-muted-foreground">Session Uptime</span>
            <span className="font-mono text-sm text-accent font-bold tracking-wider">{formatUptime(uptime)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Kernel Version</span>
            <span className="hud-text">v0.1.0</span>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

// ─── Agent Activity Card ─────────────────────────────────────
const agents = [
  { id: 'assistant', name: 'Assistant', icon: Sparkles, color: 'text-accent', bg: 'bg-accent/10' },
  { id: 'coder', name: 'Coder', icon: Code2, color: 'text-secondary', bg: 'bg-secondary/10' },
  { id: 'researcher', name: 'Researcher', icon: FlaskConical, color: 'text-success', bg: 'bg-success/10' },
  { id: 'planner', name: 'Planner', icon: ListTodo, color: 'text-warning', bg: 'bg-warning/10' },
];

function AgentActivityCard() {
  const { agentStatuses } = useAppStore();

  const statusLabel = (s: AgentStatus) => {
    switch (s) {
      case 'idle': return 'STANDBY';
      case 'thinking': return 'THINKING';
      case 'active': return 'ACTIVE';
      case 'error': return 'ERROR';
    }
  };

  const statusColor = (s: AgentStatus) => {
    switch (s) {
      case 'idle': return 'text-muted-foreground';
      case 'thinking': return 'text-warning';
      case 'active': return 'text-success';
      case 'error': return 'text-danger';
    }
  };

  return (
    <motion.div variants={cardVariants}>
      <GlassPanel interactive className="h-full">
        <div className="flex items-center gap-3 border-b border-glass-border pb-3">
          <div className="p-2 rounded-xl bg-secondary/20 text-secondary">
            <Brain size={18} />
          </div>
          <span className="text-base font-semibold tracking-wide">Agent Swarm</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const status = agentStatuses[agent.id] || 'idle';

            return (
              <GlassContainer
                key={agent.id}
                intensity="subtle"
                className="p-3.5 rounded-xl flex flex-col gap-3 border border-white/5"
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-1.5 rounded-lg", agent.bg)}>
                    <Icon size={14} className={agent.color} />
                  </div>
                  <span className="text-sm font-medium">{agent.name}</span>
                </div>
                <div className="flex items-center gap-2 pl-1">
                  <div className={cn('w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]', status === 'idle' ? 'bg-muted-foreground text-muted-foreground/30' : status === 'thinking' ? 'bg-warning text-warning animate-pulse-glow' : status === 'active' ? 'bg-success text-success' : 'bg-danger text-danger')} />
                  <span className={cn('hud-text', statusColor(status))}>{statusLabel(status)}</span>
                </div>
              </GlassContainer>
            );
          })}
        </div>
      </GlassPanel>
    </motion.div>
  );
}

// ─── Memory Stats Card ─────────────────────────────────────
function MemoryStatsCard() {
  const [stats, setStats] = useState({ points: 0, vectors: 0, status: 'checking' });

  useEffect(() => {
    const api = getElectronAPI();
    api.memory.stats().then(setStats).catch(() => setStats({ points: 0, vectors: 0, status: 'error' }));
  }, []);

  return (
    <motion.div variants={cardVariants}>
      <GlassPanel interactive className="h-full">
        <div className="flex items-center gap-3 border-b border-glass-border pb-3">
          <div className="p-2 rounded-xl bg-success/20 text-success">
            <Database size={18} />
          </div>
          <span className="text-base font-semibold tracking-wide">Vector Memory</span>
        </div>

        <div className="grid grid-cols-2 gap-6 pt-6 pb-2">
          <div className="text-center flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-accent/5 blur-xl rounded-full" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
              className="text-4xl font-bold text-gradient-accent mb-1 relative z-10"
            >
              {stats.points.toLocaleString()}
            </motion.div>
            <span className="text-xs tracking-widest uppercase text-muted-foreground relative z-10">Data Points</span>
          </div>
          <div className="text-center flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-secondary/5 blur-xl rounded-full" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
              className="text-4xl font-bold text-secondary mb-1 relative z-10"
            >
              {stats.vectors.toLocaleString()}
            </motion.div>
            <span className="text-xs tracking-widest uppercase text-muted-foreground relative z-10">Vectors</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-glass-border">
          <HardDrive size={14} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Status: <span className={cn('uppercase font-bold tracking-wider', stats.status === 'green' || stats.status === 'ok' ? 'text-success' : 'text-muted-foreground')}>{stats.status}</span>
          </span>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

// ─── Quick Actions Card ─────────────────────────────────────
function QuickActionsCard() {
  const actions = [
    { label: 'New Chat Session', icon: MessageSquare, variant: 'accent' as const, href: '#/chat' },
    { label: 'Deep Research', icon: FlaskConical, variant: 'success' as const, href: '#/research' },
    { label: 'Create Automation', icon: Zap, variant: 'warning' as const, href: '#/automation' },
  ];

  return (
    <motion.div variants={cardVariants}>
      <GlassPanel interactive className="h-full">
        <div className="flex items-center gap-3 border-b border-glass-border pb-3">
          <div className="p-2 rounded-xl bg-warning/20 text-warning">
            <Cpu size={18} />
          </div>
          <span className="text-base font-semibold tracking-wide">Quick Actions</span>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <a key={action.label} href={action.href} className="block outline-none">
                <GlassButton variant={action.variant} className="w-full justify-start gap-3 py-4">
                  <Icon size={18} />
                  <span className="font-semibold tracking-wide">{action.label}</span>
                </GlassButton>
              </a>
            );
          })}
        </div>
      </GlassPanel>
    </motion.div>
  );
}

// ─── Provider Network Card ─────────────────────────
function ProviderNetworkCard() {
  const [states, setStates] = useState<Record<string, any>>({});
  const [stats, setStats] = useState<any>({ totalTokens: 0, byProvider: {}, byAgent: {} });

  useEffect(() => {
    const api = getElectronAPI();
    const fetchLLMData = async () => {
      try {
        const s = await api.llm.states();
        if (s) setStates(s);
        const t = await api.llm.trackerStats();
        if (t) setStats(t);
      } catch (e) {}
    };
    fetchLLMData();
    const interval = setInterval(fetchLLMData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div variants={cardVariants} className="col-span-1 xl:col-span-2">
      <GlassPanel interactive className="h-full">
        <div className="flex items-center gap-3 border-b border-glass-border pb-3">
          <div className="p-2 rounded-xl bg-accent/20 text-accent">
            <Zap size={18} />
          </div>
          <span className="text-base font-semibold tracking-wide">Provider Network & Circuit Breakers</span>
          <div className="ml-auto flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Total Tokens</span>
            <span className="text-sm font-bold text-accent">{stats.totalTokens?.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {Object.keys(states).map((providerId) => {
            const s = states[providerId];
            const isTripped = s.rateLimited || !s.healthy;
            return (
              <GlassContainer key={providerId} intensity="subtle" className="p-4 rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold capitalize tracking-wide text-white/90">{providerId}</span>
                  <div className={cn('w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor]', isTripped ? 'bg-danger text-danger animate-pulse' : 'bg-success text-success')} />
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <span className={cn(isTripped ? 'text-danger' : 'text-success')}>{isTripped ? 'TRIPPED' : 'HEALTHY'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">429s</span>
                    <span className="text-white/80">{s.consecutive429Count}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Cooldown</span>
                    <span className="text-white/80">{s.cooldownUntil ? new Date(s.cooldownUntil).toLocaleTimeString() : 'Ready'}</span>
                  </div>
                </div>
              </GlassContainer>
            );
          })}
        </div>

        {Object.keys(stats.byAgent || {}).length > 0 && (
          <div className="mt-4 pt-4 border-t border-glass-border">
            <div className="text-xs font-bold tracking-widest uppercase mb-4 text-muted-foreground">Agent Token Budgets</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.byAgent).map(([agentId, data]: [string, any]) => (
                <div key={agentId} className="flex flex-col gap-1 p-3 rounded-lg bg-black/20 border border-white/5">
                  <span className="text-xs font-semibold capitalize text-white/80">{agentId}</span>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                    <motion.div 
                      className="bg-accent h-full" 
                      initial={{ width: 0 }} 
                      animate={{ width: `${Math.min(((data.totalTokens || 0) / 50000) * 100, 100)}%` }} 
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground mt-1 text-right">{data.totalTokens?.toLocaleString()} / 50k</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassPanel>
    </motion.div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────
export default function DashboardPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full p-8 overflow-y-auto scrollbar-hide relative"
    >
      {/* Dynamic Morphing & Blur Layers for Liquid Glass UX */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.25, 0.15],
            rotate: [0, 90, 0],
            borderRadius: ["40%", "60%", "40%"]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute w-[40vw] h-[40vw] bg-accent/30 blur-[120px] -top-20 -left-20 mix-blend-screen"
        />
        <motion.div 
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.2, 0.1],
            rotate: [0, -90, 0],
            borderRadius: ["60%", "40%", "60%"]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute w-[50vw] h-[50vw] bg-secondary/20 blur-[120px] -bottom-40 -right-20 mix-blend-screen"
        />
        <motion.div 
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.15, 0.05],
            x: ["-10%", "10%", "-10%"],
            y: ["-10%", "10%", "-10%"]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[60vw] h-[30vw] bg-success/10 rounded-[100%] blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
        />
        {/* Subtle noise overlay to enhance the glassmorphism feel */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-20 mix-blend-overlay"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <motion.div variants={cardVariants} className="mb-10 text-center md:text-left flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              Welcome to <span className="text-gradient-accent drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">AIOS</span>
            </h1>
            <p className="text-lg text-muted-foreground tracking-wide font-light">
              Your Personal AI Operating System — local-first, privacy-first
            </p>
          </div>
          <div className="hidden md:flex p-4 rounded-2xl glass-subtle border-white/10">
             <div className="text-right">
               <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">LOCAL TIME</div>
               <div className="text-xl font-mono text-white/90 font-semibold">{new Date().toLocaleTimeString()}</div>
             </div>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 pb-20">
          <SystemStatusCard />
          <AgentActivityCard />
          <MemoryStatsCard />
          <QuickActionsCard />
          <ProviderNetworkCard />
        </div>
      </div>
    </motion.div>
  );
}
