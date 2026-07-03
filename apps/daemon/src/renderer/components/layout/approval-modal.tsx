import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getElectronAPI } from '@/lib/electron-api';
import { ShieldAlert, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

export function ApprovalModal() {
  const [requests, setRequests] = useState<any[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const api = getElectronAPI();
    const cleanup = api.security.onRequestApproval((request: any) => {
      setRequests(prev => [...prev, request]);
    });
    return cleanup;
  }, []);

  const handleResolve = async (id: string, approved: string) => {
    const api = getElectronAPI();
    await api.security.resolveApproval(id, approved);
    setRequests(prev => prev.filter(req => req.id !== id));
    setShowDetails(false); // reset for next
  };

  if (requests.length === 0) return null;

  const currentRequest = requests[0];
  const riskColor = currentRequest.risk === 'CRITICAL' || currentRequest.risk === 'HIGH' ? 'text-danger border-danger/50 bg-danger/10' : 'text-warning border-warning/50 bg-warning/10';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-background border border-glass-border rounded-xl shadow-2xl overflow-hidden max-w-lg w-full"
        >
          <div className="p-6">
            <div className="flex items-center gap-4 text-warning mb-4">
              <ShieldAlert className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">Security Approval Required</h2>
                <p className="text-sm text-muted-foreground">Action intercepted by AIOS GuardRails</p>
              </div>
            </div>
            
            <p className="text-sm mb-4 leading-relaxed">
              Agent <strong className="text-accent">{currentRequest.agentId}</strong> is attempting to perform a privileged action:
            </p>
            
            <div className={`p-4 rounded-lg border mb-4 font-mono text-sm break-all ${riskColor}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {currentRequest.action}
                </span>
                <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-background/50 border border-current">
                  {currentRequest.risk || 'UNKNOWN'} RISK
                </span>
              </div>
              <span className="opacity-80 block truncate">{currentRequest.target}</span>
            </div>

            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showDetails ? "Hide Details" : "View Details"}
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-6"
                >
                  <div className="p-3 bg-glass-subtle rounded-lg text-xs font-mono space-y-2 border border-glass-border">
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                      <span className="text-muted-foreground">Agent:</span>
                      <span className="text-foreground">{currentRequest.agentId}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                      <span className="text-muted-foreground">Target:</span>
                      <span className="text-foreground break-all">{currentRequest.target}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                      <span className="text-muted-foreground">Arguments:</span>
                      <span className="text-foreground break-all">{JSON.stringify(currentRequest.params, null, 2)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button onClick={() => handleResolve(currentRequest.id, 'deny_once')} className="px-4 py-2 rounded-lg font-medium border border-danger/30 hover:bg-danger/20 text-danger transition-colors">
                Deny Once
              </button>
              <button onClick={() => handleResolve(currentRequest.id, 'allow_once')} className="px-4 py-2 rounded-lg font-medium border border-success/30 hover:bg-success/20 text-success transition-colors">
                Allow Once
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleResolve(currentRequest.id, 'deny_always')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-glass-subtle hover:bg-danger/20 text-danger transition-colors">
                Deny Always
              </button>
              <button onClick={() => handleResolve(currentRequest.id, 'allow_session')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-glass-subtle hover:bg-success/20 text-success transition-colors">
                Allow Session
              </button>
              <button onClick={() => handleResolve(currentRequest.id, 'allow_always')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-glass-subtle hover:bg-success/20 text-success transition-colors">
                Allow Always
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
