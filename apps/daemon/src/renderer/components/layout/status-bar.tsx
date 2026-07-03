import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { Zap, Activity, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getElectronAPI } from '@/lib/electron-api';

export function StatusBar() {
  const { ollamaStatus, cloudMode } = useAppStore();
  const [metrics, setMetrics] = useState({ cpu: 0, workflows: 0, plugins: 0 });

  useEffect(() => {
    const api = getElectronAPI();
    const interval = setInterval(async () => {
      try {
        const sys = await api.system.metrics();
        const workflows = await api.workflow.list();
        const plugins = await api.plugins.list();
        setMetrics({
          cpu: sys ? Math.round(sys.cpuUsage) : 0,
          workflows: workflows.length,
          plugins: plugins.filter(p => p.status === 'running').length,
        });
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-8 glass-strong border-t border-glass-border flex items-center justify-between px-3 text-xs select-none z-20 shrink-0">
      <div className="flex items-center gap-4 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className={cn('w-2 h-2 rounded-full', ollamaStatus === 'online' ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-danger')} />
          <span className="font-mono">{cloudMode === 'online' ? 'Gemini Active' : 'Ollama Local'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity size={12} />
          <span className="font-mono">CPU {metrics.cpu}%</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-muted-foreground">
        <div className="flex items-center gap-1.5 hover:text-foreground cursor-default transition-colors">
          <Zap size={12} className={metrics.workflows > 0 ? "text-warning" : ""} />
          <span className="font-mono">{metrics.workflows} Workflows</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-foreground cursor-default transition-colors">
          <HardDrive size={12} className={metrics.plugins > 0 ? "text-accent" : ""} />
          <span className="font-mono">{metrics.plugins} Plugins</span>
        </div>
      </div>
    </div>
  );
}
