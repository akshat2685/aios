import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '@/stores/toast-store';
import { X, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotificationCenter() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-12 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const icons = {
            info: <Info className="text-accent shrink-0" size={18} />,
            success: <CheckCircle2 className="text-success shrink-0" size={18} />,
            warning: <AlertTriangle className="text-warning shrink-0" size={18} />,
            error: <XCircle className="text-danger shrink-0" size={18} />,
          };

          return (
            <motion.div
              layout
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={cn(
                "glass-interactive pointer-events-auto p-4 rounded-xl flex items-start gap-3 shadow-xl border-l-4",
                toast.type === 'info' && "border-l-accent",
                toast.type === 'success' && "border-l-success",
                toast.type === 'warning' && "border-l-warning",
                toast.type === 'error' && "border-l-danger"
              )}
            >
              {icons[toast.type]}
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground">{toast.title}</h4>
                {toast.message && (
                  <p className="text-xs text-muted-foreground mt-1 break-words">{toast.message}</p>
                )}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5 rounded-md hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
