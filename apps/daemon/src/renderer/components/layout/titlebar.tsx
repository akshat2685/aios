import { motion } from 'framer-motion';
import { Minus, X } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';

export function Titlebar() {
  const api = getElectronAPI();

  return (
    <div className="h-[38px] bg-black/40 backdrop-blur-xl border-b border-glass-border flex items-center justify-between relative z-50 no-select">
      <div className="flex-1 h-full drag-region flex items-center pl-4">
        <span className="hud-text tracking-[0.15em]">
          AIOS KERNEL // SWARM_STATUS: <span className="text-success">ONLINE</span>
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
