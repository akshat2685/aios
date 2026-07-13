import { motion } from 'framer-motion';
import { Minus, X, Cloud, Server } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import { GlassContainer } from '../ui/glass';

export function Titlebar() {
  const api = getElectronAPI();
  const { cloudMode, setCloudMode } = useAppStore();

  const toggleMode = () => {
    const newMode = cloudMode === 'local' ? 'online' : 'local';
    setCloudMode(newMode);
    api.config.set('cloudMode', newMode);
  };

  return (
    <div className="h-[44px] bg-black/40 backdrop-blur-3xl border-b border-white/10 flex items-center justify-between relative z-50 no-select shadow-lg">
      <div className="flex-1 h-full drag-region flex items-center pl-4">
        <span className="hud-text tracking-[0.2em] flex items-center gap-4">
          <span className="text-white/70 font-bold">AIOS KERNEL // MODE:</span>
          
          <button 
            onClick={toggleMode}
            className="no-drag relative flex items-center p-0.5 rounded-full bg-black/60 border border-white/10 overflow-hidden w-28 h-7 transition-all shadow-inner cursor-pointer hover:border-white/20"
          >
            <motion.div
              layout
              className={cn(
                "absolute inset-y-1 w-[calc(50%-4px)] rounded-full z-0 shadow-lg",
                cloudMode === 'local' ? "bg-success border border-success left-1 shadow-success/40" : "bg-purple-500 border border-purple-500 right-1 shadow-purple-500/40"
              )}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            />
            <div className="relative z-10 flex w-full h-full">
              <div className={cn("flex-1 flex justify-center items-center gap-1.5 text-[10px] font-extrabold tracking-widest transition-colors", cloudMode === 'local' ? "text-white" : "text-white/40")}>
                <Server size={10} />
                LCL
              </div>
              <div className={cn("flex-1 flex justify-center items-center gap-1.5 text-[10px] font-extrabold tracking-widest transition-colors", cloudMode === 'online' ? "text-white" : "text-white/40")}>
                <Cloud size={10} />
                CLD
              </div>
            </div>
          </button>
        </span>
      </div>
      
      <div className="flex items-center h-full no-drag pr-2 gap-1">
        <motion.button
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => api.app.minimize()}
          className="w-10 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors"
          title="Minimize"
        >
          <Minus size={16} />
        </motion.button>
        <motion.button
          whileHover={{ backgroundColor: 'rgba(239,68,68,0.2)' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => api.app.quit()}
          className="w-10 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-danger transition-colors"
          title="Close"
        >
          <X size={16} />
        </motion.button>
      </div>
    </div>
  );
}
