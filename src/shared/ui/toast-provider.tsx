import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ToastContext, type Toast } from './toast-context';

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = useCallback((nextToast: Toast) => setToast(nextToast), []);
  const value = useMemo(() => ({ showToast }), [showToast]);
  const role = toast?.tone === 'error' ? 'alert' : 'status';
  const duration = toast?.durationMs ?? (toast?.tone === 'error' ? undefined : 4000);

  useEffect(() => {
    if (!toast || duration === undefined) return;
    const timeout = window.setTimeout(() => setToast(null), duration);
    return () => window.clearTimeout(timeout);
  }, [duration, toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          className="fixed top-4 right-4 left-4 z-50 ml-auto flex w-fit max-w-sm items-start gap-3 rounded-xl border border-pw-line bg-white p-4 shadow-lg"
          role={role}
        >
          <div className="min-w-0 wrap-anywhere">
            <p className="font-extrabold">{toast.title}</p>
            {toast.detail ? <p className="mt-1 text-sm text-pw-muted">{toast.detail}</p> : null}
          </div>
          {duration === undefined ? (
            <button
              aria-label="Cerrar aviso"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-lg text-pw-muted hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-pw-brand-deep"
              type="button"
              onClick={() => setToast(null)}
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
