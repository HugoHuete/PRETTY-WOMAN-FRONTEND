import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { ToastContext, type Toast } from './toast-context';

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = useCallback((nextToast: Toast) => setToast(nextToast), []);
  const value = useMemo(() => ({ showToast }), [showToast]);
  const role = toast?.tone === 'error' ? 'alert' : 'status';

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          className="fixed right-4 bottom-4 z-50 max-w-sm rounded-xl border border-pw-line bg-white p-4 shadow-lg"
          role={role}
        >
          <p className="font-extrabold">{toast.title}</p>
          {toast.detail ? <p className="mt-1 text-sm text-pw-muted">{toast.detail}</p> : null}
          <button
            className="mt-3 min-h-9 text-xs font-extrabold text-pw-brand-deep underline focus-visible:outline-2 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
            type="button"
            onClick={() => setToast(null)}
          >
            Cerrar aviso
          </button>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
