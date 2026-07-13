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
          plugins: plugins.filter((p: any) => p.status === 'running').length,
        });
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-9 bg-black/40 backdrop-blur-2xl border-t border-white/5 flex items-center justify-between px-4 text-xs select-none z-20 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-6 text-white/50">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full shadow-lg', ollamaStatus === 'online' ? 'bg-success shadow-success/50' : 'bg-danger shadow-danger/50')} />
          <span className="font-mono tracking-wider font-semibold text-white/70">{cloudMode === 'online' ? 'CLOUD / GEMINI' : 'LOCAL / OLLAMA'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity size={12} className={metrics.cpu > 80 ? "text-danger" : "text-white/40"} />
          <span className="font-mono tracking-widest">CPU {metrics.cpu}%</span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-white/50">
        <motion.div 
          whileHover={{ color: 'rgba(255,255,255,0.9)' }} 
          className="flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Zap size={12} className={metrics.workflows > 0 ? "text-warning" : ""} />
          <span className="font-mono tracking-widest">{metrics.workflows} WKF</span>
        </motion.div>
        <motion.div 
          whileHover={{ color: 'rgba(255,255,255,0.9)' }} 
          className="flex items-center gap-2 cursor-pointer transition-colors"
        >
          <HardDrive size={12} className={metrics.plugins > 0 ? "text-accent" : ""} />
          <span className="font-mono tracking-widest">{metrics.plugins} PLG</span>
        </motion.div>
      </div>
    </div>
  );
}
