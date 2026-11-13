import type { FinancialMovement } from "./finance-types";
import { canManageFinanceMovementManually } from "./finance-api";

type FinanceMovementDetailProps = {
  movement: FinancialMovement;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("es-NI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function optionalValue(value: number | string | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export function FinanceMovementDetail({ movement, onClose, onEdit, onDelete }: FinanceMovementDetailProps) {
  const isManual = canManageFinanceMovementManually(movement);
  const references = [
    ["Pedido", movement.orderId],
    ["Movimiento de pago de venta", movement.salePaymentMovementId],
    ["Conciliación de agencia", movement.deliveryAgencyReconciliationId],
    ["Préstamo", movement.loanId],
    ["Pago de préstamo", movement.loanPaymentId],
  ] as const;

  return (
    <aside aria-label={`Detalle del movimiento ${movement.id}`} className="min-w-0 rounded-xl border border-pw-line bg-white p-5" role="complementary">
      <div className="flex items-start justify-between gap-4 border-b border-pw-line pb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-pw-ink">Detalle del movimiento</h2>
          <p className="mt-1 break-words text-sm text-pw-muted">{movement.description || "Movimiento sin descripción"}</p>
        </div>
        <button className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-pw-line px-3 text-sm font-bold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" onClick={onClose} type="button">
          Cerrar detalle
        </button>
      </div>

      {isManual && (onEdit || onDelete) ? <div className="mt-4 flex flex-wrap gap-2">
        {onEdit ? <button className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" onClick={onEdit} type="button">Editar movimiento</button> : null}
        {onDelete ? <button className="min-h-10 rounded-lg border border-red-200 px-4 text-sm font-extrabold text-red-700 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-red-700 focus-visible:outline-offset-2" onClick={onDelete} type="button">Eliminar movimiento</button> : null}
      </div> : null}

      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Fecha del movimiento</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{formatDate(movement.movementDate)}</dd></div>
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Registrado</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{formatDate(movement.createdAt)}</dd></div>
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Tipo</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{movement.financialMovementTypeLabel || "—"}</dd></div>
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Dirección</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{movement.movementDirectionLabel || "—"}</dd></div>
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Monto reportado</dt><dd className="mt-1 text-sm font-extrabold tabular-nums text-pw-ink">{formatAmount(movement.amount)}</dd></div>
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Tipo de cambio</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-pw-ink">{optionalValue(movement.exchangeRate)}</dd></div>
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Origen</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{movement.originLabel || "—"}</dd></div>
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Categoría de gasto</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{optionalValue(movement.expenseCategoryId)}</dd></div>
        {references.map(([label, value]) => <div key={label}><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">{label}</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{optionalValue(value)}</dd></div>)}
        <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Comentarios</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-pw-ink">{movement.comments || "—"}</dd></div>
      </dl>
    </aside>
  );
}
