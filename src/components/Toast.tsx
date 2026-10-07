import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: { label: string; run: () => void };
}

type ShowToast = (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ShowToast>(
    (message, opts = {}) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, tone: opts.tone ?? 'default', action: opts.action }]);
      setTimeout(() => dismiss(id), opts.action ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>,
      document.body,
      )}
    </ToastContext.Provider>
  );
}
