import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderGit, CheckCircle2, Shield, Settings, Trash2, DownloadCloud, Code2 } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { cn } from '@/lib/utils';
import * as Tabs from '@radix-ui/react-tabs';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const api = getElectronAPI();
      const list = await api.plugins.list();
      setPlugins(list);
    } catch (e) {}
  };

  const handleUninstall = async (id: string) => {
    const api = getElectronAPI();
    await api.plugins.uninstall(id);
    fetchData();
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full p-6 flex flex-col"
    >
      <motion.div variants={cardVariants} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <FolderGit className="text-accent" /> Plugin Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extend AIOS capabilities with trusted community plugins.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors rounded-lg text-sm font-medium border border-accent/20">
          <DownloadCloud size={16} /> Install from URL
        </button>
      </motion.div>

      <Tabs.Root defaultValue="installed" className="flex-1 flex flex-col min-h-0">
        <Tabs.List className="flex border-b border-glass-border mb-6">
          <Tabs.Trigger value="installed" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent transition-colors">
            Installed Plugins
          </Tabs.Trigger>
          <Tabs.Trigger value="marketplace" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent transition-colors">
            Marketplace
          </Tabs.Trigger>
          <Tabs.Trigger value="developer" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent transition-colors">
            Developer Mode
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="installed" className="flex-1 overflow-auto outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {plugins.length === 0 ? (
              <div className="col-span-full p-8 glass border border-glass-border rounded-xl text-center text-muted-foreground">
                No plugins installed. Visit the Marketplace to explore extensions.
              </div>
            ) : plugins.map((p, i) => (
              <motion.div key={i} variants={cardVariants} className="glass border border-glass-border rounded-xl p-5 flex flex-col gap-4 group">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {p.manifest.name}
                      <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-glass-subtle border border-glass-border">v{p.manifest.version}</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">by {p.manifest.author}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 border border-success/20 text-success text-xs font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    Running
                  </div>
                </div>

                <p className="text-sm text-muted-foreground flex-1">
                  {p.manifest.description || "No description provided."}
                </p>

                <div className="bg-glass-subtle rounded-lg p-3 border border-glass-border font-mono text-xs">
                  <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Shield size={12} /> Requested Permissions:
                  </div>
                  <ul className="space-y-1">
                    {(p.manifest.permissions || []).map((perm: string) => (
                      <li key={perm} className="flex items-center gap-2 text-foreground">
                        <CheckCircle2 size={12} className="text-accent" /> {perm}
                      </li>
                    ))}
                    {(!p.manifest.permissions || p.manifest.permissions.length === 0) && (
                      <li className="text-muted-foreground italic">None</li>
                    )}
                  </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-glass-border mt-auto">
                  <button className="flex-1 py-1.5 rounded-md text-xs font-medium bg-glass-subtle hover:bg-glass-hover text-foreground transition-colors border border-glass-border">
                    Disable
                  </button>
                  <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground bg-glass-subtle hover:bg-glass-hover transition-colors border border-glass-border">
                    <Settings size={14} />
                  </button>
                  <button onClick={() => handleUninstall(p.manifest.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors border border-glass-border hover:border-danger/20">
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </Tabs.Content>
        
        <Tabs.Content value="marketplace" className="flex-1 flex items-center justify-center text-muted-foreground">
          Marketplace connection not configured.
        </Tabs.Content>

        <Tabs.Content value="developer" className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <Code2 size={48} className="opacity-20" />
          <p>Load unpacked plugins from local directories to test your extensions.</p>
          <button className="px-4 py-2 border border-glass-border rounded-lg hover:bg-glass-hover transition-colors">
            Load Unpacked Plugin...
          </button>
        </Tabs.Content>
      </Tabs.Root>
    </motion.div>
  );
}
