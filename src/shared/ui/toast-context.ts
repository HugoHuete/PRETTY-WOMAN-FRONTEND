import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';
export type Toast = { tone: ToastTone; title: string; detail?: string };
export type ToastContextValue = { showToast: (toast: Toast) => void };

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe utilizarse dentro de ToastProvider.');
  return context;
}
