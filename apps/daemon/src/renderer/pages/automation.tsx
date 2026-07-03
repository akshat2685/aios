import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Play, Clock, BoxSelect, Link as LinkIcon, MoreVertical, CheckCircle2 } from 'lucide-react';
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

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [triggers, setTriggers] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const api = getElectronAPI();
      const wfs = await api.workflow.list();
      setWorkflows(wfs);
      // Wait for backend trigger IPC if available.
      const trs = (await api.workflow.triggers?.()) || [];
      setTriggers(trs);
    } catch (e) {}
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
            <Zap className="text-warning fill-warning/20" /> Workflow Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and monitor automated state-machine workflows.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-warning/10 text-warning hover:bg-warning hover:text-black transition-colors rounded-lg text-sm font-medium border border-warning/20">
          <Play size={16} /> New Workflow
        </button>
      </motion.div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Sidebar: Triggers & Workflows */}
        <div className="w-80 flex flex-col gap-6">
          <motion.div variants={cardVariants} className="flex-1 glass border border-glass-border rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-glass-border bg-glass-subtle">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <BoxSelect size={16} className="text-accent" /> Active Workflows
              </h3>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {workflows.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No workflows defined.</div>
              ) : workflows.map((wf, i) => (
                <button key={i} className="w-full text-left p-3 rounded-lg hover:bg-glass-hover transition-colors flex flex-col gap-1">
                  <div className="font-medium text-sm flex justify-between">
                    {wf.name}
                    <span className="text-[10px] bg-success/20 text-success px-1.5 rounded-sm">IDLE</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{wf.description || "No description"}</div>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div variants={cardVariants} className="h-1/3 glass border border-glass-border rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-glass-border bg-glass-subtle flex justify-between items-center">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock size={16} className="text-secondary" /> Automation Triggers
              </h3>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {triggers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No active triggers.</div>
              ) : triggers.map((t, i) => (
                <div key={i} className="p-3 text-sm text-muted-foreground">Trigger active</div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Main Area: Execution Visualization */}
        <motion.div variants={cardVariants} className="flex-1 glass border border-glass-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-glass-border bg-glass-subtle flex justify-between items-center">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <LinkIcon size={16} /> Execution Visualization
            </h3>
            <button className="text-muted-foreground hover:text-foreground"><MoreVertical size={16}/></button>
          </div>
          <div className="flex-1 p-8 flex flex-col items-center justify-center relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-glass-hover to-transparent">
            
            {/* Mock Visual Node Builder Layout */}
            <div className="flex flex-col items-center gap-6 w-full max-w-md">
              <div className="w-full p-4 glass-strong border border-glass-border rounded-xl flex items-center gap-4 shadow-xl">
                <div className="w-10 h-10 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="text-sm font-medium">Cron Trigger</div>
                  <div className="text-xs text-muted-foreground">Runs every 1 hour</div>
                </div>
              </div>
              
              <div className="h-6 border-l-2 border-dashed border-glass-border" />
              
              <div className="w-full p-4 glass-strong border border-accent/30 rounded-xl flex items-center gap-4 shadow-xl shadow-accent/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-accent/5 animate-pulse-glow" />
                <div className="w-10 h-10 rounded-lg bg-accent/20 text-accent flex items-center justify-center z-10">
                  <Zap size={20} />
                </div>
                <div className="z-10">
                  <div className="text-sm font-medium text-accent">Workflow Execution</div>
                  <div className="text-xs text-muted-foreground">State: Extracting Data...</div>
                </div>
              </div>
              
              <div className="h-6 border-l-2 border-dashed border-glass-border" />

              <div className="w-full p-4 glass-strong border border-glass-border rounded-xl flex flex-col gap-2 shadow-xl opacity-60">
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 size={16} /> <span>Fetch Data</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 size={16} /> <span>Parse PDF</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-warning animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning mx-[5px]" /> <span>Generate Summary</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-glass-border mx-[5px]" /> <span>Email User</span>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
