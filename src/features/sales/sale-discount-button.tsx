import type { SaleDraftLine } from "./sale-product-types";
import { discountSourceIds } from "./sales-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });

export function SaleDiscountButton({ line, onClick, compact = false }: {
  line: SaleDraftLine;
  onClick: () => void;
  compact?: boolean;
}) {
  const isManual = line.discountSourceId === discountSourceIds.manual;
  const isCampaign = line.discountSourceId === discountSourceIds.campaign;
  const isEmployee = line.discountSourceId === discountSourceIds.employee;
  const manualValue = line.manualDiscountValue ?? line.discountAmount;
  const primaryText = isManual
    ? line.manualDiscountType === "percent"
      ? `${manualValue}%`
      : line.manualDiscountType === "final"
        ? money.format(line.unitPrice - line.discountAmount)
        : `− ${money.format(line.discountAmount)}`
    : isCampaign ? money.format(line.discountAmount) : isEmployee ? `− ${money.format(line.discountAmount)}` : "Agregar";
  const secondaryText = isManual
    ? line.manualDiscountType === "percent"
      ? `− ${money.format(line.discountAmount)} c/u`
      : line.manualDiscountType === "final" ? "precio final" : "por unidad"
    : isCampaign ? "Campaña" : isEmployee ? "Empleado" : "Descuento";

  return <button
    type="button"
    onClick={onClick}
    aria-haspopup="dialog"
    aria-label={`${isManual ? "Editar" : "Definir"} descuento de ${line.presentationName}`}
    className={`flex w-full items-center justify-between rounded-lg border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand ${compact ? "min-h-9 min-w-0 gap-1.5 px-2 py-1" : "min-h-10 min-w-28 gap-2 px-2.5 py-1.5"} ${isManual ? "border-pw-brand/50 bg-pw-brand-soft/60 text-pw-brand-deep hover:bg-pw-brand-soft" : isCampaign ? "border-green-200 bg-green-50 text-green-800 hover:border-green-300" : "border-pw-line text-pw-muted hover:border-pw-brand/50 hover:bg-pw-brand-soft/40"}`}
  >
    <span className="min-w-0">
      <span className={`block truncate font-bold tabular-nums ${compact ? "text-xs" : "text-sm"}`}>{primaryText}</span>
      <span className={`block truncate font-medium ${compact ? "text-[10px]" : "mt-0.5 text-[11px]"}`}>{secondaryText}</span>
    </span>
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.8 3.8 3.4 3.4M4 16l3.4-.7 8.5-8.5a2.4 2.4 0 0 0-3.4-3.4L4 11.9 4 16Z" />
    </svg>
  </button>;
}
