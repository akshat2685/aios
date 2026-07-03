import { create } from 'zustand';
import { getElectronAPI } from '@/lib/electron-api';
import { useAppStore } from './app-store';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agentId?: string;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  agentId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model?: string;
}

interface ChatState {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
  isStreaming: boolean;
  selectedModel: string;
  selectedAgent: string;

  // Actions
  createConversation: (agentId?: string) => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setSelectedModel: (model: string) => void;
  setSelectedAgent: (agentId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  appendStreamChunk: (conversationId: string, chunk: string) => void;
  finalizeStream: (conversationId: string) => void;
  getActiveConversation: () => Conversation | null;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function generateTitle(message: string): string {
  const words = message.split(' ').slice(0, 6).join(' ');
  return words.length > 40 ? words.substring(0, 40) + '...' : words;
}

// Load conversations from localStorage
function loadConversations(): Record<string, Conversation> {
  try {
    const stored = localStorage.getItem('aios-conversations');
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return {};
}

// Save conversations to localStorage
function saveConversations(conversations: Record<string, Conversation>) {
  try {
    localStorage.setItem('aios-conversations', JSON.stringify(conversations));
  } catch {
    // ignore
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: loadConversations(),
  activeConversationId: null,
  isStreaming: false,
  selectedModel: 'qwen2.5:8b',
  selectedAgent: 'assistant',

  createConversation: (agentId) => {
    const id = generateId();
    const agent = agentId || get().selectedAgent;
    
    const cloudMode = useAppStore.getState().cloudMode;
    let autoModel = get().selectedModel;
    
    // Only apply default fallbacks if absolutely no model is selected
    if (!autoModel) {
      if (cloudMode === 'local') {
        autoModel = 'llama3.2:latest';
      } else {
        autoModel = 'gemini-1.5-flash';
      }
    }

    const conversation: Conversation = {
      id,
      title: 'New Conversation',
      agentId: agent,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: autoModel,
    };
    set((s) => {
      const updated = { ...s.conversations, [id]: conversation };
      saveConversations(updated);
      return { conversations: updated, activeConversationId: id };
    });
    return id;
  },

  deleteConversation: (id) => {
    set((s) => {
      const updated = { ...s.conversations };
      delete updated[id];
      saveConversations(updated);
      return {
        conversations: updated,
        activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
      };
    });
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),

  sendMessage: async (content: string) => {
    const state = get();
    const api = getElectronAPI();

    // Create conversation if needed
    let conversationId = state.activeConversationId;
    if (!conversationId) {
      conversationId = state.createConversation();
    }

    const conversation = get().conversations[conversationId];
    if (!conversation) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    // Add placeholder assistant message for streaming
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      agentId: conversation.agentId,
      isStreaming: true,
    };

    // Update title on first message
    const isFirstMessage = conversation.messages.length === 0;
    const title = isFirstMessage ? generateTitle(content) : conversation.title;

    set((s) => {
      const conv = s.conversations[conversationId!];
      if (!conv) return s;
      const updated = {
        ...s.conversations,
        [conversationId!]: {
          ...conv,
          title,
          messages: [...conv.messages, userMessage, assistantMessage],
          updatedAt: Date.now(),
        },
      };
      saveConversations(updated);
      return { conversations: updated, isStreaming: true };
    });

    try {
      const agentSystemPrompts: Record<string, string> = {
        assistant: `You are the AIOS Personal Assistant. You help the user manage their local AI OS, organize knowledge, and coordinate other specialized agents. Be concise, professional, and prioritize privacy and local-first operations.`,
        coder: `You are the AIOS Coding Agent. You are an expert software engineer. Your goal is to write production-grade, modular, and strongly typed code. Follow SOLID principles and Clean Architecture. Always consider performance and security.`,
        researcher: `You are the AIOS Research Agent. You specialize in gathering information, summarizing documents, and verifying facts. provide citations and maintain high academic rigor.`,
        planner: `You are the AIOS Planner Agent. You break down complex goals into actionable tasks, create roadmaps, and manage dependencies. Focus on efficiency and risk mitigation.`,
      };

      const systemPrompt = agentSystemPrompts[conversation.agentId] || '';

      // Call streaming IPC endpoint
      await api.llm.stream({
        prompt: content,
        model: conversation.model || state.selectedModel,
        systemPrompt,
        conversationId: conversationId!,
      });
    } catch (error: any) {
      // Update with error message
      set((s) => {
        const conv = s.conversations[conversationId!];
        if (!conv) return s;
        const messages = conv.messages.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: `Error: ${error.message}`, isStreaming: false }
            : m
        );
        const updated = {
          ...s.conversations,
          [conversationId!]: { ...conv, messages, updatedAt: Date.now() },
        };
        saveConversations(updated);
        return { conversations: updated, isStreaming: false };
      });
    }
  },

  stopStreaming: () => {
    const activeId = get().activeConversationId;
    if (activeId) {
      getElectronAPI().llm.stopStream(activeId);
    }
    set({ isStreaming: false });
  },

  appendStreamChunk: (conversationId, chunk) => {
    set((s) => {
      const conv = s.conversations[conversationId];
      if (!conv) return s;
      const messages = [...conv.messages];
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.isStreaming) {
        messages[messages.length - 1] = { ...lastMsg, content: lastMsg.content + chunk };
      }
      const updated = { ...s.conversations, [conversationId]: { ...conv, messages } };
      return { conversations: updated };
    });
  },

  finalizeStream: (conversationId) => {
    set((s) => {
      const conv = s.conversations[conversationId];
      if (!conv) return s;
      const messages = conv.messages.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false } : m
      );
      const updated = {
        ...s.conversations,
        [conversationId]: { ...conv, messages, updatedAt: Date.now() },
      };
      saveConversations(updated);
      return { conversations: updated, isStreaming: false };
    });
  },

  getActiveConversation: () => {
    const state = get();
    if (!state.activeConversationId) return null;
    return state.conversations[state.activeConversationId] || null;
  },
}));

// Subscribe to Electron IPC stream events globally
const apiBridge = getElectronAPI();
apiBridge.on('llm:stream-chunk', (conversationId: string, chunk: string) => {
  useChatStore.getState().appendStreamChunk(conversationId, chunk);
});
apiBridge.on('llm:stream-end', (conversationId: string) => {
  useChatStore.getState().finalizeStream(conversationId);
});
apiBridge.on('llm:stream-error', (conversationId: string, error: string) => {
  useChatStore.getState().appendStreamChunk(conversationId, `\n\n[Stream Error: ${error}]`);
  useChatStore.getState().finalizeStream(conversationId);
});
