import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProductDTO, ProductVariantDTO } from "../products/product-types";
import { Pagination } from "../../shared/ui/pagination";
import { SelectControl } from "../../shared/ui/select-control";
import { ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { useAuth } from "../auth/auth-provider";
import { getSaleProducts } from "./sales-api";
import { saleVariants, type SaleDraftLine, type SaleManualDiscountType, type SaleVariantOption } from "./sale-product-types";
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
function ProductThumb({ choice }: { choice?: ProductChoice }) { return choice?.image ? <img src={choice.image} alt="" className="h-14 w-12 shrink-0 rounded-lg bg-pw-brand-soft object-cover" /> : <span aria-hidden="true" className="grid h-14 w-12 shrink-0 place-items-center rounded-lg bg-pw-brand-soft text-sm font-bold text-pw-brand-deep">{choice ? choice.product.code : "—"}</span>; }

function ProductAddDialog({ selectedProductIds, busy, onClose, onSelect }: {
  selectedProductIds: number[];
  busy: boolean;
  onClose: () => void;
  onSelect: (option: SaleVariantOption) => void;
}) {
  const { request } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getSaleProducts>> | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    return () => dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const query = code.trim();
    if (!query || !/^\d+$/.test(query)) {
      setCatalog(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setCatalog(null);
    const timeout = window.setTimeout(() => {
      void getSaleProducts(request, { page, pageSize: 8, code: query })
        .then((result) => { if (active) setCatalog(result); })
        .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudo buscar el catálogo."); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [code, page, request, retry]);

  const options = useMemo(() => saleVariants(catalog?.items ?? []), [catalog]);
  const groups = useMemo(() => {
    const grouped = new Map<string, SaleVariantOption[]>();
    options.forEach((option) => {
      const key = option.product.id + ":" + option.presentationId;
      const group = grouped.get(key);
      if (group) group.push(option);
      else grouped.set(key, [option]);
    });
    return Array.from(grouped.values());
  }, [options]);

  const addVariant = (option: SaleVariantOption) => {
    onSelect(option);
    setAnnouncement(option.product.name + ", " + option.presentationName + (option.variant.sizeName ? ", talla " + option.variant.sizeName : "") + ", agregada a la venta. Guarda los cambios para aplicarla.");
  };

  return createPortal(<dialog ref={dialogRef} aria-labelledby="sale-product-add-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/45">
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex items-center justify-between border-b border-pw-line px-5 py-4"><h2 id="sale-product-add-title" className="text-lg font-extrabold">Buscar prendas</h2><button type="button" onClick={onClose} aria-label="Cerrar búsqueda de prendas" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
      <div className="space-y-4 overflow-y-auto p-5">
        <label htmlFor="sale-detail-product-code" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">Código de la prenda<input id="sale-detail-product-code" type="search" inputMode="numeric" autoComplete="off" value={code} onChange={(event) => { setCode(event.target.value); setPage(1); setAnnouncement(""); }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Escribe el código" className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink" /></label>
        {!code.trim() ? <p className="rounded-xl border border-dashed border-pw-line p-5 text-center text-sm text-pw-muted">Escribe un código para consultar las prendas disponibles.</p> : null}
        {code.trim() && !/^\d+$/.test(code.trim()) ? <p role="status" className="text-sm text-pw-muted">El código debe contener solo números.</p> : null}
        {loading ? <LoadingState /> : null}
        {!loading && error ? <ErrorState title="No se pudo buscar el catálogo" description={error} onRetry={() => setRetry((value) => value + 1)} /> : null}
        {!loading && !error && catalog && options.length === 0 ? <p className="rounded-xl border border-dashed border-pw-line p-5 text-center text-sm text-pw-muted">No encontramos prendas disponibles con ese código.</p> : null}
        {!loading && !error && options.length > 0 ? <div className="grid gap-3">{groups.map((group) => {
          const first = group[0];
          return <section key={first.product.id + ":" + first.presentationId} className="overflow-hidden rounded-xl border border-pw-line">
            <header className="flex items-center gap-3 px-3 py-2.5 sm:px-4">{first.imageUrl ? <img src={first.imageUrl} alt="" className="h-12 w-10 shrink-0 rounded-md bg-pw-canvas object-cover" /> : <span aria-hidden="true" className="grid h-12 w-10 shrink-0 place-items-center rounded-md bg-pw-brand-soft text-[10px] font-bold text-pw-brand-deep">{first.product.code}</span>}<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5"><p className="text-xs font-extrabold text-pw-brand-deep">Código {first.product.code}</p><h3 className="text-sm font-extrabold text-pw-ink">{first.presentationName}</h3><p className="min-w-0 text-xs text-pw-muted">{first.product.subcategoryName?.trim() || "Sin subcategoría"}</p></div></header>
            <div>{group.map((option) => {
              const alreadyInSale = selectedProductIds.includes(option.variant.id);
              const price = option.variant.discountedSalePrice ?? option.variant.salePrice;
              return <div key={option.variant.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-pw-line px-3 py-2 sm:px-4"><div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5"><p className="text-sm font-bold text-pw-ink">{option.variant.sizeName || "Talla única"}</p><p className="text-xs text-pw-muted">{money.format(price)}</p><p className="text-xs text-pw-muted">{option.variant.availableQuantity} disponibles</p></div><button type="button" disabled={busy || alreadyInSale} onClick={() => addVariant(option)} className="min-h-9 shrink-0 rounded-lg border border-pw-brand px-3 text-xs font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft disabled:cursor-default disabled:border-pw-line disabled:text-pw-muted">{alreadyInSale ? "Agregada" : "Agregar"}</button></div>;
            })}</div>
          </section>;
        })}</div> : null}
        {catalog && catalog.totalPages > 1 ? <Pagination page={catalog.page} totalPages={catalog.totalPages} onPageChange={setPage} /> : null}
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </div>
      <footer className="flex justify-end border-t border-pw-line p-4"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-pw-line bg-white px-4 text-sm font-bold">Listo</button></footer>
    </div>
  </dialog>, document.body);
}
export function SaleDetailProducts({ sale, products, isAdmin, busy, onSave }: {
  sale: SaleDetail; products: ProductDTO[]; isAdmin: boolean; busy: boolean; onSave: (payload: ReplaceSaleProductsPayload) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => draftLinesFromSale(sale));
  const [discountLineIndex, setDiscountLineIndex] = useState<number | null>(null);
  const [additionalChoices, setAdditionalChoices] = useState<ProductChoice[]>([]);
  const [error, setError] = useState("");
  const choices = useMemo(() => {
    const allChoices = [...choicesFrom(products), ...additionalChoices];
    return Array.from(new Map(allChoices.map((choice) => [choice.variant.id, choice])).values());
  }, [products, additionalChoices]);
  const canEdit = isAdmin && ![4, 5, 6].includes(sale.saleStatusId);
  const savedLines = useMemo(() => draftLinesFromSale(sale), [sale.productVariants]);
  const dirty = JSON.stringify(draftLines) !== JSON.stringify(savedLines);

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

  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-products-title">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 id="sale-products-title" className="text-base font-extrabold text-pw-ink">Prendas de la venta</h2></div>{canEdit ? <div className="flex flex-wrap gap-2">{dirty ? <button type="button" disabled={busy} onClick={() => { setDraftLines(draftLinesFromSale(sale)); setError(""); }} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold hover:bg-pw-canvas">Descartar cambios</button> : null}<button type="button" disabled={busy || !dirty} onClick={() => void saveChanges()} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Guardando…" : "Guardar cambios"}</button><button type="button" disabled={busy} onClick={() => setAdding(true)} className="min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep hover:bg-pw-brand-soft">Agregar prenda</button></div> : null}</header>
    {error ? <p role="alert" className="mb-3 text-sm font-semibold text-red-700">{error}</p> : null}
    {canEdit && draftLines.length ? <div className="hidden 2xl:grid 2xl:grid-cols-[1.5rem_minmax(10rem,1.1fr)_minmax(7rem,0.8fr)_4.75rem_4.25rem_3.5rem_6rem_7rem_6.25rem] gap-x-5 border-b border-pw-line px-1 py-2 text-xs font-extrabold text-pw-muted"><span aria-hidden="true"></span><span>Prenda</span><span>Categoría</span><span className="text-center">Talla</span><span className="text-center">Cantidad</span><span className="text-center">Disponible</span><span className="text-center">Precio c/u</span><span className="text-center">Descuento c/u</span><span className="text-center">Total</span></div> : null}
    {!canEdit && sale.productVariants.length ? <div className="hidden lg:grid lg:grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,1fr)_4rem_3.5rem_5rem_5.5rem_5.75rem] gap-x-3 border-b border-pw-line px-1 py-2 text-xs font-extrabold text-pw-muted"><span>Presentación</span><span>Subcategoría</span><span className="text-center">Talla</span><span className="text-center">Cantidad</span><span className="text-right">Precio c/u</span><span className="text-right">Descuento</span><span className="text-right">Total</span></div> : null}
    {canEdit ? <ul className="w-full divide-y divide-pw-line">{draftLines.map((line, index) => {
      const choice = choices.find((item) => String(item.variant.id) === line.productId);
      const originalLine = line.saleProductId ? sale.productVariants.find((item) => item.id === line.saleProductId) : undefined;
      const price = originalLine && originalLine.productId === Number(line.productId) ? originalLine.originalUnitPrice : choice?.variant.salePrice ?? 0;
      const sizeOptions = choice ? choices.filter((item) => item.presentationId === choice.presentationId && (maxQuantityForLine(index, String(item.variant.id)) > 0 || item.variant.id === choice.variant.id)) : [];
      const total = Math.max(0, price - (Number(line.discountAmount) || 0)) * (Number(line.quantity) || 0);
      const discountButtonLine = choice ? discountDraftLine(line, choice, choices, price, maxQuantityForLine(index, line.productId)) : null;
      return <li key={line.saleProductId ?? "new-" + index} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 2xl:grid-cols-[1.5rem_minmax(10rem,1.1fr)_minmax(7rem,0.8fr)_4.75rem_4.25rem_3.5rem_6rem_7rem_6.25rem] 2xl:gap-x-5">
        <button type="button" disabled={busy} onClick={() => { setDraftLines((current) => current.filter((_item, row) => row !== index)); setError(""); }} aria-label={"Eliminar prenda " + (index + 1)} title="Eliminar prenda" className="grid h-9 w-8 place-items-center justify-self-center rounded-lg text-red-600 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" /></svg></button>
        <div className="col-span-2 flex min-w-0 items-center gap-2 2xl:col-span-1 2xl:gap-3"><ProductThumb choice={choice} /><div className="min-w-0"><strong className="block truncate text-sm font-extrabold text-pw-ink">{choice?.presentationName ?? "Presentación"}</strong><span className="block truncate text-xs text-pw-muted">{choice ? "Código " + choice.product.code + " · " + (choice.product.subcategoryName || choice.product.name || "Sin subcategoría") : "Producto #" + line.productId}</span></div></div>
        <span className="hidden min-w-0 text-sm text-pw-muted 2xl:block">{choice?.product.categoryName || "—"}</span>
        <label className="min-w-0 text-xs font-bold text-pw-muted 2xl:text-center"><span className="mb-1 block text-[0.65rem] text-pw-muted 2xl:hidden">Talla</span><SelectControl id={"sale-detail-size-" + index} aria-label={"Talla de prenda " + (index + 1)} value={line.productId} options={sizeOptions.map((item) => ({ value: String(item.variant.id), label: item.variant.sizeName || "Única" }))} onChange={(event) => changeVariant(index, event.target.value)} /></label>
        <label className="text-xs font-bold text-pw-muted 2xl:text-center"><span className="mb-1 block text-[0.65rem] 2xl:hidden">Cantidad</span><input aria-label={"Cantidad de prenda " + (index + 1)} type="number" min="1" max={maxQuantityForLine(index, line.productId)} step="1" value={line.quantity} onChange={(event) => { const value = event.target.value; const maximum = maxQuantityForLine(index, line.productId); updateLine(index, { quantity: value && Number(value) > maximum ? String(maximum) : value }); }} className="pw-number-input min-h-9 w-16 rounded-lg border border-pw-line px-2 text-center text-sm text-pw-ink 2xl:w-full" /></label>
        <span className="hidden text-center text-sm tabular-nums text-pw-muted 2xl:block">{maxQuantityForLine(index, line.productId)}</span>
        <span className="text-center text-sm tabular-nums text-pw-muted"><span className="mr-1 text-[0.65rem] 2xl:hidden">Precio:</span>{money.format(price)}<span className="ml-2 text-xs text-pw-muted 2xl:hidden">· {maxQuantityForLine(index, line.productId)} disponibles</span></span>
        {discountButtonLine ? <SaleDiscountButton line={discountButtonLine} compact onClick={() => setDiscountLineIndex(index)} /> : <span className="text-xs text-pw-muted">—</span>}
        <strong className="text-center text-sm font-extrabold tabular-nums">{money.format(total)}</strong>
      </li>;
    })}</ul> : canEdit ? null : <ul className="divide-y divide-pw-line">{sale.productVariants.map((line: SaleProductLine) => {
      const choice = findChoice(choices, line.productId);
      return <li key={line.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 lg:grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,1fr)_4rem_3.5rem_5rem_5.5rem_5.75rem]">
        <div className="col-span-2 flex min-w-0 items-center gap-2 lg:col-span-1 lg:gap-3"><ProductThumb choice={choice} /><div className="min-w-0"><strong className="block truncate text-sm font-extrabold text-pw-ink">{choice?.presentationName ?? "Presentación"}</strong><span className="block text-xs text-pw-muted">{choice ? "Código " + choice.product.code : "Producto #" + line.productId}</span></div></div>
        <span className="col-span-2 min-w-0 text-xs text-pw-muted lg:col-span-1 lg:text-sm"><span className="mr-1 font-bold text-pw-muted lg:hidden">Subcategoría:</span>{choice?.product.subcategoryName || choice?.product.name || "—"}</span>
        <span className="col-span-2 min-w-0 text-xs font-bold text-pw-ink lg:col-span-1 lg:text-center lg:text-sm"><span className="mr-1 font-normal text-pw-muted lg:hidden">Talla:</span>{choice?.variant.sizeName || "Única"}</span>
        <span className="text-left text-sm font-bold tabular-nums text-pw-ink lg:text-center"><span className="mr-1 text-[0.65rem] text-pw-muted lg:hidden">Cant.</span>{line.quantity}</span>
        <span className="hidden text-right text-sm tabular-nums text-pw-muted lg:block">{money.format(line.originalUnitPrice)}</span>
        <span className="hidden text-right text-sm tabular-nums text-pw-muted lg:block">{line.discountAmount ? "− " + money.format(line.discountAmount) : "—"}</span>
        <strong className="text-right text-sm font-extrabold tabular-nums">{money.format(line.lineTotal)}</strong>
      </li>;
    })}</ul>}
    {canEdit && draftLines.length === 0 ? <p className="rounded-xl border border-dashed border-pw-line py-8 text-center text-sm text-pw-muted">Esta venta aún no tiene prendas. Usa “Agregar prenda” para añadir una.</p> : null}
    {!canEdit && sale.productVariants.length === 0 ? <p className="rounded-xl border border-dashed border-pw-line py-8 text-center text-sm text-pw-muted">Esta venta aún no tiene prendas.</p> : null}
    <dl className={"ml-auto mt-4 grid max-w-xs grid-cols-[minmax(0,1fr)_auto] gap-y-2 border-t border-pw-line pt-4 text-sm " + (canEdit ? "2xl:w-full 2xl:max-w-none 2xl:grid-cols-[1.5rem_minmax(10rem,1.1fr)_minmax(7rem,0.8fr)_4.75rem_4.25rem_3.5rem_6rem_7rem_6.25rem] 2xl:gap-x-5" : "")}>
      <dt className={"text-pw-muted " + (canEdit ? "2xl:col-span-8 2xl:col-start-1 2xl:text-right" : "")}>Subtotal</dt><dd className={"font-bold tabular-nums " + (canEdit ? "text-right 2xl:col-start-9 2xl:text-center" : "text-right")}>{money.format(canEdit ? totals.subtotal : sale.subtotal)}</dd>
      <dt className={"text-pw-muted " + (canEdit ? "2xl:col-span-8 2xl:col-start-1 2xl:text-right" : "")}>Descuento</dt><dd className={"font-bold tabular-nums " + (canEdit ? "text-right 2xl:col-start-9 2xl:text-center" : "text-right")}>− {money.format(canEdit ? totals.discount : sale.totalDiscount)}</dd>
      <dt className={"border-t border-pw-line pt-2 font-extrabold " + (canEdit ? "2xl:col-span-8 2xl:col-start-1 2xl:text-right" : "")}>Total prendas</dt><dd className={"border-t border-pw-line pt-2 font-extrabold tabular-nums " + (canEdit ? "text-right 2xl:col-start-9 2xl:text-center" : "text-right")}>{money.format(canEdit ? totals.total : sale.total)}</dd>
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
    {adding ? <ProductAddDialog selectedProductIds={draftLines.map((line) => Number(line.productId)).filter(Boolean)} busy={busy} onClose={() => setAdding(false)} onSelect={addVariantToDraft} /> : null}
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
