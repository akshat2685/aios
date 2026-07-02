import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderDot, Users, StickyNote, Settings2, FileText, 
  Search, Plus, Trash2, BrainCircuit
} from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'project', label: 'Projects', icon: FolderDot },
  { id: 'person', label: 'People', icon: Users },
  { id: 'note', label: 'Notes', icon: StickyNote },
  { id: 'preference', label: 'Preferences', icon: Settings2 },
  { id: 'document', label: 'Documents', icon: FileText },
];

export default function MemoryPage() {
  const api = getElectronAPI();
  const [activeTab, setActiveTab] = useState('preference');
  const [query, setQuery] = useState('');
  const [memories, setMemories] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newKey, setNewKey] = useState('');

  const fetchMemories = async () => {
    try {
      const results = await api.memory.searchTyped({ type: activeTab, query: query || '', limit: 50 });
      setMemories(results);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [activeTab, query]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    
    let metadata: any = {};
    if (activeTab === 'preference') metadata.key = newKey || 'general';
    if (activeTab === 'project') metadata.projectId = newKey || 'general';
    if (activeTab === 'person') metadata.name = newKey || 'unknown';
    if (activeTab === 'note') metadata.topic = newKey || 'general';

    await api.memory.save({ type: activeTab, content: newContent, metadata });
    setNewContent('');
    setNewKey('');
    setIsAdding(false);
    fetchMemories();
  };

  const handleDelete = async (id: string) => {
    await api.memory.delete(id);
    fetchMemories();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col p-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
          <BrainCircuit size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Long-Term Memory</h1>
          <p className="text-muted-foreground text-sm">Semantic context available to AIOS agents</p>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden gap-6">
        {/* Categories Sidebar */}
        <div className="w-64 flex flex-col gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left',
                  active
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : 'bg-glass border border-glass-border text-muted-foreground hover:text-foreground hover:bg-glass-strong'
                )}
              >
                <Icon size={18} />
                <span className="font-medium">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 glass border border-glass-border rounded-2xl flex flex-col overflow-hidden relative">
          
          {/* Top Bar: Search & Add */}
          <div className="p-4 border-b border-glass-border flex items-center gap-4 bg-background/50 backdrop-blur-md">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${CATEGORIES.find(c => c.id === activeTab)?.label.toLowerCase()}...`}
                className="w-full bg-glass border border-glass-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2"
            >
              <Plus size={16} />
              Add Entry
            </button>
          </div>

          {/* Add Entry Form (Collapsible) */}
          <AnimatePresence>
            {isAdding && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-glass-border bg-glass-strong overflow-hidden"
              >
                <div className="p-4 flex flex-col gap-3">
                  <input 
                    type="text" 
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder={activeTab === 'preference' ? 'Key (e.g. language, format)' : activeTab === 'project' ? 'Project ID' : activeTab === 'person' ? 'Name' : 'Topic / Title'}
                    className="w-full bg-background border border-glass-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                  />
                  <textarea 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Context, notes, or rules..."
                    className="w-full bg-background border border-glass-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 min-h-[100px] resize-y"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-glass text-muted-foreground">Cancel</button>
                    <button onClick={handleAdd} className="px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground font-medium">Save Entry</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Memory List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {memories.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <BrainCircuit size={48} className="mb-4 opacity-20" />
                <p>No memories found for this category.</p>
              </div>
            ) : (
              memories.map((mem) => (
                <motion.div 
                  key={mem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-glass border border-glass-border rounded-xl p-4 flex gap-4 group hover:border-primary/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono px-2 py-1 bg-glass-strong rounded-md text-primary">
                        {mem.metadata.key || mem.metadata.projectId || mem.metadata.name || mem.metadata.topic || 'General'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(mem.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{mem.content}</p>
                  </div>
                  <button 
                    onClick={() => handleDelete(mem.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 h-fit rounded-lg hover:bg-red-500/20 text-red-400 transition-all duration-200"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
