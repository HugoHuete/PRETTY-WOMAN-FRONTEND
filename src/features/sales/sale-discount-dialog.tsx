import { useEffect, useRef, useState } from "react";
import {
  calculateManualDiscountAmount,
  type SaleDraftLine,
  type SaleManualDiscountType,
} from "./sale-product-types";
import { discountSourceIds } from "./sales-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });

const discountTypeLabels: Record<SaleManualDiscountType, string> = {
  percent: "Porcentaje",
  amount: "Monto",
  final: "Precio final",
};

export function SaleDiscountDialog({
  line,
  onClose,
  onApply,
}: {
  line: SaleDraftLine | null;
  onClose: () => void;
  onApply: (
    variantId: number,
    discountAmount: number,
    type: SaleManualDiscountType | null,
    value: number | null,
  ) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const [type, setType] = useState<SaleManualDiscountType>("percent");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const lineId = line?.productVariantId;
  const isManual = line?.discountSourceId === discountSourceIds.manual;
  const initialType = isManual ? line?.manualDiscountType ?? "amount" : "percent";
  const initialValue = isManual ? String(line?.manualDiscountValue ?? line?.discountAmount ?? "") : "";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!lineId) {
      closingRef.current = false;
      if (dialog?.open) dialog.close();
      return;
    }

    setType(initialType);
    setValue(initialValue);
    setError("");
    if (dialog && !dialog.open && !closingRef.current) dialog.showModal();
    requestAnimationFrame(() => valueRef.current?.focus());
  }, [lineId, initialType, initialValue]);

  const parsedValue = value.trim() === "" ? Number.NaN : Number(value);
  const maxValue = type === "percent" ? 100 : line?.unitPrice ?? 0;
  const validValue = Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= maxValue;
  const previewDiscount = line && validValue
    ? calculateManualDiscountAmount(type, parsedValue, line.unitPrice)
    : null;
  const previewPrice = line && previewDiscount !== null ? line.unitPrice - previewDiscount : null;
  const hasCampaign = Boolean(line?.campaignId && (line.campaignDiscountAmount ?? 0) > 0);
  const hasManualDiscount = isManual;

  const handleApply = () => {
    if (!line) return;
    if (!validValue || previewDiscount === null) {
      setError(type === "percent"
        ? "Ingresa un porcentaje entre 0 y 100."
        : `Ingresa un monto entre ${money.format(0)} y ${money.format(line.unitPrice)}.`);
      return;
    }

    const discountAmount = Math.min(line.unitPrice, Math.max(0, previewDiscount));
    closingRef.current = true;
    onApply(
      line.productVariantId,
      discountAmount,
      discountAmount > 0 ? type : null,
      discountAmount > 0 ? parsedValue : null,
    );
    dialogRef.current?.close();
  };

  const handleRemove = () => {
    if (!line) return;
    closingRef.current = true;
    onApply(line.productVariantId, 0, null, null);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="sale-discount-title"
      onClose={() => {
        closingRef.current = false;
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50"
    >
      {line ? (
        <div>
          <header className="flex items-start justify-between gap-4 border-b border-pw-line px-5 py-4 sm:px-6">
            <div>
              <h2 id="sale-discount-title" className="text-lg font-extrabold">Aplicar descuento</h2>
              <p className="mt-1 text-sm text-pw-muted">{line.presentationName} · Código {line.productCode}</p>
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
                {(Object.keys(discountTypeLabels) as SaleManualDiscountType[]).map((option) => (
                  <label
                    key={option}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${type === option ? "border-pw-brand bg-pw-brand-soft text-pw-brand-deep" : "border-pw-line text-pw-ink hover:bg-pw-canvas"}`}
                  >
                    <input
                      type="radio"
                      name="sale-discount-type"
                      value={option}
                      checked={type === option}
                      onChange={() => {
                        setType(option);
                        setError("");
                      }}
                      className="accent-pw-brand"
                    />
                    {discountTypeLabels[option]}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-bold">
              {type === "percent" ? "Porcentaje por unidad" : type === "amount" ? "Monto de descuento por unidad" : "Precio final por unidad"}
              <span className="relative">
                <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-pw-muted ${type === "percent" ? "right-3" : "left-3"}`}>
                  {type === "percent" ? "%" : "C$"}
                </span>
                <input
                  ref={valueRef}
                  type="number"
                  min="0"
                  max={maxValue}
                  step="0.01"
                  inputMode="decimal"
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    setError("");
                  }}
                  aria-label={type === "percent" ? "Porcentaje por unidad" : type === "amount" ? "Monto de descuento por unidad" : "Precio final por unidad"}
                  className={`min-h-11 w-full rounded-lg border border-pw-line text-sm font-medium tabular-nums text-pw-ink hover:border-pw-brand/60 focus:border-pw-brand focus:outline-none focus:ring-2 focus:ring-pw-brand-soft ${type === "percent" ? "pl-3 pr-10" : "pl-10 pr-3"}`}
                />
              </span>
            </label>

            <dl aria-live="polite" className="grid gap-2 rounded-xl bg-pw-canvas p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-pw-muted">{hasCampaign ? "Precio regular" : "Precio actual"}</dt>
                <dd className="m-0 font-semibold tabular-nums">{money.format(line.unitPrice)}</dd>
              </div>
              {hasCampaign ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-pw-muted">Con campaña actual</dt>
                  <dd className="m-0 font-semibold tabular-nums">{money.format(line.unitPrice - (line.campaignDiscountAmount ?? 0))}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-pw-line pt-2">
                <dt className="font-bold">{hasCampaign ? "Con descuento manual" : "Con descuento"}</dt>
                <dd className="m-0 font-extrabold tabular-nums">{previewPrice === null ? "—" : money.format(previewPrice)}</dd>
              </div>
            </dl>

            {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-pw-line px-5 py-4 sm:px-6">
            <div>
              {hasManualDiscount ? (
                <button type="button" onClick={handleRemove} className="min-h-10 rounded-lg px-2 text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                  Quitar descuento
                </button>
              ) : null}
            </div>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => dialogRef.current?.close()} className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold text-pw-ink hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand">
                Cancelar
              </button>
              <button type="button" onClick={handleApply} className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-bold text-white hover:bg-pw-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:opacity-60">
                Aplicar descuento
              </button>
            </div>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
