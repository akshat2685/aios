import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Cpu, Palette, Shield, Database, Wrench,
  Save, Check, Trash2, Key, HelpCircle, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getElectronAPI } from '@/lib/electron-api';

const tabs = [
  { id: 'llm', label: 'LLM Providers', icon: Cpu },
  { id: 'memory', label: 'Memory', icon: Database },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'advanced', label: 'Advanced', icon: Wrench },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-glass-border last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'w-10 h-5 rounded-full transition-colors duration-200 relative no-drag',
        checked ? 'bg-accent shadow-accent-glow' : 'bg-glass-strong border border-glass-border'
      )}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function InputField({ value, onChange, placeholder, type = 'text', className }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-48 px-3 py-1.5 rounded-lg bg-glass-strong border border-glass-border text-sm text-foreground outline-none focus:border-accent transition-colors no-drag",
        className
      )}
    />
  );
}

export default function SettingsPage() {
  const api = getElectronAPI();
  const [activeTab, setActiveTab] = useState('llm');
  const [saved, setSaved] = useState(false);

  // Secure keys state
  const [keysSet, setKeysSet] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [inputKeys, setInputKeys] = useState<Record<string, string>>({});
  const [healthStatus, setHealthStatus] = useState<Record<string, { status: string; error?: string }>>({});
  const [testingHealth, setTestingHealth] = useState<Record<string, boolean>>({});
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});

  // Config state
  const [config, setConfig] = useState({
    llm: {
      defaultProvider: 'ollama',
      defaultModel: 'llama3.2:latest',
      providers: {
        ollama: { baseUrl: 'http://127.0.0.1:11434' },
        openai: { model: 'gpt-4o' },
        anthropic: { model: 'claude-3-5-sonnet-20240620' },
        gemini: { model: 'gemini-1.5-flash' },
        openrouter: { model: 'meta-llama/llama-3-8b-instruct:free' },
        nvidia: { model: 'meta/llama3-8b-instruct' },
        custom: { baseUrl: 'http://localhost:8000/v1', model: 'default' },
      }
    },
    memory: { embeddingModel: 'all-minilm', embeddingDim: 384, maxEntries: 100000 },
    ui: { fontSize: 14, animationSpeed: 1, compactMode: false, showTimestamps: true },
    privacy: { telemetry: false, crashReporting: false, localOnly: true, encryptMemory: false },
    advanced: { logLevel: 'info', maxLogFiles: 10, enableProfiling: false },
  });

  const fetchModels = async (provider: string) => {
    setLoadingModels(prev => ({ ...prev, [provider]: true }));
    try {
      const models = await api.llm.models(provider);
      setProviderModels(prev => ({ ...prev, [provider]: models }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModels(prev => ({ ...prev, [provider]: false }));
    }
  };

  const checkKeys = async () => {
    const providers = ['openai', 'anthropic', 'gemini', 'openrouter', 'nvidia', 'custom'];
    const status: Record<string, boolean> = {};
    const counts: Record<string, number> = {};
    for (const p of providers) {
      try {
        const res = await api.llm.keys.get(p);
        status[p] = res.isSet;
        counts[p] = res.count;
      } catch {
        status[p] = false;
        counts[p] = 0;
      }
    }
    setKeysSet(status);
    setCounts(counts);
    
    // Automatically fetch models for all providers in the background
    providers.forEach(p => fetchModels(p));
    fetchModels('ollama');
  };

  // Load config and key status on mount
  useEffect(() => {
    (async () => {
      try {
        const llm = await api.config.get('llm');
        const memory = await api.config.get('memory');
        const ui = await api.config.get('ui');
        const privacy = await api.config.get('privacy');
        const advanced = await api.config.get('advanced');
        
        setConfig(prev => ({
          llm: { ...prev.llm, ...llm, providers: { ...prev.llm.providers, ...(llm?.providers || {}) } },
          memory: { ...prev.memory, ...memory },
          ui: { ...prev.ui, ...ui },
          privacy: { ...prev.privacy, ...privacy },
          advanced: { ...prev.advanced, ...advanced }
        }));
      } catch {
        // use defaults
      }
      checkKeys();
    })();
  }, []);

  const saveConfig = async () => {
    try {
      await api.config.set('llm', config.llm);
      await api.config.set('memory', config.memory);
      await api.config.set('ui', config.ui);
      await api.config.set('privacy', config.privacy);
      await api.config.set('advanced', config.advanced);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save config', e);
    }
  };

  const updateConfig = (path: string, value: any) => {
    setConfig((prev) => {
      const keys = path.split('.');
      const newConfig = JSON.parse(JSON.stringify(prev));
      let obj = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  // Secure key management handlers
  const handleSaveKey = async (provider: string) => {
    const keyStr = inputKeys[provider];
    if (!keyStr) return;
    try {
      // Support multiple keys comma separated
      const keysArray = keyStr.split(',').map(k => k.trim()).filter(Boolean);
      await api.llm.keys.set(provider, keysArray.length > 1 ? keysArray : keysArray[0]);
      setInputKeys(prev => ({ ...prev, [provider]: '' }));
      await checkKeys();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    try {
      await api.llm.keys.delete(provider);
      await checkKeys();
      // Clear health status for this provider
      setHealthStatus(prev => {
        const updated = { ...prev };
        delete updated[provider];
        return updated;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestConnection = async (provider: string) => {
    setTestingHealth(prev => ({ ...prev, [provider]: true }));
    try {
      const health = await api.llm.health();
      const status = health[provider] || { status: 'unhealthy', error: 'No response' };
      setHealthStatus(prev => ({ ...prev, [provider]: status }));
    } catch (e: any) {
      setHealthStatus(prev => ({ ...prev, [provider]: { status: 'unhealthy', error: e.message } }));
    } finally {
      setTestingHealth(prev => ({ ...prev, [provider]: false }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-glass-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-muted-foreground" />
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={saveConfig}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all no-drag',
            saved
              ? 'bg-success/15 text-success border border-success/20'
              : 'bg-accent/15 text-accent border border-accent/20 hover:bg-accent/20'
          )}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </motion.button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tab Navigation */}
        <div className="w-[200px] border-r border-glass-border p-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all text-left no-drag',
                  activeTab === tab.id
                    ? 'bg-glass-strong text-foreground border border-glass-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-glass'
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-1 p-6 overflow-y-auto"
        >
          {activeTab === 'llm' && (
            <div className="max-w-2xl space-y-6">
              <motion.div variants={itemVariants}>
                <h2 className="text-base font-semibold mb-3">Router Defaults</h2>
                <div className="glass p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Default Provider</span>
                    <select
                      value={config.llm.defaultProvider}
                      onChange={(e) => updateConfig('llm.defaultProvider', e.target.value)}
                      className="w-48 px-3 py-1.5 rounded-lg bg-glass-strong border border-glass-border text-sm text-foreground outline-none focus:border-accent transition-colors no-drag"
                    >
                      <option value="ollama">Ollama (Local)</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="nvidia">NVIDIA NIM</option>
                      <option value="custom">Custom API</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Default Model</span>
                    <InputField value={config.llm.defaultModel} onChange={(v) => updateConfig('llm.defaultModel', v)} />
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <h2 className="text-base font-semibold mb-3">API Key & Provider Dashboard</h2>
                <div className="space-y-4">
                  {/* Ollama Host */}
                  <div className="glass p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-accent" />
                        <span className="text-sm font-medium">Ollama (Local)</span>
                      </div>
                      <span className="text-xs font-mono text-success">CONNECTED (Local)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-glass-border pt-2">
                      <span>Server Endpoint</span>
                      <InputField value={config.llm.providers.ollama.baseUrl} onChange={(v) => updateConfig('llm.providers.ollama.baseUrl', v)} className="w-56" />
                    </div>
                  </div>

                  {/* Remote Providers API Key Manager */}
                  {[
                    { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o' },
                    { id: 'anthropic', label: 'Anthropic Claude', defaultModel: 'claude-3-5-sonnet-20240620' },
                    { id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-1.5-flash' },
                    { id: 'openrouter', label: 'OpenRouter', defaultModel: 'meta-llama/llama-3-8b-instruct:free' },
                    { id: 'nvidia', label: 'NVIDIA NIM', defaultModel: 'meta/llama3-8b-instruct' },
                  ].map((p) => {
                    const isKeySaved = keysSet[p.id];
                    const health = healthStatus[p.id];
                    const testing = testingHealth[p.id];

                    return (
                      <div key={p.id} className="glass p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Key size={14} className="text-secondary" />
                            <span className="text-sm font-medium">{p.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isKeySaved ? (
                              <span className="px-2 py-0.5 rounded bg-success/15 border border-success/20 text-[10px] font-mono text-success">KEY SAVED</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-glass border border-glass-border text-[10px] font-mono text-muted-foreground">NO KEY SET</span>
                            )}
                            {health && (
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-mono",
                                health.status === 'healthy' ? "bg-success/15 border border-success/20 text-success" : "bg-danger/15 border border-danger/20 text-danger"
                              )}>
                                {health.status === 'healthy' ? 'HEALTHY' : 'UNHEALTHY'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* API Key management */}
                        <div className="flex items-center justify-between border-t border-glass-border pt-2 gap-3">
                          <span className="text-xs text-muted-foreground">API Key(s) {isKeySaved && counts[p.id] > 0 ? `(${counts[p.id]} saved)` : ''}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              placeholder={isKeySaved ? "Add/Replace (comma-separated)" : "Enter API Key(s)"}
                              value={inputKeys[p.id] || ''}
                              onChange={(e) => setInputKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                              className="px-3 py-1 bg-glass-strong border border-glass-border rounded-lg text-xs outline-none focus:border-accent text-foreground w-44 no-drag"
                            />
                            <button
                              onClick={() => handleSaveKey(p.id)}
                              disabled={!inputKeys[p.id]}
                              className="px-2.5 py-1 bg-accent/20 border border-accent/35 hover:bg-accent/30 text-accent rounded-lg text-xs font-medium transition-all disabled:opacity-40 no-drag"
                            >
                              Save
                            </button>
                            {isKeySaved && (
                              <button
                                onClick={() => handleDeleteKey(p.id)}
                                className="p-1 hover:bg-danger/20 hover:text-danger rounded-lg transition-all no-drag"
                                title="Remove Key"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Configurable default model for provider */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                          <div className="flex flex-col gap-1">
                            <span>Preferred Model</span>
                            <button onClick={() => fetchModels(p.id)} className="text-[9px] text-accent hover:underline text-left no-drag">
                              {loadingModels[p.id] ? 'Refreshing...' : 'Refresh Models'}
                            </button>
                          </div>
                          {providerModels[p.id] && providerModels[p.id].length > 0 ? (
                            <select
                              value={(config.llm.providers as any)[p.id]?.model || p.defaultModel}
                              onChange={(e) => updateConfig(`llm.providers.${p.id}.model`, e.target.value)}
                              className="w-56 h-7 px-2 py-1 rounded-lg bg-glass-strong border border-glass-border text-xs text-foreground outline-none focus:border-accent transition-colors no-drag"
                            >
                              {providerModels[p.id].map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          ) : (
                            <InputField
                              value={(config.llm.providers as any)[p.id]?.model || p.defaultModel}
                              onChange={(v) => updateConfig(`llm.providers.${p.id}.model`, v)}
                              className="w-56 h-7 text-xs"
                              placeholder="Click 'Refresh Models' or type here"
                            />
                          )}
                        </div>

                        {/* Test connection action */}
                        {isKeySaved && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleTestConnection(p.id)}
                              disabled={testing}
                              className="text-[10px] text-accent hover:underline flex items-center gap-1 font-medium no-drag"
                            >
                              {testing ? 'Testing connection...' : 'Test connection'}
                            </button>
                          </div>
                        )}

                        {health?.status === 'unhealthy' && health.error && (
                          <div className="text-[10px] text-danger bg-danger/10 border border-danger/20 rounded p-1.5 mt-2 font-mono break-words">
                            Error: {health.error}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Custom API Provider */}
                  <div className="glass p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings size={14} className="text-warning" />
                        <span className="text-sm font-medium">Custom OpenAI-Compatible API</span>
                      </div>
                      {keysSet.custom ? (
                        <span className="px-2 py-0.5 rounded bg-success/15 border border-success/20 text-[10px] font-mono text-success">KEY SAVED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-glass border border-glass-border text-[10px] font-mono text-muted-foreground">NO KEY SET</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-glass-border pt-2">
                      <span>Base URL</span>
                      <InputField value={config.llm.providers.custom.baseUrl} onChange={(v) => updateConfig('llm.providers.custom.baseUrl', v)} className="w-56" />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Model Name</span>
                      <InputField value={config.llm.providers.custom.model} onChange={(v) => updateConfig('llm.providers.custom.model', v)} className="w-56" />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>API Key(s) {keysSet.custom && counts.custom > 0 ? `(${counts.custom} saved)` : ''}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          placeholder={keysSet.custom ? "Add/Replace (comma-separated)" : "Enter API Key(s)"}
                          value={inputKeys.custom || ''}
                          onChange={(e) => setInputKeys(prev => ({ ...prev, custom: e.target.value }))}
                          className="px-3 py-1 bg-glass-strong border border-glass-border rounded-lg text-xs outline-none focus:border-accent text-foreground w-44 no-drag"
                        />
                        <button
                          onClick={() => handleSaveKey('custom')}
                          disabled={!inputKeys.custom}
                          className="px-2.5 py-1 bg-accent/20 border border-accent/35 hover:bg-accent/30 text-accent rounded-lg text-xs font-medium transition-all disabled:opacity-40 no-drag"
                        >
                          Save
                        </button>
                        {keysSet.custom && (
                          <button
                            onClick={() => handleDeleteKey('custom')}
                            className="p-1 hover:bg-danger/20 hover:text-danger rounded-lg transition-all no-drag"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="max-w-2xl space-y-1">
              <motion.h2 variants={itemVariants} className="text-lg font-semibold mb-4">Memory Configuration</motion.h2>
              <motion.div variants={itemVariants}>
                <SettingRow label="Embedding Model" description="Model used for vector embeddings">
                  <InputField value={config.memory.embeddingModel} onChange={(v) => updateConfig('memory.embeddingModel', v)} />
                </SettingRow>
              </motion.div>
              <motion.div variants={itemVariants}>
                <SettingRow label="Embedding Dimensions" description="Vector dimension size">
                  <InputField type="number" value={String(config.memory.embeddingDim)} onChange={(v) => updateConfig('memory.embeddingDim', parseInt(v) || 384)} />
                </SettingRow>
              </motion.div>
              <motion.div variants={itemVariants}>
                <SettingRow label="Max Entries" description="Maximum number of memory records">
                  <InputField type="number" value={String(config.memory.maxEntries)} onChange={(v) => updateConfig('memory.maxEntries', parseInt(v) || 100000)} />
                </SettingRow>
              </motion.div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-2xl space-y-1">
              <motion.h2 variants={itemVariants} className="text-lg font-semibold mb-4">Appearance</motion.h2>
              <motion.div variants={itemVariants}>
                <SettingRow label="Compact Mode" description="Reduce spacing for more content">
                  <Toggle checked={config.ui.compactMode} onChange={(v) => updateConfig('ui.compactMode', v)} />
                </SettingRow>
              </motion.div>
              <motion.div variants={itemVariants}>
                <SettingRow label="Show Timestamps" description="Display message timestamps">
                  <Toggle checked={config.ui.showTimestamps} onChange={(v) => updateConfig('ui.showTimestamps', v)} />
                </SettingRow>
              </motion.div>
              <motion.div variants={itemVariants}>
                <SettingRow label="Font Size" description="Base font size in pixels">
                  <InputField type="number" value={String(config.ui.fontSize)} onChange={(v) => updateConfig('ui.fontSize', parseInt(v) || 14)} />
                </SettingRow>
              </motion.div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="max-w-2xl space-y-1">
              <motion.h2 variants={itemVariants} className="text-lg font-semibold mb-4">Privacy & Security</motion.h2>
              <motion.div variants={itemVariants}>
                <SettingRow label="Local Only Mode" description="Prevent any external network requests">
                  <Toggle checked={config.privacy.localOnly} onChange={(v) => updateConfig('privacy.localOnly', v)} />
                </SettingRow>
              </motion.div>
              <motion.div variants={itemVariants}>
                <SettingRow label="Encrypt Memory" description="Encrypt vector memory at rest">
                  <Toggle checked={config.privacy.encryptMemory} onChange={(v) => updateConfig('privacy.encryptMemory', v)} />
                </SettingRow>
              </motion.div>
              <motion.div variants={itemVariants}>
                <SettingRow label="Telemetry" description="Send anonymous usage data">
                  <Toggle checked={config.privacy.telemetry} onChange={(v) => updateConfig('privacy.telemetry', v)} />
                </SettingRow>
              </motion.div>
              <motion.div variants={itemVariants}>
                <SettingRow label="Crash Reporting" description="Send crash reports for debugging">
                  <Toggle checked={config.privacy.crashReporting} onChange={(v) => updateConfig('privacy.crashReporting', v)} />
                </SettingRow>
              </motion.div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="max-w-2xl space-y-1">
              <motion.h2 variants={itemVariants} className="text-lg font-semibold mb-4">Advanced</motion.h2>
              <motion.div variants={itemVariants}>
                <SettingRow label="Log Level" description="Verbosity of application logs">
                  <InputField value={config.advanced.logLevel} onChange={(v) => updateConfig('advanced.logLevel', v)} />
                </SettingRow>
              </motion.div>
              <motion.div variants={itemVariants}>
                <SettingRow label="Enable Profiling" description="Performance profiling (may slow the app)">
                  <Toggle checked={config.advanced.enableProfiling} onChange={(v) => updateConfig('advanced.enableProfiling', v)} />
                </SettingRow>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
