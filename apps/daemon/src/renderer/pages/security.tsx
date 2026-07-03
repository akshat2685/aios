import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Shield, Trash2, ShieldOff, AlertTriangle } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { cn } from '@/lib/utils';
import * as Tabs from '@radix-ui/react-tabs';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

export default function SecurityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [rules, setRules] = useState<{ persistent: any[]; session: any[] }>({ persistent: [], session: [] });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const api = getElectronAPI();
      const [fetchedLogs, fetchedRules] = await Promise.all([
        api.security.getAuditLogs(100),
        api.security.getRules()
      ]);
      setLogs(fetchedLogs);
      setRules(fetchedRules);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRule = async (id: string, type: 'persistent' | 'session') => {
    const api = getElectronAPI();
    await api.security.deleteRule(id, type);
    fetchData();
  };

  const getDecisionColor = (decision: string) => {
    if (decision.includes('allow')) return 'text-success bg-success/10 border-success/20';
    if (decision.includes('deny')) return 'text-danger bg-danger/10 border-danger/20';
    return 'text-muted-foreground bg-glass-subtle border-glass-border';
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full p-6 flex flex-col"
    >
      <motion.div variants={cardVariants} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Shield className="text-accent" /> Security Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage AIOS GuardRails, permissions, and audit logs.
          </p>
        </div>
      </motion.div>

      <Tabs.Root defaultValue="audit" className="flex-1 flex flex-col min-h-0">
        <Tabs.List className="flex border-b border-glass-border mb-6">
          <Tabs.Trigger value="audit" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent transition-colors">
            Audit Logs
          </Tabs.Trigger>
          <Tabs.Trigger value="rules" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent transition-colors">
            Active Rules
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="audit" className="flex-1 overflow-auto outline-none">
          <motion.div variants={cardVariants} className="glass border border-glass-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-glass-strong text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Decision</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border font-mono text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No audit logs found.</td>
                  </tr>
                ) : logs.map((log, i) => (
                  <tr key={i} className="hover:bg-glass-hover transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-secondary">{log.agentId}</td>
                    <td className="px-4 py-3 text-accent">{log.action}</td>
                    <td className="px-4 py-3 truncate max-w-[200px]" title={log.target}>{log.target}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full border", getDecisionColor(log.decision))}>
                        {log.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full border uppercase", log.risk === 'CRITICAL' || log.risk === 'HIGH' ? 'text-danger border-danger/50' : 'text-warning border-warning/50')}>
                        {log.risk || 'UNKNOWN'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </Tabs.Content>

        <Tabs.Content value="rules" className="flex-1 overflow-auto outline-none space-y-6">
          {/* Persistent Rules */}
          <motion.div variants={cardVariants}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-success" /> Persistent Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.persistent.length === 0 ? (
                <div className="col-span-full p-6 glass-subtle rounded-xl text-center text-sm text-muted-foreground">
                  No persistent rules configured.
                </div>
              ) : rules.persistent.map((rule: any) => (
                <div key={rule.id} className="glass-interactive p-4 flex flex-col gap-3 relative group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", rule.decision === 'allow' ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.6)]')} />
                      <span className="text-sm font-medium uppercase tracking-wider">{rule.decision}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteRule(rule.id, 'persistent')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-danger p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="font-mono text-xs space-y-1">
                    <div><span className="text-muted-foreground">Agent:</span> <span className="text-secondary">{rule.agentId}</span></div>
                    <div><span className="text-muted-foreground">Action:</span> <span className="text-accent">{rule.action}</span></div>
                    <div className="truncate" title={rule.target}><span className="text-muted-foreground">Target:</span> {rule.target}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Session Rules */}
          <motion.div variants={cardVariants}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ShieldAlert size={16} className="text-warning" /> Session Rules
              <span className="text-xs font-normal text-muted-foreground ml-2">(Cleared on restart)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.session.length === 0 ? (
                <div className="col-span-full p-6 glass-subtle rounded-xl text-center text-sm text-muted-foreground">
                  No session rules configured.
                </div>
              ) : rules.session.map((rule: any) => (
                <div key={rule.id} className="glass-interactive p-4 flex flex-col gap-3 relative group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", rule.decision === 'allow' ? 'bg-success' : 'bg-danger')} />
                      <span className="text-sm font-medium uppercase tracking-wider">{rule.decision}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteRule(rule.id, 'session')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-danger p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="font-mono text-xs space-y-1">
                    <div><span className="text-muted-foreground">Agent:</span> <span className="text-secondary">{rule.agentId}</span></div>
                    <div><span className="text-muted-foreground">Action:</span> <span className="text-accent">{rule.action}</span></div>
                    <div className="truncate" title={rule.target}><span className="text-muted-foreground">Target:</span> {rule.target}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </Tabs.Content>
      </Tabs.Root>
    </motion.div>
  );
}
