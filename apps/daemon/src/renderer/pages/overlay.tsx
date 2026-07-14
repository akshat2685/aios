/**
 * Standalone Overlay Page (Claude Desktop Style)
 *
 * This page renders in a separate, frameless, always-on-top BrowserWindow.
 * It provides a floating, OS-level AI chat and command center.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Paperclip, Mic, Send, X, Terminal, Cpu } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { cn } from '@/lib/utils';

export default function OverlayPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const api = getElectronAPI();

  useEffect(() => {
    // Focus on mount
    setTimeout(() => inputRef.current?.focus(), 100);

    // Escape to hide
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        api.launcher.hide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [api]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    const currentInput = input;
    setInput('');

    // Simulate AI thinking and response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', text: `I can help with that. Executing command for "${currentInput}"...` }]);
    }, 600);
  };

  return (
    <div className="h-screen w-screen bg-transparent flex flex-col justify-end items-center p-6 pb-12 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-2xl bg-[rgba(9,9,11,0.85)] backdrop-blur-3xl border border-[rgba(255,255,255,0.12)] shadow-2xl rounded-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)] bg-white/5 drag-region">
          <div className="flex items-center gap-2 text-primary">
            <Cpu size={16} />
            <span className="text-sm font-semibold tracking-wide">AIOS Assistant</span>
          </div>
          <div className="flex items-center gap-2 no-drag">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-muted-foreground border border-white/10">ESC to hide</kbd>
            <button onClick={() => api.launcher.hide()} className="p-1 hover:bg-white/10 rounded-full text-muted-foreground transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-drag">
          {messages.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <MessageSquare size={32} className="opacity-50" />
              <p className="text-sm">How can I help you today?</p>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-primary text-primary-foreground rounded-br-sm shadow-md" 
                      : "bg-white/10 border border-white/5 rounded-bl-sm text-foreground shadow-sm"
                  )}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.06)] bg-black/20 no-drag">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-1.5 pl-4 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AIOS to do anything..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1">
              <button type="button" className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-xl transition-colors">
                <Paperclip size={16} />
              </button>
              <button type="button" className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-xl transition-colors">
                <Mic size={16} />
              </button>
              <button 
                type="submit" 
                disabled={!input.trim()}
                className="p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
