import { SaleProductImage } from "./sale-product-image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductDTO, ProductVariantDTO } from "../products/product-types";
import { SelectControl } from "../../shared/ui/select-control";
import { useAuth } from "../auth/auth-provider";
import { getSaleProductsByCodes } from "./sales-api";
import type { SaleDraftLine, SaleManualDiscountType, SaleVariantOption } from "./sale-product-types";
import { SaleProductPicker } from "./sale-product-picker";
import { SaleDiscountButton } from "./sale-discount-button";
import { SaleDiscountDialog } from "./sale-discount-dialog";
import { type SaleDetail, type SaleProductLine, type ReplaceSaleProductsPayload, discountSourceIds } from "./sales-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
type ProductChoice = { product: ProductDTO; presentationId: number; presentationName: string; image: string | null; variant: ProductVariantDTO };
type DraftLine = { saleProductId?: number; productId: string; quantity: string; discountAmount: string; discountSourceId: number; discountCampaignId?: number; manualDiscountType?: SaleManualDiscountType; manualDiscountValue?: number };
function choicesFrom(products: ProductDTO[]): ProductChoice[] {
  return products.flatMap((product) => product.presentations.flatMap((presentation) => presentation.sizes.map((variant) => ({ product, presentationId: presentation.id, presentationName: presentation.name?.trim() || "Presentación", image: presentation.primaryImageUrl || product.primaryImageUrl, variant }))));
}
function findChoice(choices: ProductChoice[], productId: number) { return choices.find((choice) => choice.variant.id === productId); }
function discountDraftLine(line: DraftLine, choice: ProductChoice, choices: ProductChoice[], unitPrice: number, availableQuantity: number): SaleDraftLine {
  const campaignDiscountAmount = line.discountSourceId === discountSourceIds.campaign
    ? Number(line.discountAmount) || 0
    : choice.variant.discountedSalePrice !== null
      && choice.variant.discountCampaignId !== null
      && choice.variant.discountedSalePrice < choice.variant.salePrice
      ? choice.variant.salePrice - choice.variant.discountedSalePrice
      : undefined;
  return {
    productVariantId: choice.variant.id,
    productName: choice.product.name,
    productCode: choice.product.code,
    presentationName: choice.presentationName,
    imageUrl: choice.image,
    presentationVariants: choices.filter((item) => item.presentationId === choice.presentationId).map((item) => item.variant),
    sizeName: choice.variant.sizeName,
    availableQuantity,
    quantity: Number(line.quantity) || 1,
    forSelection: false,
    unitPrice,
    campaignDiscountAmount,
    discountAmount: Number(line.discountAmount) || 0,
    discountSourceId: line.discountSourceId,
    discountCampaignId: line.discountCampaignId ?? null,
    campaignId: line.discountCampaignId ?? choice.variant.discountCampaignId,
    manualDiscountType: line.manualDiscountType ?? "amount",
    manualDiscountValue: line.manualDiscountValue ?? (Number(line.discountAmount) || 0),
  };
}
function ProductThumb({ choice }: { choice?: ProductChoice }) { return choice?.image ? <SaleProductImage src={choice.image} name={`Código ${choice.product.code} · ${choice.presentationName}`} className="h-14 w-12 shrink-0 rounded-lg bg-pw-brand-soft" /> : <span aria-hidden="true" className="grid h-14 w-12 shrink-0 place-items-center rounded-lg bg-pw-brand-soft text-sm font-bold text-pw-brand-deep">{choice ? choice.product.code : "—"}</span>; }

