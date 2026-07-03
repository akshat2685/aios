import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Cpu, HardDrive, Brain, Network, TerminalSquare } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

export default function ActivityMonitorPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [tokens, setTokens] = useState<any>({});
  const { agentStatuses } = useAppStore();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // 2s refresh for activity monitor
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const api = getElectronAPI();
      const sys = await api.system.metrics();
      const llm = await api.llm.trackerStats();
      if (sys) setMetrics(sys);
      if (llm) setTokens(llm);
    } catch (e) {}
  };

  const activeAgents = Object.entries(agentStatuses).filter(([_, status]) => status !== 'idle');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full p-6 flex flex-col overflow-auto"
    >
      <motion.div variants={cardVariants} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Activity className="text-accent" /> Activity Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time system performance, token usage, and active tasks.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div variants={cardVariants} className="glass-interactive p-5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Cpu size={16} /> CPU Usage
          </div>
          <div className="text-3xl font-mono text-accent">
            {metrics ? Math.round(metrics.cpuUsage) : 0}%
          </div>
          <div className="w-full bg-glass-strong h-2 rounded-full overflow-hidden">
            <div className="bg-accent h-full transition-all duration-500" style={{ width: `${metrics?.cpuUsage || 0}%` }} />
          </div>
        </motion.div>

        <motion.div variants={cardVariants} className="glass-interactive p-5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <HardDrive size={16} /> Memory (RAM)
          </div>
          <div className="text-3xl font-mono text-secondary">
            {metrics ? Math.round((metrics.totalMem - metrics.freeMem) / 1024 / 1024 / 1024 * 10) / 10 : 0} GB
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Used</span>
            <span>{metrics ? Math.round(metrics.totalMem / 1024 / 1024 / 1024) : 0} GB Total</span>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} className="glass-interactive p-5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Brain size={16} /> Global Token Usage
          </div>
          <div className="text-3xl font-mono text-success">
            {tokens?.totalTokens?.toLocaleString() || 0}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-success-dim bg-success/10 px-1.5 py-0.5 rounded">All Providers</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <motion.div variants={cardVariants} className="glass border border-glass-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-glass-border bg-glass-subtle flex items-center gap-2 text-sm font-medium">
            <TerminalSquare size={16} className="text-accent" /> Active Agents
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {activeAgents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground italic">
                All agents are idle.
              </div>
            ) : activeAgents.map(([id, status]) => (
              <div key={id} className="flex items-center justify-between p-3 rounded-lg bg-glass-subtle border border-glass-border">
                <div className="capitalize font-medium text-sm">{id}</div>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", status === 'active' ? 'bg-success' : 'bg-warning animate-pulse-glow')} />
                  <span className="text-xs uppercase font-mono tracking-wider">{status}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={cardVariants} className="glass border border-glass-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-glass-border bg-glass-subtle flex items-center gap-2 text-sm font-medium">
            <Network size={16} className="text-secondary" /> Token Budgets by Agent
          </div>
          <div className="flex-1 overflow-auto p-4">
             {Object.keys(tokens?.byAgent || {}).length === 0 ? (
               <div className="h-full flex items-center justify-center text-sm text-muted-foreground italic">
                 No token usage recorded yet.
               </div>
             ) : (
               <div className="space-y-4">
                 {Object.entries(tokens.byAgent).map(([agentId, data]: [string, any]) => (
                   <div key={agentId} className="space-y-2">
                     <div className="flex justify-between text-sm">
                       <span className="capitalize">{agentId}</span>
                       <span className="font-mono text-muted-foreground">{data.totalTokens?.toLocaleString()}</span>
                     </div>
                     <div className="w-full bg-glass-strong h-1.5 rounded-full overflow-hidden">
                       <div className="bg-secondary h-full" style={{ width: `${Math.min((data.totalTokens / 50000) * 100, 100)}%` }} />
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
