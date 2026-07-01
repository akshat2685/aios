import { motion } from 'framer-motion';
import { Minus, X, Cloud, Server } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';

export function Titlebar() {
  const api = getElectronAPI();
  const { cloudMode, setCloudMode } = useAppStore();

  const toggleMode = () => {
    const newMode = cloudMode === 'local' ? 'online' : 'local';
    setCloudMode(newMode);
    api.config.set('cloudMode', newMode);
  };

  return (
    <div className="h-[38px] bg-black/40 backdrop-blur-xl border-b border-glass-border flex items-center justify-between relative z-50 no-select">
      <div className="flex-1 h-full drag-region flex items-center pl-4">
        <span className="hud-text tracking-[0.15em] flex items-center gap-3">
          <span>AIOS KERNEL // MODE:</span>
          
          <button 
            onClick={toggleMode}
            className="no-drag relative flex items-center p-0.5 rounded-full bg-black/50 border border-white/10 overflow-hidden w-24 h-6 transition-all"
          >
            <motion.div
              layout
              className={cn(
                "absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full z-0",
                cloudMode === 'local' ? "bg-green-500/20 border border-green-500/30 left-0.5" : "bg-purple-500/20 border border-purple-500/30 right-0.5"
              )}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
            <div className="relative z-10 flex w-full">
              <div className={cn("flex-1 flex justify-center items-center gap-1 text-[9px] font-bold tracking-wider", cloudMode === 'local' ? "text-green-400" : "text-white/40")}>
                <Server size={10} />
                LCL
              </div>
              <div className={cn("flex-1 flex justify-center items-center gap-1 text-[9px] font-bold tracking-wider", cloudMode === 'online' ? "text-purple-400" : "text-white/40")}>
                <Cloud size={10} />
                CLD
              </div>
            </div>
          </button>
        </span>
      </div>
      <div className="flex items-center no-drag">
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => api.app.minimize()}
          className="w-10 h-[38px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Minimize"
        >
          <Minus size={14} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(239,68,68,0.2)' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => api.app.quit()}
          className="w-10 h-[38px] flex items-center justify-center text-muted-foreground hover:text-danger transition-colors"
          title="Close"
        >
          <X size={14} />
        </motion.button>
      </div>
    </div>
  );
}
