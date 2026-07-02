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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
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
    <motion.div variants={cardVariants} className="glass-interactive p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-accent" />
        <span className="text-sm font-medium">System Status</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('status-dot', ollamaStatus === 'online' ? 'online' : ollamaStatus === 'offline' ? 'offline' : 'thinking')} />
            <span className="text-xs text-muted-foreground">Ollama LLM</span>
          </div>
          <span className="hud-text text-success">{ollamaStatus.toUpperCase()}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('status-dot', memoryStatus === 'online' ? 'online' : memoryStatus === 'offline' ? 'offline' : 'thinking')} />
            <span className="text-xs text-muted-foreground">Qdrant Memory</span>
          </div>
          <span className="hud-text">{memoryStatus.toUpperCase()}</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-glass-border">
          <span className="text-xs text-muted-foreground">Session Uptime</span>
          <span className="font-mono text-xs text-accent">{formatUptime(uptime)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Kernel Version</span>
          <span className="hud-text">v0.1.0</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Agent Activity Card ─────────────────────────────────────
const agents = [
  { id: 'assistant', name: 'Assistant', icon: Sparkles, color: 'text-accent' },
  { id: 'coder', name: 'Coder', icon: Code2, color: 'text-secondary' },
  { id: 'researcher', name: 'Researcher', icon: FlaskConical, color: 'text-success' },
  { id: 'planner', name: 'Planner', icon: ListTodo, color: 'text-warning' },
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
    <motion.div variants={cardVariants} className="glass-interactive p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Brain size={16} className="text-secondary" />
        <span className="text-sm font-medium">Agent Swarm</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {agents.map((agent) => {
          const Icon = agent.icon;
          const status = agentStatuses[agent.id] || 'idle';

          return (
            <div
              key={agent.id}
              className="glass-subtle p-3 rounded-xl flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <Icon size={14} className={agent.color} />
                <span className="text-xs font-medium">{agent.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn('w-1.5 h-1.5 rounded-full', status === 'idle' ? 'bg-muted-foreground' : status === 'thinking' ? 'bg-warning animate-pulse-glow' : status === 'active' ? 'bg-success' : 'bg-danger')} />
                <span className={cn('hud-text', statusColor(status))}>{statusLabel(status)}</span>
              </div>
            </div>
          );
        })}
      </div>
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
    <motion.div variants={cardVariants} className="glass-interactive p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Database size={16} className="text-success" />
        <span className="text-sm font-medium">Vector Memory</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="text-2xl font-bold text-gradient-accent"
          >
            {stats.points.toLocaleString()}
          </motion.div>
          <span className="text-xs text-muted-foreground">Memory Points</span>
        </div>
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            className="text-2xl font-bold text-secondary"
          >
            {stats.vectors.toLocaleString()}
          </motion.div>
          <span className="text-xs text-muted-foreground">Vectors</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-glass-border">
        <HardDrive size={12} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Status: <span className={cn('uppercase', stats.status === 'green' || stats.status === 'ok' ? 'text-success' : 'text-muted-foreground')}>{stats.status}</span>
        </span>
      </div>
    </motion.div>
  );
}

// ─── Quick Actions Card ─────────────────────────────────────
function QuickActionsCard() {
  const api = getElectronAPI();

  const actions = [
    { label: 'New Chat', icon: MessageSquare, color: 'text-accent', href: '/chat' },
    { label: 'Research', icon: FlaskConical, color: 'text-success', href: '/research' },
    { label: 'Automate', icon: Zap, color: 'text-warning', href: '/automation' },
  ];

  return (
    <motion.div variants={cardVariants} className="glass-interactive p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Cpu size={16} className="text-warning" />
        <span className="text-sm font-medium">Quick Actions</span>
      </div>

      <div className="flex flex-col gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <motion.a
              key={action.label}
              href={`#${action.href}`}
              whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.04)' }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors border border-transparent hover:border-glass-border"
            >
              <Icon size={16} className={action.color} />
              <span className="text-sm">{action.label}</span>
            </motion.a>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Provider Network Card (Phase 6) ─────────────────────────
function ProviderNetworkCard() {
  const [states, setStates] = useState<Record<string, any>>({});
  const [stats, setStats] = useState<any>({ totalTokens: 0, byProvider: {}, byAgent: {} });
  const api = getElectronAPI();

  useEffect(() => {
    const fetchLLMData = async () => {
      try {
        const s = await api.llm.states();
        if (s) setStates(s);
        const t = await api.llm.trackerStats();
        if (t) setStats(t);
      } catch (e) {
        // fail silently
      }
    };
    fetchLLMData();
    const interval = setInterval(fetchLLMData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div variants={cardVariants} className="glass-interactive p-5 flex flex-col gap-4 col-span-1 md:col-span-2">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-accent" />
        <span className="text-sm font-medium">Provider Network & Circuit Breakers</span>
        <span className="ml-auto text-xs text-muted-foreground">Tokens: {stats.totalTokens?.toLocaleString()}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.keys(states).map((providerId) => {
          const s = states[providerId];
          const isTripped = s.rateLimited || !s.healthy;
          return (
            <div key={providerId} className="glass-subtle p-3 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium capitalize">{providerId}</span>
                <div className={cn('w-2 h-2 rounded-full', isTripped ? 'bg-danger animate-pulse' : 'bg-success')} />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-muted-foreground">429s: {s.consecutive429Count}</span>
                <span className="text-[10px] text-muted-foreground">
                  {s.cooldownUntil ? new Date(s.cooldownUntil).toLocaleTimeString() : 'Ready'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(stats.byAgent || {}).length > 0 && (
        <div className="mt-2 pt-3 border-t border-glass-border">
          <div className="text-xs font-medium mb-3 text-muted-foreground">Agent Token Budgets</div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.byAgent).map(([agentId, data]: [string, any]) => (
              <div key={agentId} className="flex items-center justify-between">
                <span className="text-xs capitalize">{agentId}</span>
                <span className="text-xs font-mono">{data.totalTokens?.toLocaleString()} / 50k</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
      className="h-full p-6 overflow-y-auto"
    >
      {/* Header */}
      <motion.div variants={cardVariants} className="mb-6">
        <h1 className="text-2xl font-semibold">
          Welcome to <span className="text-gradient-accent">AIOS</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your Personal AI Operating System — local-first, privacy-first
        </p>
      </motion.div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SystemStatusCard />
        <AgentActivityCard />
        <MemoryStatsCard />
        <QuickActionsCard />
        <ProviderNetworkCard />
      </div>
    </motion.div>
  );
}
