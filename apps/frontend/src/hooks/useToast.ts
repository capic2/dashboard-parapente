import { create } from 'zustand';

interface Toast {
  id: string;
  title: string;
  type: 'success' | 'error' | 'info';
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));
    
    // Auto-remove après 5 secondes
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
}));

export function useToast() {
  const { addToast } = useToastStore();

  return {
    success: (title: string) => addToast({ title, type: 'success' }),
    error: (title: string) => addToast({ title, type: 'error' }),
    info: (title: string) => addToast({ title, type: 'info' })
  };
}
