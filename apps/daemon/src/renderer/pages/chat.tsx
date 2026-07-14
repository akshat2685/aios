import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Bot,
  User,
  Copy,
  Check,
  Sparkles,
  Code2,
  FlaskConical,
  ListTodo,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore, type ChatMessage, type Conversation } from '@/stores/chat-store';

// ─── Agent Config ────────────────────────────────────────────
const agentConfig: Record<string, { label: string; icon: any; color: string }> = {
  assistant: { label: 'Assistant', icon: Sparkles, color: 'text-accent' },
  coder: { label: 'Coder', icon: Code2, color: 'text-secondary' },
  researcher: { label: 'Researcher', icon: FlaskConical, color: 'text-success' },
  planner: { label: 'Planner', icon: ListTodo, color: 'text-warning' },
};

// ─── Code Block with Copy ────────────────────────────────────
function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') || '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      {language && (
        <div className="absolute top-0 left-0 px-3 py-1 rounded-tl-[12px] rounded-br-lg bg-glass-strong text-[10px] font-mono text-muted-foreground uppercase">
          {language}
        </div>
      )}
      <button
        aria-label="Copy code"
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-glass-strong border border-glass-border text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      </button>
      <pre className="glass-strong rounded-xl p-4 pt-8 overflow-x-auto">
        <code className={cn('text-sm font-mono leading-relaxed', className)}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const agent = agentConfig[message.agentId || 'assistant'];
  const AgentIcon = agent?.icon || Bot;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('flex gap-3 px-4 py-2', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1',
          isUser
            ? 'bg-accent/20 text-accent'
            : 'bg-glass-strong text-muted-foreground'
        )}
      >
        {isUser ? <User size={14} /> : <AgentIcon size={14} className={agent?.color} />}
      </div>

      {/* Content */}
      <div className={cn('max-w-[75%] min-w-0', isUser ? 'text-right' : 'text-left')}>
        {!isUser && (
          <span className={cn('text-xs font-medium mb-1 block', agent?.color)}>
            {agent?.label || 'AI'}
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed inline-block text-left',
            isUser
              ? 'bg-accent/15 border border-accent/20 text-foreground'
              : 'glass-subtle text-foreground/90'
          )}
        >
          {message.isStreaming && !message.content ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }: any) {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 rounded bg-glass-strong border border-glass-border text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return <CodeBlock className={className}>{String(children).replace(/\n$/, '')}</CodeBlock>;
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0">{children}</p>;
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
                },
                ol({ children }) {
                  return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
                },
                a({ href, children }) {
                  return <a href={href} className="text-accent hover:underline" target="_blank" rel="noreferrer">{children}</a>;
                },
                blockquote({ children }) {
                  return <blockquote className="border-l-2 border-accent/40 pl-3 italic text-muted-foreground my-2">{children}</blockquote>;
                },
                h1({ children }) { return <h1 className="text-lg font-bold mb-2">{children}</h1>; },
                h2({ children }) { return <h2 className="text-base font-semibold mb-2">{children}</h2>; },
                h3({ children }) { return <h3 className="text-sm font-semibold mb-1">{children}</h3>; },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 bg-accent/60 animate-pulse-glow ml-0.5 align-middle rounded-sm" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground mt-1 block">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Chat Input ──────────────────────────────────────────────
function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, isStreaming } = useChatStore();

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  return (
    <div className="p-4 border-t border-glass-border">
      <div className="glass-strong rounded-2xl flex items-end gap-2 p-3">
        <textarea
          ref={textareaRef}
          aria-label="Message input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground resize-none max-h-[200px] leading-relaxed"
          disabled={isStreaming}
        />
        <motion.button
          aria-label="Send message"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={!input.trim() || isStreaming}
          className={cn(
            'p-2.5 rounded-xl transition-all duration-200 flex-shrink-0',
            input.trim() && !isStreaming
              ? 'bg-accent text-white shadow-accent-glow'
              : 'bg-glass text-muted-foreground'
          )}
        >
          {isStreaming ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </motion.button>
      </div>
      <div className="flex items-center gap-2 mt-2 px-1">
        <span className="text-[10px] text-muted-foreground">
          Enter to send · Shift+Enter for newline
        </span>
      </div>
    </div>
  );
}

// ─── Chat Sidebar ────────────────────────────────────────────
function ChatSidebar() {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    createConversation,
    deleteConversation,
    selectedAgent,
    setSelectedAgent,
  } = useChatStore();

  const sorted = Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="w-[240px] border-r border-glass-border flex flex-col h-full">
      {/* New Chat Button */}
      <div className="p-3 border-b border-glass-border">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => createConversation()}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/15 text-accent border border-accent/20 text-sm font-medium hover:bg-accent/20 transition-colors"
        >
          <Plus size={16} />
          New Chat
        </motion.button>
      </div>

      {/* Agent Selector */}
      <div className="p-3 border-b border-glass-border">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block mb-2">
          Agent
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(agentConfig).map(([id, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={id}
                onClick={() => setSelectedAgent(id)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all',
                  selectedAgent === id
                    ? 'bg-glass-strong border border-glass-border text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-glass'
                )}
              >
                <Icon size={12} className={config.color} />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sorted.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No conversations yet
          </div>
        )}
        {sorted.map((conv) => (
          <motion.div
            key={conv.id}
            whileHover={{ x: 2 }}
            className="group relative"
          >
            <button
              onClick={() => setActiveConversation(conv.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2',
                activeConversationId === conv.id
                  ? 'bg-glass-strong text-foreground border border-glass-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-glass'
              )}
            >
              <MessageSquare size={14} className="flex-shrink-0" />
              <span className="truncate flex-1">{conv.title}</span>
            </button>
            <button
              aria-label="Delete conversation"
              onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/20 hover:text-danger transition-all"
            >
              <Trash2 size={12} />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────
function EmptyState() {
  const { createConversation } = useChatStore();

  const suggestions = [
    'Help me write a Python script',
    'Explain how React hooks work',
    'Create a project roadmap for my app',
    'Research the latest AI trends',
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center mx-auto mb-4">
          <Sparkles size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-semibold mb-2">How can I help you?</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Start a conversation with any of my agents — I can code, research, plan, and automate.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {suggestions.map((text) => (
            <motion.button
              key={text}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                createConversation();
                // Small delay to let conversation create, then send
                setTimeout(() => useChatStore.getState().sendMessage(text), 100);
              }}
              className="glass-interactive px-4 py-3 rounded-xl text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {text}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Chat Page ───────────────────────────────────────────────
export default function ChatPage() {
  const { activeConversationId, conversations } = useChatStore();
  const conversation = activeConversationId ? conversations[activeConversationId] : null;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex"
    >
      {/* Sidebar */}
      <ChatSidebar />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {conversation ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-glass-border flex items-center gap-3">
              <div className="flex items-center gap-2">
                {(() => {
                  const agent = agentConfig[conversation.agentId];
                  const Icon = agent?.icon || Bot;
                  return <Icon size={16} className={agent?.color} />;
                })()}
                <span className="text-sm font-medium">{conversation.title}</span>
              </div>
              <span className="text-xs text-muted-foreground ml-auto font-mono">
                {agentConfig[conversation.agentId]?.label || 'AI'} · {conversation.model || 'qwen2.5:8b'}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-4">
              <AnimatePresence>
                {conversation.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput />
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </motion.div>
  );
}