export function SaleDetailProducts({ sale, products, isAdmin, busy, onSave }: {
  sale: SaleDetail; products: ProductDTO[]; isAdmin: boolean; busy: boolean; onSave: (payload: ReplaceSaleProductsPayload) => Promise<boolean>;
}) {
  const { request, session } = useAuth();
  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => draftLinesFromSale(sale));
  const [discountLineIndex, setDiscountLineIndex] = useState<number | null>(null);
  const [additionalChoices, setAdditionalChoices] = useState<ProductChoice[]>([]);
  const [siblingProducts, setSiblingProducts] = useState<ProductDTO[]>([]);
  const requestedProductCodes = useRef(new Set<number>());
  const loadingProductCodes = useRef(false);
  const [error, setError] = useState("");
  const choices = useMemo(() => {
    const allChoices = [...choicesFrom(products), ...choicesFrom(siblingProducts), ...additionalChoices];
    return Array.from(new Map(allChoices.map((choice) => [choice.variant.id, choice])).values());
  }, [products, siblingProducts, additionalChoices]);
  const canEdit = (isAdmin || session?.user.roles.includes("Employee")) && [1, 2, 3].includes(sale.saleStatusId);
  const savedLines = useMemo(() => draftLinesFromSale(sale), [sale.productVariants]);
  const dirty = JSON.stringify(draftLines) !== JSON.stringify(savedLines);

  const loadSiblingVariants = () => {
    if (loadingProductCodes.current) return;
    const codes = [...new Set(products.map((product) => product.code))]
      .filter((code) => code > 0 && !requestedProductCodes.current.has(code));
    if (!codes.length) return;
    codes.forEach((code) => requestedProductCodes.current.add(code));
    loadingProductCodes.current = true;
    void getSaleProductsByCodes(request, codes)
      .then((items) => setSiblingProducts((current) => [...current.filter((product) => !codes.includes(product.code)), ...items]))
      .catch(() => { codes.forEach((code) => requestedProductCodes.current.delete(code)); })
      .finally(() => { loadingProductCodes.current = false; });
  };

  useEffect(() => {
    setDraftLines(draftLinesFromSale(sale));
    setError("");
  }, [sale.productVariants]);

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setDraftLines((current) => current.map((line, row) => row === index ? { ...line, ...patch } : line));
    setError("");
  };

  const addVariantToDraft = (option: SaleVariantOption) => {
    setAdditionalChoices((current) => {
      const knownIds = new Set(current.map((choice) => choice.variant.id));
      return [...current, ...choicesFrom([option.product]).filter((choice) => !knownIds.has(choice.variant.id))];
    });
    const hasCampaignDiscount = option.variant.discountedSalePrice !== null
      && option.variant.discountCampaignId !== null
      && option.variant.discountedSalePrice < option.variant.salePrice;
    const discountAmount = hasCampaignDiscount
      ? option.variant.salePrice - (option.variant.discountedSalePrice ?? option.variant.salePrice)
      : 0;
    setDraftLines((current) => [...current, {
      productId: String(option.variant.id),
      quantity: "1",
      discountAmount: String(discountAmount),
      discountSourceId: hasCampaignDiscount ? discountSourceIds.campaign : discountSourceIds.none,
      discountCampaignId: hasCampaignDiscount ? option.variant.discountCampaignId ?? undefined : undefined,
    }]);
    setError("");
  };

  const changeVariant = (index: number, variantId: string) => {
    const choice = choices.find((item) => String(item.variant.id) === variantId);
    if (!choice) return;
    const current = draftLines[index];
    const hasCampaignDiscount = choice.variant.discountedSalePrice !== null
      && choice.variant.discountCampaignId !== null
      && choice.variant.discountedSalePrice < choice.variant.salePrice;
    const discountAmount = hasCampaignDiscount
      ? choice.variant.salePrice - (choice.variant.discountedSalePrice ?? choice.variant.salePrice)
      : 0;
    updateLine(index, {
      productId: variantId,
      quantity: String(Math.min(Number(current.quantity) || 1, maxQuantityForLine(index, variantId))),
      discountAmount: String(discountAmount),
      discountSourceId: hasCampaignDiscount ? discountSourceIds.campaign : discountSourceIds.none,
      discountCampaignId: hasCampaignDiscount ? choice.variant.discountCampaignId ?? undefined : undefined,
    });
  };

  const maxQuantityForLine = (lineIndex: number, variantId: string) => {
    const choice = choices.find((item) => String(item.variant.id) === variantId);
    if (!choice) return 0;
    const committedBySale = [2, 3].includes(sale.saleStatusId)
      ? sale.productVariants.filter((item) => String(item.productId) === variantId).reduce((sum, item) => sum + item.quantity, 0)
      : 0;
    const otherDraftQuantity = draftLines.reduce((sum, item, index) =>
      index !== lineIndex && item.productId === variantId ? sum + (Number(item.quantity) || 0) : sum, 0);
    return Math.max(0, choice.variant.availableQuantity + committedBySale - otherDraftQuantity);
  };

  const saveChanges = async () => {
    if (draftLines.length === 0) {
      setError("La venta debe conservar al menos una prenda.");
      return;
    }
    const overStockLine = draftLines.some((line, index) => Number(line.quantity) > maxQuantityForLine(index, line.productId));
    if (overStockLine) {
      setError("La cantidad supera el inventario disponible para una o más prendas.");
      return;
    }
    const invalidLine = draftLines.find((line) => {
      const quantity = Number(line.quantity);
      const discountAmount = Number(line.discountAmount);
      const choice = choices.find((item) => String(item.variant.id) === line.productId);
      const originalLine = line.saleProductId ? sale.productVariants.find((item) => item.id === line.saleProductId) : undefined;
      const price = originalLine && originalLine.productId === Number(line.productId)
        ? originalLine.originalUnitPrice
        : choice?.variant.salePrice ?? 0;
      return !choice || !Number.isInteger(quantity) || quantity < 1 || discountAmount < 0 || discountAmount > price
        || (discountAmount === 0 && line.discountSourceId !== discountSourceIds.none)
        || (discountAmount > 0 && line.discountSourceId === discountSourceIds.none)
        || (line.discountSourceId === discountSourceIds.campaign && !line.discountCampaignId);
    });
    if (invalidLine) {
      setError("Revisa la variante, la cantidad y el tipo de descuento de cada prenda.");
      return;
    }
    const productVariants = draftLines.map((line) => ({
      ...(line.saleProductId && Number(line.productId) === sale.productVariants.find((item) => item.id === line.saleProductId)?.productId
        ? { saleProductId: line.saleProductId }
        : {}),
      productId: Number(line.productId),
      quantity: Number(line.quantity),
      discountAmount: Number(line.discountAmount),
      discountSourceId: line.discountSourceId,
      ...(line.discountCampaignId ? { discountCampaignId: line.discountCampaignId } : {}),
    }));
    setError("");
    await onSave({ productVariants });
  };

  const totals = draftLines.reduce((result, line) => {
    const choice = choices.find((item) => String(item.variant.id) === line.productId);
    const originalLine = line.saleProductId ? sale.productVariants.find((item) => item.id === line.saleProductId) : undefined;
    const price = originalLine && originalLine.productId === Number(line.productId)
      ? originalLine.originalUnitPrice
      : choice?.variant.salePrice ?? 0;
    const quantity = Number(line.quantity) || 0;
    const discount = Number(line.discountAmount) || 0;
    result.subtotal += price * quantity;
    result.discount += discount * quantity;
    result.total += Math.max(0, price - discount) * quantity;
    return result;
  }, { subtotal: 0, discount: 0, total: 0 });
  const discountLine = discountLineIndex === null ? null : draftLines[discountLineIndex];
  const discountChoice = discountLine ? choices.find((item) => String(item.variant.id) === discountLine.productId) : undefined;
  const discountOriginalLine = discountLine?.saleProductId ? sale.productVariants.find((item) => item.id === discountLine.saleProductId) : undefined;
  const discountUnitPrice = discountLine && discountChoice
    ? discountOriginalLine && discountOriginalLine.productId === Number(discountLine.productId)
      ? discountOriginalLine.originalUnitPrice
      : discountChoice.variant.salePrice
    : 0;
  const selectedDiscountLine = discountLine && discountChoice
    ? discountDraftLine(discountLine, discountChoice, choices, discountUnitPrice, maxQuantityForLine(discountLineIndex ?? 0, discountLine.productId))
    : null;
  const discountDialogLine = selectedDiscountLine ? {
    ...selectedDiscountLine,
    discountSourceId: selectedDiscountLine.discountSourceId === discountSourceIds.employee ? discountSourceIds.manual : selectedDiscountLine.discountSourceId,
  } : null;

  return <section className="@container rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-products-title">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 id="sale-products-title" className="text-base font-extrabold text-pw-ink">Prendas de la venta</h2></div>{canEdit ? <div className="flex flex-wrap gap-2">{dirty ? <button type="button" disabled={busy} onClick={() => { setDraftLines(draftLinesFromSale(sale)); setError(""); }} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold hover:bg-pw-canvas">Descartar cambios</button> : null}<button type="button" disabled={busy || !dirty} onClick={() => void saveChanges()} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Guardando…" : "Guardar cambios"}</button><SaleProductPicker lines={draftLines.map((line) => ({ productVariantId: Number(line.productId) }))} onAdd={addVariantToDraft} disabled={busy} /></div> : null}</header>
    {error ? <p role="alert" className="mb-3 text-sm font-semibold text-red-700">{error}</p> : null}
    {canEdit && draftLines.length ? <div className="hidden @min-[47rem]:grid @min-[47rem]:grid-cols-[minmax(8rem,1fr)_4.75rem_2.5rem_4rem_5.5rem_7rem_5.5rem_2rem] gap-x-3 border-b border-pw-line py-2 text-xs font-extrabold text-pw-muted"><span>Presentación</span><span className="text-center">Talla</span><span className="text-center">Stock</span><span className="text-center">Cantidad</span><span className="text-center">Precio c/u</span><span>Descuento c/u</span><span className="text-right">Total</span><span className="sr-only">Acciones</span></div> : null}
    {!canEdit && sale.productVariants.length ? <div className="hidden @min-[44rem]:grid @min-[44rem]:grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,1fr)_4rem_3.5rem_5rem_5.5rem_5.75rem] gap-x-3 border-b border-pw-line py-2 text-xs font-extrabold text-pw-muted"><span>Presentación</span><span>Subcategoría</span><span className="text-center">Talla</span><span className="text-center">Cantidad</span><span className="text-right">Precio c/u</span><span className="text-right">Descuento</span><span className="text-right">Total</span></div> : null}
    {canEdit ? <ul className="w-full divide-y divide-pw-line">{draftLines.map((line, index) => {
      const choice = choices.find((item) => String(item.variant.id) === line.productId);
      const originalLine = line.saleProductId ? sale.productVariants.find((item) => item.id === line.saleProductId) : undefined;
      const price = originalLine && originalLine.productId === Number(line.productId) ? originalLine.originalUnitPrice : choice?.variant.salePrice ?? 0;
      const sizeOptions = choice ? choices.filter((item) => item.presentationId === choice.presentationId && (maxQuantityForLine(index, String(item.variant.id)) > 0 || item.variant.id === choice.variant.id)) : [];
      const total = Math.max(0, price - (Number(line.discountAmount) || 0)) * (Number(line.quantity) || 0);
      const discountButtonLine = choice ? discountDraftLine(line, choice, choices, price, maxQuantityForLine(index, line.productId)) : null;
      return <li key={line.saleProductId ?? "new-" + index} className="grid w-full grid-cols-2 items-end gap-x-3 gap-y-3 @min-[36rem]:grid-cols-5 py-3 @min-[47rem]:grid-cols-[minmax(8rem,1fr)_4.75rem_2.5rem_4rem_5.5rem_7rem_5.5rem_2rem] @min-[47rem]:items-center @min-[47rem]:gap-x-3">
        <div className="flex min-w-0 items-center gap-2 @min-[36rem]:col-span-4 @min-[47rem]:col-span-1 @min-[47rem]:col-start-1 @min-[47rem]:row-start-1 @min-[47rem]:gap-3"><ProductThumb choice={choice} /><div className="min-w-0"><strong className="block truncate text-sm font-extrabold text-pw-ink">{choice?.presentationName ?? "Presentación"}</strong><span className="block truncate text-xs text-pw-muted">{choice ? "Código " + choice.product.code + " · " + (choice.product.subcategoryName || choice.product.categoryName || choice.product.name || "Sin subcategoría") : "Producto #" + line.productId}</span></div></div>
        <button type="button" disabled={busy} onClick={() => { setDraftLines((current) => current.filter((_item, row) => row !== index)); setError(""); }} aria-label={"Eliminar prenda " + (index + 1)} title="Eliminar prenda" className="grid h-9 w-8 place-items-center justify-self-end self-center @min-[47rem]:col-start-8 @min-[47rem]:row-start-1 @min-[47rem]:justify-self-center rounded-lg text-red-600 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" /></svg></button>
        <label onFocusCapture={loadSiblingVariants} className="min-w-0 text-xs font-bold text-pw-muted @min-[47rem]:text-center"><span className="mb-1 block text-[0.65rem] text-pw-muted @min-[47rem]:hidden">Talla</span><SelectControl id={"sale-detail-size-" + index} aria-label={"Talla de prenda " + (index + 1)} value={line.productId} options={sizeOptions.map((item) => ({ value: String(item.variant.id), label: item.variant.sizeName || "Única" }))} onChange={(event) => changeVariant(index, event.target.value)} /></label>
        <span className="hidden text-center text-sm tabular-nums text-pw-muted @min-[47rem]:block">{maxQuantityForLine(index, line.productId)}</span>
        <label className="text-xs font-bold text-pw-muted @min-[47rem]:text-center"><span className="mb-1 block text-[0.65rem] @min-[47rem]:hidden">Cantidad</span><input aria-label={"Cantidad de prenda " + (index + 1)} type="number" min="1" max={maxQuantityForLine(index, line.productId)} step="1" value={line.quantity} onChange={(event) => { const value = event.target.value; const maximum = maxQuantityForLine(index, line.productId); updateLine(index, { quantity: value && Number(value) > maximum ? String(maximum) : value }); }} className="pw-number-input min-h-9 w-full rounded-lg border border-pw-line px-2 text-center text-sm text-pw-ink" /></label>
        <div className="min-w-0 text-sm tabular-nums text-pw-muted @min-[47rem]:text-center">
          <span className="mb-1 block text-[0.65rem] font-bold @min-[47rem]:hidden">Precio c/u</span>
          <span className="wrap-anywhere">{money.format(price)}</span>
          <span className="block text-xs @min-[47rem]:hidden">{maxQuantityForLine(index, line.productId)} disponibles</span>
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-[0.65rem] font-bold text-pw-muted @min-[47rem]:hidden">Descuento c/u</span>
          {discountButtonLine ? <SaleDiscountButton line={discountButtonLine} compact onClick={() => setDiscountLineIndex(index)} /> : <span className="text-xs text-pw-muted">—</span>}
        </div>
        <div className="col-span-2 min-w-0 text-right @min-[36rem]:col-span-1">
          <span className="mb-1 block text-[0.65rem] font-bold text-pw-muted @min-[47rem]:hidden">Total</span>
          <strong className="wrap-anywhere text-sm font-extrabold tabular-nums">{money.format(total)}</strong>
        </div>
      </li>;
    })}</ul> : canEdit ? null : <ul className="divide-y divide-pw-line">{sale.productVariants.map((line: SaleProductLine) => {
      const choice = findChoice(choices, line.productId);
      return <li key={line.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 py-3 @min-[44rem]:grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,1fr)_4rem_3.5rem_5rem_5.5rem_5.75rem]">
        <div className="col-span-2 flex min-w-0 items-center gap-2 @min-[44rem]:col-span-1 @min-[44rem]:gap-3"><ProductThumb choice={choice} /><div className="min-w-0"><strong className="block truncate text-sm font-extrabold text-pw-ink">{choice?.presentationName ?? "Presentación"}</strong><span className="block text-xs text-pw-muted">{choice ? "Código " + choice.product.code : "Producto #" + line.productId}</span></div></div>
        <span className="min-w-0 text-xs text-pw-muted @min-[44rem]:col-span-1 @min-[44rem]:text-sm"><span className="mr-1 font-bold text-pw-muted @min-[44rem]:hidden">Subcategoría:</span>{choice?.product.subcategoryName || choice?.product.name || "—"}</span>
        <span className="min-w-0 text-xs font-bold text-pw-ink @min-[44rem]:col-span-1 @min-[44rem]:text-center @min-[44rem]:text-sm"><span className="mr-1 font-normal text-pw-muted @min-[44rem]:hidden">Talla:</span>{choice?.variant.sizeName || "Única"}</span>
        <span className="text-left text-sm font-bold tabular-nums text-pw-ink @min-[44rem]:text-center"><span className="mr-1 text-[0.65rem] text-pw-muted @min-[44rem]:hidden">Cant.</span>{line.quantity}</span>
        <span className="wrap-anywhere text-right text-sm tabular-nums text-pw-muted"><span className="mr-1 text-[0.65rem] @min-[44rem]:hidden">Precio c/u:</span>{money.format(line.originalUnitPrice)}</span>
        <span className="wrap-anywhere text-left text-sm tabular-nums text-pw-muted @min-[44rem]:text-right"><span className="mr-1 text-[0.65rem] @min-[44rem]:hidden">Descuento:</span>{line.discountAmount ? "− " + money.format(line.discountAmount) : "—"}</span>
        <strong className="wrap-anywhere text-right text-sm font-extrabold tabular-nums"><span className="mr-1 text-[0.65rem] font-normal text-pw-muted @min-[44rem]:hidden">Total:</span>{money.format(line.lineTotal)}</strong>
      </li>;
    })}</ul>}
    {canEdit && draftLines.length === 0 ? <p className="rounded-xl border border-dashed border-pw-line py-8 text-center text-sm text-pw-muted">Esta venta aún no tiene prendas. Usa “Agregar prenda” para añadir una.</p> : null}
    {!canEdit && sale.productVariants.length === 0 ? <p className="rounded-xl border border-dashed border-pw-line py-8 text-center text-sm text-pw-muted">Esta venta aún no tiene prendas.</p> : null}
    <dl className={"ml-auto mt-4 grid max-w-xs grid-cols-[minmax(0,1fr)_auto] gap-y-2 border-t border-pw-line pt-4 text-sm " + (canEdit ? "@min-[47rem]:w-full @min-[47rem]:max-w-none @min-[47rem]:grid-cols-[minmax(8rem,1fr)_4.75rem_2.5rem_4rem_5.5rem_7rem_5.5rem_2rem] @min-[47rem]:gap-x-3" : "")}>
      <dt className={"text-pw-muted " + (canEdit ? "@min-[47rem]:col-span-6 @min-[47rem]:col-start-1 @min-[47rem]:text-right" : "")}>Subtotal</dt><dd className={"font-bold tabular-nums " + (canEdit ? "text-right @min-[47rem]:col-start-7" : "text-right")}>{money.format(canEdit ? totals.subtotal : sale.subtotal)}</dd>
      <dt className={"text-pw-muted " + (canEdit ? "@min-[47rem]:col-span-6 @min-[47rem]:col-start-1 @min-[47rem]:text-right" : "")}>Descuento</dt><dd className={"font-bold tabular-nums " + (canEdit ? "text-right @min-[47rem]:col-start-7" : "text-right")}>− {money.format(canEdit ? totals.discount : sale.totalDiscount)}</dd>
      <dt className={"border-t border-pw-line pt-2 font-extrabold " + (canEdit ? "@min-[47rem]:col-span-6 @min-[47rem]:col-start-1 @min-[47rem]:text-right" : "")}>Total prendas</dt><dd className={"border-t border-pw-line pt-2 font-extrabold tabular-nums " + (canEdit ? "text-right @min-[47rem]:col-start-7" : "text-right")}>{money.format(canEdit ? totals.total : sale.total)}</dd>
    </dl>
    <SaleDiscountDialog line={discountDialogLine} onClose={() => setDiscountLineIndex(null)} onApply={(_productVariantId, discountAmount, type, value) => {
      if (discountLineIndex === null) return;
      const selectedLine = draftLines[discountLineIndex];
      const selectedChoice = selectedLine ? choices.find((item) => String(item.variant.id) === selectedLine.productId) : undefined;
      if (!selectedLine || !selectedChoice) return;
      const hasSavedCampaign = selectedLine.discountSourceId === discountSourceIds.campaign;
      const hasCatalogCampaign = selectedChoice.variant.discountedSalePrice !== null
        && selectedChoice.variant.discountCampaignId !== null
        && selectedChoice.variant.discountedSalePrice < selectedChoice.variant.salePrice;
      const hasCampaign = hasSavedCampaign || hasCatalogCampaign;
      const campaignAmount = hasSavedCampaign
        ? Number(selectedLine.discountAmount) || 0
        : hasCatalogCampaign
        ? selectedChoice.variant.salePrice - (selectedChoice.variant.discountedSalePrice ?? selectedChoice.variant.salePrice)
        : 0;
      const campaignId = hasSavedCampaign
        ? selectedLine.discountCampaignId
        : selectedChoice.variant.discountCampaignId;
      updateLine(discountLineIndex, {
        discountAmount: String(discountAmount > 0 ? discountAmount : campaignAmount),
        discountSourceId: discountAmount > 0 ? discountSourceIds.manual : hasCampaign ? discountSourceIds.campaign : discountSourceIds.none,
        discountCampaignId: discountAmount > 0 ? undefined : hasCampaign ? campaignId ?? undefined : undefined,
        manualDiscountType: discountAmount > 0 ? type ?? undefined : undefined,
        manualDiscountValue: discountAmount > 0 ? value ?? undefined : undefined,
      });
      setDiscountLineIndex(null);
    }} />
  </section>;
}

function draftLinesFromSale(sale: SaleDetail): DraftLine[] {
  return sale.productVariants.map((line) => ({
    saleProductId: line.id,
    productId: String(line.productId),
    quantity: String(line.quantity),
    discountAmount: String(line.discountAmount),
    discountSourceId: line.discountSourceId,
    discountCampaignId: line.discountCampaignId ?? undefined,
  }));
}
