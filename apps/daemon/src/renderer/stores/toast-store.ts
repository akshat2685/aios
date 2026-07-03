import { create } from 'zustand';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    if (toast.duration !== 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, toast.duration || 4000);
    }
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Global helper for easy access outside React components
export const toast = {
  info: (title: string, message?: string, duration?: number) => useToastStore.getState().addToast({ title, message, type: 'info', duration }),
  success: (title: string, message?: string, duration?: number) => useToastStore.getState().addToast({ title, message, type: 'success', duration }),
  warning: (title: string, message?: string, duration?: number) => useToastStore.getState().addToast({ title, message, type: 'warning', duration }),
  error: (title: string, message?: string, duration?: number) => useToastStore.getState().addToast({ title, message, type: 'error', duration }),
};
