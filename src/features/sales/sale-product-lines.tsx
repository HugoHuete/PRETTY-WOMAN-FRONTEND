import { useState } from "react";
import type { SaleDraftLine, SaleManualDiscountType } from "./sale-product-types";
import { discountSourceIds } from "./sales-types";
import { SelectControl, type SelectOption } from "../../shared/ui/select-control";
import type { ProductVariantDTO } from "../products/product-types";
import { SaleDiscountDialog } from "./sale-discount-dialog";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });

function lineTotal(line: SaleDraftLine) {
  return (line.unitPrice - line.discountAmount) * line.quantity;
}

export function SaleProductLines({
  lines,
  onChange,
  onChangeVariant,
  onRemove,
}: {
  lines: SaleDraftLine[];
  onChange: (lines: SaleDraftLine[]) => void;
  onChangeVariant: (currentVariantId: number, variant: ProductVariantDTO) => void;
  onRemove: (id: number) => void;
}) {
  const [discountLineId, setDiscountLineId] = useState<number | null>(null);
  const update = (id: number, patch: Partial<SaleDraftLine>) => {
    onChange(lines.map((line) => line.productVariantId === id ? { ...line, ...patch } : line));
  };

  const removeButton = (line: SaleDraftLine) => (
    <button
      type="button"
      onClick={() => onRemove(line.productVariantId)}
      aria-label={`Quitar ${line.presentationName} de la venta`}
      title="Quitar de la venta"
      className="grid min-h-10 min-w-10 shrink-0 place-items-center rounded-lg text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16" />
        <path d="M10 11v6M14 11v6" />
        <path d="m5 7 1 13h12l1-13M9 7V4h6v3" />
      </svg>
    </button>
  );

  const quantityControl = (line: SaleDraftLine, inputId?: string, mobile = false) => (
    <input
      id={inputId}
      aria-label={inputId ? undefined : `Cantidad de ${line.presentationName}`}
      type="number"
      min="1"
      max={line.availableQuantity}
      value={line.quantity}
      onChange={(event) => update(line.productVariantId, {
        quantity: Math.max(1, Math.min(line.availableQuantity, Number(event.target.value) || 1)),
      })}
      className={`min-h-10 rounded-lg border border-pw-line px-2 text-center text-sm tabular-nums text-pw-ink focus:border-pw-brand focus:outline-none focus:ring-2 focus:ring-pw-brand-soft ${mobile ? "w-full" : "w-20"}`}
    />
  );

  const applyDiscount = (
    variantId: number,
    discountAmount: number,
    type: SaleManualDiscountType | null,
    value: number | null,
  ) => {
    const line = lines.find((candidate) => candidate.productVariantId === variantId);
    if (!line) return;
    const hasCampaign = line.campaignId != null && (line.campaignDiscountAmount ?? 0) > 0;
    update(variantId, {
      discountAmount: discountAmount > 0 ? discountAmount : (hasCampaign ? (line.campaignDiscountAmount ?? 0) : 0),
      discountSourceId: discountAmount > 0
        ? discountSourceIds.manual
        : (hasCampaign ? discountSourceIds.campaign : discountSourceIds.none),
      discountCampaignId: discountAmount > 0 ? null : (hasCampaign ? line.campaignId ?? null : null),
      manualDiscountType: discountAmount > 0 ? type : null,
      manualDiscountValue: discountAmount > 0 ? value : null,
    });
  };

  const discountButton = (line: SaleDraftLine) => {
    const isManual = line.discountSourceId === discountSourceIds.manual;
    const isCampaign = line.discountSourceId === discountSourceIds.campaign;
    const manualValue = line.manualDiscountValue ?? line.discountAmount;
    const primaryText = isManual
      ? line.manualDiscountType === "percent"
        ? `${manualValue}%`
        : line.manualDiscountType === "final"
          ? money.format(line.unitPrice - line.discountAmount)
          : `− ${money.format(line.discountAmount)}`
      : isCampaign ? money.format(line.discountAmount) : "Agregar";
    const secondaryText = isManual
      ? line.manualDiscountType === "percent"
        ? `− ${money.format(line.discountAmount)} c/u`
        : line.manualDiscountType === "final" ? "precio final" : "por unidad"
      : isCampaign ? "Campaña" : "Descuento";

    return (
      <button
        type="button"
        onClick={() => setDiscountLineId(line.productVariantId)}
        aria-haspopup="dialog"
        aria-label={`${isManual ? "Editar" : "Definir"} descuento de ${line.presentationName}`}
        className={`flex min-h-10 w-full min-w-28 items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand ${isManual ? "border-pw-brand/50 bg-pw-brand-soft/60 text-pw-brand-deep hover:bg-pw-brand-soft" : isCampaign ? "border-green-200 bg-green-50 text-green-800 hover:border-green-300" : "border-pw-line text-pw-muted hover:border-pw-brand/50 hover:bg-pw-brand-soft/40"}`}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold tabular-nums">{primaryText}</span>
          <span className="mt-0.5 block truncate text-[11px] font-medium">{secondaryText}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12.8 3.8 3.4 3.4M4 16l3.4-.7 8.5-8.5a2.4 2.4 0 0 0-3.4-3.4L4 11.9 4 16Z" />
        </svg>
      </button>
    );
  };

  const sizeOptions = (line: SaleDraftLine): SelectOption[] => line.presentationVariants.map((variant) => {
    const selected = variant.id === line.productVariantId;
    const alreadyAdded = lines.some((candidate) => candidate.productVariantId === variant.id && !selected);
    const unavailable = variant.availableQuantity <= 0 && !selected;
    const sizeName = variant.sizeName || "Talla única";
    return {
      value: String(variant.id),
      label: `${sizeName}${unavailable ? " · Sin stock" : alreadyAdded ? " · Ya agregada" : ""}`,
      disabled: unavailable || alreadyAdded,
    };
  });

  const changeVariant = (line: SaleDraftLine, variantId: string) => {
    const variant = line.presentationVariants.find((candidate) => String(candidate.id) === variantId);
    if (variant && variant.id !== line.productVariantId) onChangeVariant(line.productVariantId, variant);
  };

  if (!lines.length) {
    return (
      <div className="rounded-xl border border-dashed border-pw-line px-5 py-8 text-center">
        <p className="font-bold text-pw-ink">Aún no hay prendas en la venta.</p>
        <p className="mt-1 text-sm text-pw-muted">Busca una prenda por código para agregarla.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-pw-line lg:block">
        <table className="w-full min-w-[840px] border-collapse text-left text-sm">
          <caption className="sr-only">Prendas agregadas a la venta</caption>
          <thead className="bg-pw-canvas text-xs font-bold text-pw-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Presentación</th>
              <th scope="col" className="w-24 px-2 py-3">Talla</th>
              <th scope="col" className="px-3 py-3">Precio c/u</th>
              <th scope="col" className="px-3 py-3 text-center">Stock</th>
              <th scope="col" className="px-3 py-3 text-center">Cantidad</th>
              <th scope="col" className="px-3 py-3">Descuento c/u</th>
              <th scope="col" className="px-3 py-3 text-center">Total</th>
              <th scope="col" className="px-3 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pw-line">
            {lines.map((line) => (
              <tr key={line.productVariantId} className="align-middle">
                <th scope="row" className="max-w-64 px-4 py-4 font-semibold text-pw-ink">
                  <div className="flex items-start gap-3">
                    {line.imageUrl ? (
                      <img src={line.imageUrl} alt={line.presentationName} loading="lazy" className="h-16 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div role="img" aria-label="Sin imagen" className="grid h-16 w-12 shrink-0 place-items-center rounded-lg bg-pw-canvas px-1 text-center text-[10px] font-medium text-pw-muted">Sin imagen</div>
                    )}
                    <span className="min-w-0">
                      <span className="block font-extrabold text-pw-ink">{line.presentationName}</span>
                      <span className="mt-1 block text-xs font-medium text-pw-muted">Código {line.productCode}</span>
                    </span>
                  </div>
                </th>
                <td className="w-24 px-2 py-4">
                  {line.presentationVariants?.length ? (
                    <label className="grid max-w-20 gap-1 text-xs font-extrabold text-pw-brand-deep">
                      <span className="sr-only">Cambiar talla de {line.presentationName}</span>
                      <SelectControl
                        id={`sale-size-desktop-${line.productVariantId}`}
                        value={String(line.productVariantId)}
                        options={sizeOptions(line)}
                        onChange={(event) => changeVariant(line, event.target.value)}
                        aria-label={`Cambiar talla de ${line.presentationName}`}
                        portal
                      />
                    </label>
                  ) : <span className="text-sm font-bold text-pw-ink">{line.sizeName || "Talla única"}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-4 tabular-nums text-pw-muted">{money.format(line.unitPrice)}</td>
                <td className="whitespace-nowrap px-3 py-4 text-center tabular-nums text-pw-muted">{line.availableQuantity}</td>
                <td className="px-3 py-4 text-center">
                  {quantityControl(line, `sale-quantity-${line.productVariantId}`)}
                </td>
                <td className="px-3 py-4">
                  {discountButton(line)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-center font-extrabold tabular-nums text-pw-ink">{money.format(lineTotal(line))}</td>
                <td className="px-3 py-4 text-right">
                  {removeButton(line)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-pw-line rounded-xl border border-pw-line lg:hidden">
        {lines.map((line) => (
          <li key={line.productVariantId} className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {line.imageUrl ? (
                  <img src={line.imageUrl} alt={line.presentationName} loading="lazy" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div role="img" aria-label="Sin imagen" className="grid h-20 w-16 shrink-0 place-items-center rounded-lg bg-pw-canvas px-1 text-center text-[10px] font-medium text-pw-muted">Sin imagen</div>
                )}
                <div className="min-w-0">
                  <h3 className="font-extrabold text-pw-ink">{line.presentationName}</h3>
                  <p className="mt-1 text-xs text-pw-muted">Código {line.productCode}</p>
                  <p className="mt-1 text-sm text-pw-muted">{money.format(line.unitPrice)} por unidad · {line.availableQuantity} disponibles</p>
                </div>
              </div>
              {removeButton(line)}
            </div>
            {line.presentationVariants?.length ? (
              <label className="grid gap-1 text-xs font-extrabold text-pw-brand-deep">
                Cambiar talla
                <SelectControl
                  id={`sale-size-mobile-${line.productVariantId}`}
                  value={String(line.productVariantId)}
                  options={sizeOptions(line)}
                  onChange={(event) => changeVariant(line, event.target.value)}
                  aria-label={`Cambiar talla de ${line.presentationName}`}
                />
              </label>
            ) : <p className="text-sm text-pw-muted">Talla: {line.sizeName || "Talla única"}</p>}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs font-extrabold text-pw-muted">
                Cantidad
                {quantityControl(line, undefined, true)}
              </label>
              <div className="grid content-start gap-1 text-xs font-extrabold text-pw-muted">
                <span>Descuento c/u</span>
                {discountButton(line)}
              </div>
            </div>
            <div className="flex justify-between border-t border-pw-line pt-3 text-sm">
              <span className="font-bold text-pw-muted">Total de la prenda</span>
              <strong className="tabular-nums text-pw-ink">{money.format(lineTotal(line))}</strong>
            </div>
          </li>
        ))}
      </ul>
      <SaleDiscountDialog
        line={lines.find((line) => line.productVariantId === discountLineId) ?? null}
        onClose={() => setDiscountLineId(null)}
        onApply={applyDiscount}
      />
    </>
  );
}
