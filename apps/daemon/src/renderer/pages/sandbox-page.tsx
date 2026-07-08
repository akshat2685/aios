import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical, Play, Square, CheckCircle, XCircle,
  FileCode, Clock, HardDrive, ArrowUpRight,
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

interface SandboxSession {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: number;
  filesCreated: number;
  bytesWritten: number;
  elapsedMs: number;
  confidence: number;
  createdAt: number;
}

export default function SandboxPage() {
  const [sessions] = useState<SandboxSession[]>([
    {
      id: 'sb-001', name: 'Refactor LLM Router', status: 'completed',
      steps: 5, filesCreated: 3, bytesWritten: 12400, elapsedMs: 2340, confidence: 0.92,
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'sb-002', name: 'Add WebSocket Federation', status: 'running',
      steps: 3, filesCreated: 2, bytesWritten: 8200, elapsedMs: 1200, confidence: 0.75,
      createdAt: Date.now() - 600000,
    },
    {
      id: 'sb-003', name: 'Migrate to Drizzle ORM', status: 'failed',
      steps: 7, filesCreated: 5, bytesWritten: 22100, elapsedMs: 4500, confidence: 0.31,
      createdAt: Date.now() - 7200000,
    },
  ]);

  const [selectedSession, setSelectedSession] = useState<SandboxSession | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="text-green-400" />;
      case 'running': return <Play size={14} className="text-accent animate-pulse" />;
      case 'failed': return <XCircle size={14} className="text-red-400" />;
      default: return <Clock size={14} className="text-muted-foreground" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
            <FlaskConical className="text-green-400" /> Simulation Sandbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test plans and code safely before they touch your real system.
          </p>
        </div>
        <button className="glass-interactive px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-500/10 transition-colors border border-green-500/20 text-green-400">
          <Play size={14} /> New Sandbox
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Sessions List */}
        <motion.div variants={cardVariants} className="lg:col-span-1 glass-interactive rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Sessions</h2>
          <div className="space-y-2">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-all',
                  selectedSession?.id === session.id
                    ? 'bg-accent/10 border border-accent/20'
                    : 'glass-strong hover:bg-glass-strong'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{session.name}</span>
                  {getStatusIcon(session.status)}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{session.steps} steps</span>
                  <span>{session.filesCreated} files</span>
                  <span>{(session.confidence * 100).toFixed(0)}% conf</span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Session Details */}
        <motion.div variants={cardVariants} className="lg:col-span-2 flex flex-col gap-4">
          {selectedSession ? (
            <>
              {/* Session Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Steps', value: selectedSession.steps, icon: Play },
                  { label: 'Files', value: selectedSession.filesCreated, icon: FileCode },
                  { label: 'Written', value: formatBytes(selectedSession.bytesWritten), icon: HardDrive },
                  { label: 'Confidence', value: `${(selectedSession.confidence * 100).toFixed(0)}%`, icon: CheckCircle },
                ].map(stat => (
                  <div key={stat.label} className="glass-interactive p-3 rounded-xl">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <stat.icon size={12} />
                      <span className="text-[10px] uppercase tracking-wider">{stat.label}</span>
                    </div>
                    <div className="text-lg font-mono text-foreground">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Terminal Output */}
              <div className="glass-interactive rounded-xl p-4 flex-1 min-h-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Terminal Output</h3>
                  <span className="text-[10px] text-muted-foreground">{selectedSession.elapsedMs}ms elapsed</span>
                </div>
                <div className="bg-black/30 rounded-lg p-3 font-mono text-xs text-green-400 min-h-[120px]">
                  <div className="text-muted-foreground">$ sandbox run "{selectedSession.name}"</div>
                  <div className="mt-1 text-green-400/70">→ Creating virtual workspace...</div>
                  <div className="text-green-400/70">→ Step 1/{selectedSession.steps}: Analyzing dependencies...</div>
                  <div className="text-green-400/70">→ Step 2/{selectedSession.steps}: Writing files...</div>
                  {selectedSession.status === 'completed' && (
                    <div className="mt-1 text-green-400">✓ All steps passed. Safe to promote.</div>
                  )}
                  {selectedSession.status === 'failed' && (
                    <div className="mt-1 text-red-400">✗ Step 5 failed: Exit code 1</div>
                  )}
                  {selectedSession.status === 'running' && (
                    <div className="mt-1 text-accent animate-pulse">⟳ Running...</div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedSession.status === 'completed' && (
                <div className="flex items-center gap-3">
                  <button className="glass-interactive px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-500/10 transition-colors border border-green-500/20 text-green-400">
                    <ArrowUpRight size={14} /> Promote to Real
                  </button>
                  <button className="glass-interactive px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-accent/10 transition-colors text-muted-foreground">
                    <FileCode size={14} /> View Diff
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="glass-interactive rounded-xl p-8 flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a sandbox session to view details
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
