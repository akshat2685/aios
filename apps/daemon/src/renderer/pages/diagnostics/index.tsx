import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { getElectronAPI } from '@/lib/electron-api';
import { cn } from '@/lib/utils';
import { 
  Activity, Server, Brain, ActivitySquare, Database, 
  TerminalSquare, ShieldAlert, Cpu, HardDrive, RefreshCw, Trash2
} from 'lucide-react';

const tabs = [
  { id: 'logs', label: 'Live Logs', icon: TerminalSquare },
  { id: 'replay', label: 'Requests', icon: ActivitySquare },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'cache', label: 'Cache', icon: HardDrive },
  { id: 'agents', label: 'Agents', icon: Brain },
  { id: 'ollama', label: 'Ollama', icon: Database },
  { id: 'resources', label: 'Resources', icon: Cpu },
];

export default function DiagnosticsPage() {
  const [activeTab, setActiveTab] = useState('logs');
  const api = getElectronAPI();

  return (
    <div className="h-full flex flex-col">
      {/* Header & Panic Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-glass-border glass-interactive shrink-0">
        <div className="flex items-center gap-3">
          <ActivitySquare className="text-accent" size={24} />
          <div>
            <h1 className="text-lg font-semibold">System Diagnostics</h1>
            <p className="text-xs text-muted-foreground">Advanced Telemetry & Controls</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => api.telemetry.clear()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger rounded-lg text-xs font-medium transition-colors"
          >
            <Trash2 size={14} />
            Clear Logs
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-1.5 glass-subtle hover:bg-glass-strong rounded-lg text-xs font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Reload UI
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-4 border-b border-glass-border gap-6 shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
              activeTab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'logs' && <LiveLogsView />}
        {activeTab === 'replay' && <ReplayView />}
        {activeTab === 'providers' && <ProvidersView />}
        {activeTab === 'cache' && <CacheView />}
        {activeTab === 'resources' && <ResourcesView />}
        {activeTab === 'ollama' && <OllamaView />}
        {activeTab === 'agents' && <AgentsView />}
      </div>
    </div>
  );
}

// ─── Sub Views ───────────────────────────────────────────────

function LiveLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const api = getElectronAPI();

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await api.telemetry.logs(100);
      setLogs(data);
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'ERROR': return 'text-danger bg-danger/10';
      case 'WARN': return 'text-warning bg-warning/10';
      case 'DEBUG': return 'text-muted-foreground bg-glass-strong';
      default: return 'text-accent bg-accent/10';
    }
  };

  return (
    <div className="h-full p-4 overflow-y-auto font-mono text-xs">
      <div className="flex flex-col gap-1">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 py-1 border-b border-glass-border/30 hover:bg-glass-subtle/50 rounded px-2">
            <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", getLevelColor(log.level))}>
              {log.level}
            </span>
            <span className="text-foreground shrink-0 w-16">[{log.type}]</span>
            <div className="flex flex-col">
              <span className="text-foreground">{log.message}</span>
              {log.data && (
                <pre className="text-muted-foreground mt-1 bg-glass-strong p-2 rounded-lg text-[10px] overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center text-muted-foreground py-10">No telemetry logs found.</div>
        )}
      </div>
    </div>
  );
}

function ProvidersView() {
  const [states, setStates] = useState<Record<string, any>>({});
  const api = getElectronAPI();

  useEffect(() => {
    const fetchStates = async () => {
      const data = await api.llm.states();
      setStates(data || {});
    };
    fetchStates();
    const interval = setInterval(fetchStates, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(states).map(([id, state]: [string, any]) => (
          <div key={id} className="glass-interactive p-4 rounded-xl flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold capitalize text-lg flex items-center gap-2">
                <Server size={18} className="text-accent" />
                {id}
              </h3>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold", state.healthy ? "text-success" : "text-danger")}>
                  {state.healthy ? "HEALTHY" : "OFFLINE"}
                </span>
                <div className={cn("w-2.5 h-2.5 rounded-full", state.healthy ? "bg-success" : "bg-danger animate-pulse")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="glass-subtle p-2 rounded-lg">
                <div className="text-[10px] text-muted-foreground">Circuit Breaker</div>
                <div className={cn("text-sm font-bold", state.rateLimited ? "text-danger" : "text-success")}>
                  {state.rateLimited ? "TRIPPED" : "CLOSED"}
                </div>
              </div>
              <div className="glass-subtle p-2 rounded-lg">
                <div className="text-[10px] text-muted-foreground">429 Errors</div>
                <div className="text-sm font-bold text-foreground">{state.consecutive429Count}</div>
              </div>
              <div className="glass-subtle p-2 rounded-lg col-span-2">
                <div className="text-[10px] text-muted-foreground">Cooldown Status</div>
                <div className="text-sm font-mono text-foreground">
                  {state.cooldownUntil ? new Date(state.cooldownUntil).toLocaleTimeString() : 'Ready'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourcesView() {
  const [metrics, setMetrics] = useState<any>(null);
  const api = getElectronAPI();

  useEffect(() => {
    const fetchMetrics = async () => {
      const data = await api.system.metrics();
      setMetrics(data);
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return null;

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-interactive p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Cpu size={16} />
            <span>Process CPU</span>
          </div>
          <div className="text-3xl font-bold text-accent">{metrics.cpuUsage}%</div>
          <div className="w-full bg-glass-border h-2 rounded-full overflow-hidden mt-2">
            <div className="bg-accent h-full transition-all" style={{ width: `${metrics.cpuUsage}%` }} />
          </div>
        </div>

        <div className="glass-interactive p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Activity size={16} />
            <span>RAM Available</span>
          </div>
          <div className="text-3xl font-bold text-secondary">
            {(metrics.freeMem / 1024 / 1024 / 1024).toFixed(1)} GB
          </div>
          <div className="text-xs text-muted-foreground">of {(metrics.totalMem / 1024 / 1024 / 1024).toFixed(1)} GB Total</div>
        </div>

        <div className="glass-interactive p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ShieldAlert size={16} />
            <span>Platform</span>
          </div>
          <div className="text-2xl font-bold uppercase mt-1">{metrics.platform}</div>
          <div className="text-xs text-muted-foreground">Uptime: {(metrics.uptime / 3600).toFixed(1)} hrs</div>
        </div>
      </div>
    </div>
  );
}

function OllamaView() {
  const [models, setModels] = useState<any[]>([]);
  const [ps, setPs] = useState<any[]>([]);
  const api = getElectronAPI();

  useEffect(() => {
    const fetchOllama = async () => {
      setModels(await api.system.ollamaModels());
      setPs(await api.system.ollamaPs());
    };
    fetchOllama();
    const interval = setInterval(fetchOllama, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Database size={20} className="text-accent" />
        Loaded Models in VRAM
      </h2>
      <div className="flex flex-col gap-3 mb-8">
        {ps.length === 0 && <div className="text-muted-foreground text-sm">No models currently loaded in memory.</div>}
        {ps.map(m => (
          <div key={m.digest} className="glass-interactive p-4 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold">{m.name}</div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">Size: {(m.size / 1024 / 1024 / 1024).toFixed(2)} GB | Expires: {new Date(m.expires_at).toLocaleTimeString()}</div>
            </div>
            <div className="px-3 py-1 bg-success/10 text-success rounded-full text-xs font-bold border border-success/20">
              ACTIVE
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <HardDrive size={20} className="text-secondary" />
        Installed Models
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.map(m => (
          <div key={m.digest} className="glass-subtle p-3 rounded-xl flex items-center justify-between">
            <div className="text-sm font-medium">{m.name}</div>
            <div className="text-xs text-muted-foreground">{(m.size / 1024 / 1024 / 1024).toFixed(1)} GB</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentsView() {
  const [stats, setStats] = useState<any>({ byAgent: {}, totalTokens: 0 });
  const api = getElectronAPI();

  useEffect(() => {
    const fetchStats = async () => {
      const data = await api.llm.trackerStats();
      setStats(data || { byAgent: {}, totalTokens: 0 });
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="mb-6">
        <div className="text-sm text-muted-foreground">Total Tokens Processed</div>
        <div className="text-4xl font-bold text-gradient-accent">{stats.totalTokens?.toLocaleString()}</div>
      </div>

      <h2 className="text-lg font-semibold mb-4">Agent Token Budgets</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(stats.byAgent || {}).map(([id, data]: [string, any]) => {
          const budget = 50000;
          const percent = Math.min((data.totalTokens / budget) * 100, 100);
          return (
            <div key={id} className="glass-interactive p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold capitalize text-sm">{id}</span>
                <span className="text-xs font-mono">{data.totalTokens.toLocaleString()} / {budget.toLocaleString()}</span>
              </div>
              <div className="w-full bg-glass-border h-2 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all", percent > 90 ? "bg-danger" : percent > 70 ? "bg-warning" : "bg-accent")} 
                  style={{ width: `${percent}%` }} 
                />
              </div>
              <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground uppercase tracking-wider">
                <div>IN: {data.promptTokens}</div>
                <div>OUT: {data.completionTokens}</div>
              </div>
            </div>
          );
        })}
        {Object.keys(stats.byAgent || {}).length === 0 && (
          <div className="text-muted-foreground text-sm col-span-2">No agent usage data recorded yet.</div>
        )}
      </div>
    </div>
  );
}

function CacheView() {
  const [stats, setStats] = useState<any>(null);
  const api = getElectronAPI();

  useEffect(() => {
    const fetchStats = async () => {
      const data = await api.llm.getCacheStats();
      setStats(data);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <div className="p-6 text-muted-foreground">Loading cache stats...</div>;

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-interactive p-4 rounded-xl flex flex-col gap-2">
          <div className="text-muted-foreground text-sm">Hits</div>
          <div className="text-3xl font-bold text-success">{stats.hits}</div>
        </div>
        <div className="glass-interactive p-4 rounded-xl flex flex-col gap-2">
          <div className="text-muted-foreground text-sm">Misses</div>
          <div className="text-3xl font-bold text-warning">{stats.misses}</div>
        </div>
        <div className="glass-interactive p-4 rounded-xl flex flex-col gap-2">
          <div className="text-muted-foreground text-sm">Evictions (LRU/TTL)</div>
          <div className="text-3xl font-bold text-danger">{stats.evictions}</div>
        </div>
        <div className="glass-interactive p-4 rounded-xl flex flex-col gap-2">
          <div className="text-muted-foreground text-sm">Memory Usage</div>
          <div className="text-3xl font-bold text-accent">{(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB</div>
          <div className="text-xs text-muted-foreground">Max 500 MB</div>
        </div>
      </div>
    </div>
  );
}

function ReplayView() {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const api = getElectronAPI();

  useEffect(() => {
    const fetchRequests = async () => {
      const data = await api.telemetry.logs(50, 'request');
      setRequests(data);
    };
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-1/3 border-r border-glass-border overflow-y-auto p-4 flex flex-col gap-2">
        <h3 className="font-semibold mb-2">Recent Requests</h3>
        {requests.map(req => (
          <div 
            key={req.id} 
            className={cn("p-3 rounded-lg cursor-pointer transition-colors border", selectedReq?.id === req.id ? "bg-accent/10 border-accent" : "glass-subtle border-transparent hover:border-glass-border")}
            onClick={() => setSelectedReq(req)}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm">{req.data.provider}</span>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", req.data.status === 200 ? "bg-success/20 text-success" : "bg-danger/20 text-danger")}>{req.data.status}</span>
            </div>
            <div className="text-xs text-muted-foreground">{req.data.model}</div>
            <div className="text-[10px] text-muted-foreground mt-2">{new Date(req.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
        {requests.length === 0 && <div className="text-sm text-muted-foreground">No requests logged yet.</div>}
      </div>
      <div className="w-2/3 p-6 overflow-y-auto">
        {selectedReq ? (
          <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold">Request Details</h2>
            <div className="grid grid-cols-3 gap-4">
               <div className="glass-subtle p-3 rounded-lg">
                 <div className="text-xs text-muted-foreground mb-1">Tokens In</div>
                 <div className="font-bold">{selectedReq.data.tokens_in}</div>
               </div>
               <div className="glass-subtle p-3 rounded-lg">
                 <div className="text-xs text-muted-foreground mb-1">Tokens Out</div>
                 <div className="font-bold">{selectedReq.data.tokens_out}</div>
               </div>
               <div className="glass-subtle p-3 rounded-lg">
                 <div className="text-xs text-muted-foreground mb-1">Agent</div>
                 <div className="font-bold">{selectedReq.data.agent || 'N/A'}</div>
               </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2 text-muted-foreground">Request Payload</h3>
              <pre className="bg-glass-strong p-4 rounded-xl text-xs overflow-x-auto font-mono text-secondary whitespace-pre-wrap">
                {selectedReq.data.requestPayload ? selectedReq.data.requestPayload : 'No payload recorded'}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2 text-muted-foreground">Response Payload</h3>
              <pre className="bg-glass-strong p-4 rounded-xl text-xs overflow-x-auto font-mono text-accent whitespace-pre-wrap">
                {selectedReq.data.responsePayload ? selectedReq.data.responsePayload : 'No payload recorded'}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a request to view details
          </div>
        )}
      </div>
    </div>
  );
}
