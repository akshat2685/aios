import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe, Users, Shield, Radio, Link2, Copy,
  Wifi, WifiOff, Clock, ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

interface Peer {
  id: string;
  displayName: string;
  status: 'online' | 'offline' | 'syncing';
  latencyMs: number;
  capabilities: string[];
  lastSeen: number;
}

interface AuditEntry {
  id: string;
  peerId: string;
  peerName: string;
  action: string;
  direction: 'inbound' | 'outbound';
  encrypted: boolean;
  timestamp: number;
}

export default function FederationPage() {
  const [peers] = useState<Peer[]>([
    {
      id: 'peer-1', displayName: 'AIOS-Dev-Laptop', status: 'online', latencyMs: 12,
      capabilities: ['coder', 'researcher', 'qwen2.5:8b'], lastSeen: Date.now(),
    },
    {
      id: 'peer-2', displayName: 'AIOS-Workstation', status: 'syncing', latencyMs: 45,
      capabilities: ['coder', 'planner', 'llama3.2:latest'], lastSeen: Date.now() - 30000,
    },
    {
      id: 'peer-3', displayName: 'AIOS-Server', status: 'offline', latencyMs: 0,
      capabilities: ['researcher', 'GPT-4o'], lastSeen: Date.now() - 86400000,
    },
  ]);

  const [auditLog] = useState<AuditEntry[]>([
    { id: '1', peerId: 'peer-1', peerName: 'AIOS-Dev-Laptop', action: 'knowledge:sync', direction: 'outbound', encrypted: true, timestamp: Date.now() - 120000 },
    { id: '2', peerId: 'peer-2', peerName: 'AIOS-Workstation', action: 'agent:delegate', direction: 'inbound', encrypted: true, timestamp: Date.now() - 240000 },
    { id: '3', peerId: 'peer-1', peerName: 'AIOS-Dev-Laptop', action: 'heartbeat', direction: 'outbound', encrypted: false, timestamp: Date.now() - 60000 },
    { id: '4', peerId: 'peer-2', peerName: 'AIOS-Workstation', action: 'model:share', direction: 'outbound', encrypted: true, timestamp: Date.now() - 500000 },
  ]);

  const [sharingPolicy, setSharingPolicy] = useState({
    shareProjects: true,
    shareKnowledge: true,
    shareMemory: false,
  });

  const [inviteCode] = useState('eyJpZCI6ImFiY2QxMjM0IiwiYWRkcmVzcyI6IjE5Mi4xNjguMS4xMCIsInBvcnQiOjk0NzB9');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'syncing': return 'bg-accent animate-pulse';
      case 'offline': return 'bg-red-400/50';
      default: return 'bg-muted-foreground';
    }
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full p-6 flex flex-col overflow-auto"
    >
      {/* Header */}
      <motion.div variants={cardVariants} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Globe className="text-amber-400" /> Federation Network
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Securely collaborate with other AIOS instances across your network.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass-interactive rounded-xl px-3 py-2 flex items-center gap-2">
            <Radio size={14} className="text-green-400 animate-pulse" />
            <span className="text-xs text-green-400">mDNS Active</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Connected Peers */}
        <motion.div variants={cardVariants} className="lg:col-span-2 glass-interactive rounded-xl p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Users size={16} className="text-amber-400" /> Connected Peers
          </h2>
          <div className="space-y-3">
            {peers.map(peer => (
              <div key={peer.id} className="glass-strong rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-2.5 h-2.5 rounded-full', getStatusColor(peer.status))} />
                  <div>
                    <div className="text-sm font-medium">{peer.displayName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {peer.status === 'online' && `${peer.latencyMs}ms`}
                      {peer.status === 'syncing' && 'Syncing...'}
                      {peer.status === 'offline' && `Last seen ${formatTime(peer.lastSeen)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {peer.capabilities.map(cap => (
                    <span key={cap} className="text-[9px] bg-glass-strong px-1.5 py-0.5 rounded text-muted-foreground">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Invite Code */}
          <div className="mt-4 pt-4 border-t border-glass-border">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <Link2 size={12} /> Your Invite Code
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black/20 rounded-lg px-3 py-2 font-mono text-[10px] text-muted-foreground truncate">
                {inviteCode}
              </div>
              <button className="glass-interactive p-2 rounded-lg hover:text-accent transition-colors">
                <Copy size={14} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Sharing Policy */}
        <motion.div variants={cardVariants} className="glass-interactive rounded-xl p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Shield size={16} className="text-green-400" /> Sharing Policy
          </h2>
          <div className="space-y-3">
            {[
              { key: 'shareProjects', label: 'Projects', desc: 'Share project structures' },
              { key: 'shareKnowledge', label: 'Knowledge Graph', desc: 'Share knowledge nodes & edges' },
              { key: 'shareMemory', label: 'Personal Memory', desc: 'Share memories & preferences' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between glass-strong rounded-lg p-3">
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                </div>
                <button
                  onClick={() => setSharingPolicy(prev => ({
                    ...prev,
                    [item.key]: !(prev as any)[item.key],
                  }))}
                  className={cn(
                    'w-10 h-5 rounded-full transition-all relative',
                    (sharingPolicy as any)[item.key] ? 'bg-green-500' : 'bg-glass-strong'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
                    (sharingPolicy as any)[item.key] ? 'left-5.5' : 'left-0.5'
                  )} style={{ left: (sharingPolicy as any)[item.key] ? '22px' : '2px' }} />
                </button>
              </div>
            ))}
          </div>

          {/* Encryption Status */}
          <div className="mt-4 pt-4 border-t border-glass-border">
            <div className="flex items-center gap-2 text-xs text-green-400">
              <Shield size={12} />
              <span>End-to-End Encryption Active</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              All federation messages are encrypted with AES-256-GCM.
            </p>
          </div>
        </motion.div>

        {/* Activity Log */}
        <motion.div variants={cardVariants} className="lg:col-span-3 glass-interactive rounded-xl p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <ArrowLeftRight size={16} className="text-muted-foreground" /> Federation Activity
          </h2>
          <div className="space-y-1">
            {auditLog.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-glass-strong transition-colors text-xs">
                <span className="text-muted-foreground w-16">{formatTime(entry.timestamp)}</span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider',
                  entry.direction === 'outbound' ? 'bg-accent/15 text-accent' : 'bg-secondary/15 text-secondary'
                )}>
                  {entry.direction === 'outbound' ? '↑ OUT' : '↓ IN'}
                </span>
                <span className="text-foreground font-medium">{entry.peerName}</span>
                <span className="text-muted-foreground font-mono">{entry.action}</span>
                {entry.encrypted && <Shield size={10} className="text-green-400" />}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
