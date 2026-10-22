import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (title: string, options?: { detail?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (title: string, options?: { detail?: string; tone?: ToastTone }) => {
      const id = ++counter.current;
      setToasts((current) => [...current.slice(-2), { id, title, detail: options?.detail, tone: options?.tone ?? 'success' }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => {
            const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertTriangle : Info;
            return (
              <div key={toast.id} className={`toast toast--${toast.tone}`}>
                <Icon size={18} className="toast__icon" />
                <div className="toast__body">
                  <strong>{toast.title}</strong>
                  {toast.detail && <span>{toast.detail}</span>}
                </div>
                <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="toast__close">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
