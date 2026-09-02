'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, description?: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, description }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const success = useCallback((msg: string, desc?: string) => showToast('success', msg, desc), [showToast]);
  const error = useCallback((msg: string, desc?: string) => showToast('error', msg, desc), [showToast]);
  const warning = useCallback((msg: string, desc?: string) => showToast('warning', msg, desc), [showToast]);
  const info = useCallback((msg: string, desc?: string) => showToast('info', msg, desc), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 pointer-events-none flex flex-col gap-2.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all animate-in slide-in-from-top-3 duration-300 ${
              toast.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/40 text-white'
                : toast.type === 'error'
                ? 'bg-slate-900/95 border-red-500/40 text-white'
                : toast.type === 'warning'
                ? 'bg-slate-900/95 border-amber-500/40 text-white'
                : 'bg-slate-900/95 border-blue-500/40 text-white'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={20} className="text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle size={20} className="text-red-400" />}
              {toast.type === 'warning' && <AlertTriangle size={20} className="text-amber-400" />}
              {toast.type === 'info' && <Info size={20} className="text-blue-400" />}
            </div>

            <div className="flex-1 text-xs">
              <p className="font-bold leading-tight">{toast.message}</p>
              {toast.description && (
                <p className="text-slate-400 mt-0.5 leading-relaxed">{toast.description}</p>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
              aria-label="Fechar notificação"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser utilizado dentro de um ToastProvider');
  }
  return context;
}
