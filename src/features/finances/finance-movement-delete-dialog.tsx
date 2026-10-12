import { useState } from "react";
import { deleteFinanceMovement, type AuthenticatedRequest } from "./finance-api";
import type { FinancialMovement } from "./finance-types";

export function FinanceMovementDeleteDialog({
  movement,
  request,
  onClose,
  onDeleted,
}: {
  movement: FinancialMovement | null;
  request: AuthenticatedRequest;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!movement || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteFinanceMovement(request, movement.id);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar el movimiento.");
    } finally {
      setIsDeleting(false);
    }
  };

  return movement ? <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onClick={(event) => { if (event.target === event.currentTarget && !isDeleting) onClose(); }}
    onKeyDown={(event) => { if (event.key === "Escape" && !isDeleting) onClose(); }}
  >
    <section aria-label="Confirmar eliminación" aria-modal="true" className="w-full max-w-lg rounded-xl border border-pw-line bg-white shadow-xl" role="dialog">
      <header className="border-b border-pw-line p-5">
        <h2 className="text-lg font-extrabold text-pw-ink">Eliminar movimiento</h2>
      </header>
      <div className="space-y-3 p-5">
        <p className="text-sm text-pw-ink">¿Quieres eliminar el movimiento “{movement.description}”? Esta acción no se puede deshacer.</p>
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      </div>
      <footer className="flex flex-col-reverse justify-end gap-2 border-t border-pw-line p-5 sm:flex-row">
        <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeleting} onClick={onClose} type="button">Cancelar</button>
        <button className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-extrabold text-white hover:bg-red-700 focus-visible:outline-3 focus-visible:outline-red-700 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeleting} onClick={() => { void handleDelete(); }} type="button">{isDeleting ? "Eliminando…" : "Eliminar"}</button>
      </footer>
    </section>
  </div> : null;
}
