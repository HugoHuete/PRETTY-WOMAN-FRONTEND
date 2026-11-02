import { useEffect, useMemo, useRef, useState } from "react";
import {
  allocateGlobalManualDiscount,
  type SaleDraftLine,
  type SaleManualDiscountType,
} from "./sale-product-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });

const discountOptions: { value: SaleManualDiscountType; label: string }[] = [
  { value: "percent", label: "Porcentaje" },
  { value: "amount", label: "Monto" },
  { value: "final", label: "Precio final" },
];

export function SaleGlobalDiscountDialog({
  open,
  lines,
  onClose,
  onApply,
  onClear,
}: {
  open: boolean;
  lines: SaleDraftLine[];
  onClose: () => void;
  onApply: (type: SaleManualDiscountType, value: number, discounts: Map<number, number>) => void;
  onClear: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<SaleManualDiscountType>("percent");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const saleLines = useMemo(() => lines.filter((line) => !line.forSelection), [lines]);
  const subtotal = useMemo(
    () => saleLines.reduce((total, line) => total + line.unitPrice * line.quantity, 0),
    [saleLines],
  );
  const parsedValue = value.trim() === "" ? Number.NaN : Number(value);
  const hasCentPrecision = Math.abs(parsedValue * 100 - Math.round(parsedValue * 100)) < 0.000001;
  const isValid = Number.isFinite(parsedValue) && hasCentPrecision && parsedValue >= 0 && (
    type === "percent" ? parsedValue <= 100 : parsedValue <= subtotal
  );
  const validationMessage = type === "percent"
    ? "Ingresa un porcentaje entre 0 y 100, con hasta dos decimales."
    : type === "amount"
      ? `Ingresa un monto entre ${money.format(0)} y ${money.format(subtotal)}, con hasta dos decimales.`
      : `Ingresa un precio final entre ${money.format(0)} y ${money.format(subtotal)}, con hasta dos decimales.`;
  const discounts = useMemo(
    () => isValid ? allocateGlobalManualDiscount(saleLines, type, parsedValue) : new Map<number, number>(),
    [isValid, parsedValue, saleLines, type],
  );
  const totalDiscount = saleLines.reduce(
    (total, line) => total + (discounts.get(line.productVariantId) ?? 0) * line.quantity,
    0,
  );
  const targetDiscount = type === "percent"
    ? null
    : type === "amount" ? parsedValue : subtotal - parsedValue;
  const hasRoundingDifference = isValid && targetDiscount !== null && Math.abs(totalDiscount - targetDiscount) >= 0.01;
  const hasExistingDiscounts = saleLines.some((line) => line.discountAmount > 0);
  const valueLabel = type === "percent"
    ? "Porcentaje de descuento"
    : type === "amount" ? "Monto de descuento para la compra" : "Precio final de la compra";
  const valueDescription = type === "percent"
    ? "Se aplica el mismo porcentaje al precio regular de cada producto."
    : "Se distribuye entre los productos proporcionalmente a su subtotal regular.";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open) {
      if (dialog?.open) dialog.close();
      return;
    }
    setType("percent");
    setValue("");
    setError("");
    if (dialog && !dialog.open) dialog.showModal();
    requestAnimationFrame(() => valueRef.current?.focus());
  }, [open]);

  const apply = () => {
    if (!isValid) {
      setError(validationMessage);
      return;
    }
    onApply(type, parsedValue, discounts);
    dialogRef.current?.close();
  };

  const clearDiscounts = () => {
    onClear();
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="sale-global-discount-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50"
    >
      <header className="flex items-start justify-between gap-4 border-b border-pw-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="sale-global-discount-title" className="text-lg font-extrabold">Descuento global</h2>
          <p className="mt-1 text-sm text-pw-muted">Reemplaza los descuentos actuales y se aplicará a los productos agregados en este momento.</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Cerrar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-lg text-pw-muted hover:bg-pw-brand-soft hover:text-pw-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand"
        >
          ×
        </button>
      </header>

      <div className="grid gap-5 px-5 py-5 sm:px-6">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Forma de cálculo</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {discountOptions.map((option) => (
              <label
                key={option.value}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${type === option.value ? "border-pw-brand bg-pw-brand-soft text-pw-brand-deep" : "border-pw-line text-pw-ink hover:bg-pw-canvas"}`}
              >
                <input
                  type="radio"
                  name="sale-global-discount-type"
                  value={option.value}
                  checked={type === option.value}
                  onChange={() => {
                    setType(option.value);
                    setError("");
                  }}
                  className="accent-pw-brand"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="grid gap-2 text-sm font-bold">
          {valueLabel}
          <span className="relative">
            <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-pw-muted ${type === "percent" ? "right-3" : "left-3"}`}>
              {type === "percent" ? "%" : "C$"}
            </span>
            <input
              ref={valueRef}
              type="number"
              min="0"
              max={type === "percent" ? 100 : subtotal}
              step="0.01"
              inputMode="decimal"
              value={value}
              aria-invalid={!isValid && value.trim() !== ""}
              onChange={(event) => {
                setValue(event.target.value);
                setError("");
              }}
              aria-label={valueLabel}
              className={`min-h-11 w-full rounded-lg border border-pw-line text-sm font-medium tabular-nums text-pw-ink hover:border-pw-brand/60 focus:border-pw-brand focus:outline-none focus:ring-2 focus:ring-pw-brand-soft ${type === "percent" ? "pl-3 pr-10" : "pl-10 pr-3"}`}
            />
          </span>
          <span className="font-medium text-pw-muted">{valueDescription}</span>
        </label>

        <section aria-label="Vista previa del descuento" className="rounded-xl bg-pw-canvas p-4">
          <dl className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-pw-muted">Subtotal regular</dt>
              <dd className="m-0 font-semibold tabular-nums">{money.format(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-pw-muted">Descuento distribuido</dt>
              <dd className="m-0 font-semibold tabular-nums">− {money.format(totalDiscount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-pw-line pt-2">
              <dt className="font-bold">Total con descuento</dt>
              <dd className="m-0 font-extrabold tabular-nums">{money.format(subtotal - totalDiscount)}</dd>
            </div>
          </dl>
          <ul className="mt-3 divide-y divide-pw-line border-t border-pw-line text-sm">
            {saleLines.map((line) => {
              const unitDiscount = discounts.get(line.productVariantId) ?? 0;
              return (
                <li key={line.productVariantId} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{line.presentationName}</span>
                    <span className="block text-xs text-pw-muted">Código {line.productCode} · {line.quantity} {line.quantity === 1 ? "unidad" : "unidades"}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block font-semibold">− {money.format(unitDiscount * line.quantity)}</span>
                    <span className="block text-xs text-pw-muted">{money.format(unitDiscount)} c/u</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {hasRoundingDifference ? (
            <p className="mt-3 text-xs text-pw-muted">
              La API guarda el descuento por unidad; por el redondeo, el resultado distribuido puede diferir unos centavos del valor solicitado.
            </p>
          ) : null}
        </section>

        {error || (value.trim() !== "" && !isValid) ? (
          <p role="alert" className="text-sm font-semibold text-red-700">{error || validationMessage}</p>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-pw-line px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={clearDiscounts}
          disabled={!hasExistingDiscounts}
          className="min-h-10 rounded-lg px-2 text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Quitar descuentos actuales
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold text-pw-ink hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!isValid}
            className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar descuento
          </button>
        </div>
      </footer>
    </dialog>
  );
}
