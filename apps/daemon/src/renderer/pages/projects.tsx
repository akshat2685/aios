import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderGit, Plus, Trash2, Terminal as TerminalIcon, Play, FileCode2, MessageSquare, Save, X, Cpu } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { cn } from '@/lib/utils';

export function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  
  // Terminal state
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    '> Initializing AIOS Workspace Environment...',
    '> Connecting to local daemon...',
    '> Ready.'
  ]);
  const [terminalInput, setTerminalInput] = useState('');

  // Editor State
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('// Select a file to view or edit');
  const [liveDiff, setLiveDiff] = useState<string | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: string, text: string}[]>([
    { role: 'assistant', text: 'Hello! I am your AI Software Engineer. What are we building today?' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const loadProjects = async () => {
    const api = getElectronAPI();
    const data = await api.graph.getProjects();
    setProjects(data);
    if (data.length > 0 && !activeProjectId) {
      setActiveProjectId(data[0].id);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async () => {
    const api = getElectronAPI();
    await api.graph.createProject({ name: 'New Project' });
    loadProjects();
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;
    setTerminalOutput(prev => [...prev, `> ${terminalInput}`, `Executing: ${terminalInput}... (simulated)`]);
    setTerminalInput('');
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { role: 'user', text: chatInput }]);
    
    // Simulate AI response and live diff
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'I can help with that. Let me propose a change.' }]);
      setLiveDiff(`- const oldVar = true;
+ const newVar = false;`);
    }, 1000);
    
    setChatInput('');
  };

  // Snappy framer motion variants
  const boxVariant = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-bg-primary overflow-hidden">
      <div className="flex items-center gap-3 mb-4 px-2">
        <Cpu className="text-accent" size={24} />
        <h1 className="text-xl font-semibold tracking-tight">Agentic Workspace</h1>
        <div className="ml-auto flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs bg-glass hover:bg-glass-hover rounded-md border border-glass-border flex items-center gap-2">
            <Play size={12} /> Run Task
          </button>
        </div>
      </div>
      
      {/* Bento Box Grid Layout */}
      <div className="flex-1 grid grid-cols-12 grid-rows-12 gap-4 overflow-hidden">
        
        {/* Left Sidebar - File Tree / Projects */}
        <motion.div 
          variants={boxVariant} initial="hidden" animate="visible"
          className="col-span-3 row-span-12 glass-strong rounded-2xl p-4 flex flex-col gap-4 border border-glass-border shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Projects</h2>
            <button onClick={handleCreateProject} className="p-1 hover:bg-white/10 rounded"><Plus size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {projects.map((proj) => (
              <div 
                key={proj.id}
                onClick={() => setActiveProjectId(proj.id)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm",
                  activeProjectId === proj.id ? "bg-accent/20 text-accent border border-accent/30" : "hover:bg-glass text-foreground/80"
                )}
              >
                <FolderGit size={14} />
                <span className="truncate">{proj.name}</span>
              </div>
            ))}
            
            {/* Mock Files */}
            <div className="mt-4 pt-4 border-t border-glass-border">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Files</h2>
              {['index.ts', 'App.tsx', 'utils.ts'].map(file => (
                <div 
                  key={file}
                  onClick={() => { setActiveFile(file); setFileContent(`// Content of ${file}\nexport const init = () => {};`); }}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm",
                    activeFile === file ? "bg-white/10 text-white" : "hover:bg-glass text-foreground/80"
                  )}
                >
                  <FileCode2 size={14} />
                  <span>{file}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Center Top - Editor / Live Diff */}
        <motion.div 
          variants={boxVariant} initial="hidden" animate="visible" transition={{ delay: 0.1 }}
          className="col-span-6 row-span-8 glass-strong rounded-2xl flex flex-col border border-glass-border shadow-lg overflow-hidden relative"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-glass-border bg-black/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCode2 size={14} /> {activeFile || 'Editor'}
            </div>
            {liveDiff && (
              <div className="flex gap-2">
                <button className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded flex items-center gap-1 hover:bg-red-500/30" onClick={() => setLiveDiff(null)}><X size={12}/> Reject</button>
                <button className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded flex items-center gap-1 hover:bg-green-500/30" onClick={() => { setFileContent(prev => prev + '\n// applied diff'); setLiveDiff(null); }}><Save size={12}/> Accept</button>
              </div>
            )}
          </div>
          <div className="flex-1 p-4 font-mono text-sm overflow-auto whitespace-pre">
            {fileContent}
            
            {liveDiff && (
              <AnimatePresence>
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 bg-black/40 border border-primary/30 rounded-xl"
                >
                  <div className="text-xs text-primary mb-2 flex items-center gap-2">✨ AI Proposed Changes</div>
                  {liveDiff.split('\n').map((line, i) => (
                    <div key={i} className={cn("px-2", line.startsWith('+') ? 'bg-green-500/10 text-green-400' : line.startsWith('-') ? 'bg-red-500/10 text-red-400' : 'text-muted-foreground')}>
                      {line}
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Right Sidebar - AI Chat */}
        <motion.div 
          variants={boxVariant} initial="hidden" animate="visible" transition={{ delay: 0.2 }}
          className="col-span-3 row-span-12 glass-strong rounded-2xl flex flex-col border border-glass-border shadow-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-glass-border flex items-center gap-2 bg-black/20">
            <MessageSquare size={14} className="text-primary" />
            <span className="text-sm font-semibold">AI Copilot</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex flex-col max-w-[90%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                <div className={cn(
                  "p-3 rounded-2xl text-sm shadow-sm",
                  msg.role === 'user' ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-glass border border-glass-border rounded-bl-sm"
                )}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-glass-border bg-black/20">
            <form onSubmit={handleChatSubmit} className="relative">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask Claude..."
                className="w-full bg-black/40 border border-glass-border rounded-xl pl-4 pr-10 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-primary/20 rounded-lg">
                <Play size={14} />
              </button>
            </form>
          </div>
        </motion.div>

        {/* Center Bottom - Terminal */}
        <motion.div 
          variants={boxVariant} initial="hidden" animate="visible" transition={{ delay: 0.15 }}
          className="col-span-6 row-span-4 glass-strong rounded-2xl flex flex-col border border-glass-border shadow-lg overflow-hidden"
        >
          <div className="px-4 py-1.5 border-b border-glass-border flex items-center gap-2 bg-black/20 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <TerminalIcon size={12} /> Terminal
          </div>
          <div className="flex-1 bg-black/60 p-3 font-mono text-xs overflow-y-auto flex flex-col">
            <div className="flex-1 space-y-1">
              {terminalOutput.map((line, i) => (
                <div key={i} className="text-gray-300">{line}</div>
              ))}
            </div>
            <form onSubmit={handleTerminalSubmit} className="flex gap-2 mt-2 pt-2 border-t border-glass-border/30 text-green-400">
              <span>$</span>
              <input 
                type="text" 
                value={terminalInput}
                onChange={e => setTerminalInput(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                autoFocus
              />
            </form>
          </div>
        </motion.div>
        
      </div>
    </div >
  );
}
