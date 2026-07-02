import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getElectronAPI } from '@/lib/electron-api';
import { ShieldAlert } from 'lucide-react';

export function ApprovalModal() {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    const api = getElectronAPI();
    const cleanup = api.security.onRequestApproval((request: any) => {
      setRequests(prev => [...prev, request]);
    });
    return cleanup;
  }, []);

  const handleResolve = async (id: string, approved: boolean) => {
    const api = getElectronAPI();
    await api.security.resolveApproval(id, approved);
    setRequests(prev => prev.filter(req => req.id !== id));
  };

  if (requests.length === 0) return null;

  const currentRequest = requests[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-background border border-red-900/50 rounded-xl shadow-2xl overflow-hidden max-w-md w-full"
        >
          <div className="p-6">
            <div className="flex items-center gap-4 text-red-500 mb-4">
              <ShieldAlert className="w-8 h-8" />
              <h2 className="text-xl font-semibold">Security Approval Required</h2>
            </div>
            
            <p className="text-muted-foreground mb-4">
              Agent <strong className="text-foreground">{currentRequest.agentId}</strong> is attempting to perform a privileged action:
            </p>
            
            <div className="bg-muted/50 p-4 rounded-lg border border-border mb-6 font-mono text-sm break-all">
              <span className="text-primary">{currentRequest.action}</span>
              <br/>
              <span className="text-muted-foreground">{currentRequest.params?.details}</span>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => handleResolve(currentRequest.id, false)}
                className="px-4 py-2 rounded-md font-medium border border-border text-foreground hover:bg-red-500/10 hover:text-red-500"
              >
                Deny
              </button>
              <button 
                onClick={() => handleResolve(currentRequest.id, true)}
                className="px-4 py-2 rounded-md font-medium bg-red-500 hover:bg-red-600 text-white"
              >
                Approve Action
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
