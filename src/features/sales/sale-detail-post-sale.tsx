import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/auth-provider";
import type { ProductDTO } from "../products/product-types";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { LoadingButton } from "../../shared/ui/loading-button";
import { SelectControl } from "../../shared/ui/select-control";
import { ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { saleVariants, type SaleVariantOption } from "./sale-product-types";
import {
  cancelSaleExchange, cancelSaleReturn, completeSaleExchangeHandover, createSaleExchange,
  createSaleReturn, getSaleExchanges, getSaleProducts, getSaleReturns, receiveSaleExchangeReturnItem,
  receiveSaleReturn, registerSaleReturnPickup, settleSaleExchange,
} from "./sales-api";
import type {
  CreateSaleExchangePayload, CreateSaleExchangeSettlementPayload, CreateSaleReturnPayload,
  ProcessSaleReturnPayload, ReceiveSaleReturnPayload, SaleDetail, SaleExchange, SaleReturn,
  SaleReturn as SaleReturnModel, SaleCatalogOption, SaleDeliveryAgency,
} from "./sales-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const returnReasons = [
  { value: "1", label: "Preferencia de la clienta" },
  { value: "2", label: "Defecto del producto" },
  { value: "3", label: "Error de la tienda" },
];
const exchangeStatuses: Record<number, string> = { 1: "Solicitado", 2: "Esperando retorno", 3: "Reemplazo entregado", 4: "Completado", 5: "Cancelado" };
const returnStatuses: Record<number, string> = { 1: "Solicitada", 2: "Recogida · reembolso registrado", 3: "Recibida", 4: "Completada", 5: "Cancelada" };
const exchangeReturnStatuses: Record<number, string> = { 1: "Pendiente de entrega", 2: "Pendiente de retorno", 3: "Recibida", 4: "No recibida" };
const returnReasonLabels: Record<number, string> = { 1: "Preferencia de la clienta", 2: "Defecto del producto", 3: "Error de la tienda" };
const returnMethodLabels: Record<number, string> = { 1: "En el local", 2: "Por agencia" };
const postSaleDeliveryStatuses: Record<number, string> = { 1: "Pendiente", 2: "En tránsito", 3: "Completado", 4: "Fallido", 5: "Cancelado" };

function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function variantLabel(productId: number, products: ProductDTO[]) {
  for (const product of products) for (const presentation of product.presentations) for (const variant of presentation.sizes) {
    if (variant.id === productId) return `${product.name} · ${presentation.name ?? "Presentación"}${variant.sizeName ? ` · ${variant.sizeName}` : ""} · Código ${product.code}`;
  }
  return `Prenda #${productId}`;
}

function variantReturnDetails(productId: number, products: ProductDTO[]) {
  for (const product of products) for (const presentation of product.presentations) for (const variant of presentation.sizes) {
    if (variant.id === productId) return { code: product.code, size: variant.sizeName || "Unitalla", imageUrl: presentation.primaryImageUrl || product.primaryImageUrl };
  }
  return { code: productId, size: "—", imageUrl: null };
}

function TrashIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>;
}

function remainingReturnQuantity(lineId: number, sale: SaleDetail, exchanges: SaleExchange[], returns: SaleReturn[]) {
  const sold = sale.productVariants.find((line) => line.id === lineId)?.quantity ?? 0;
  const exchanged = exchanges.filter((exchange) => exchange.statusId !== 5).flatMap((exchange) => exchange.returnItems).filter((item) => item.originalSaleProductId === lineId).reduce((sum, item) => sum + item.quantity, 0);
  const returned = returns.filter((item) => item.statusId !== 5).flatMap((saleReturn) => saleReturn.items).filter((item) => item.originalSaleProductId === lineId).reduce((sum, item) => sum + item.quantity, 0);
  return Math.max(0, sold - exchanged - returned);
}

function AsyncDialog({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; if (!element) return undefined; if (!element.open) element.showModal(); return () => element.close(); }, []);
  return createPortal(<dialog ref={dialog} aria-labelledby="sale-post-sale-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className={`m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/45 ${wide ? "max-w-3xl" : "max-w-xl"}`}>
    <div className="p-5 sm:p-6"><header className="mb-4 flex items-start justify-between gap-3"><h2 id="sale-post-sale-dialog-title" className="text-lg font-extrabold">{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>{children}</div>
  </dialog>, document.body);
}

type LineDraft = { saleProductId: string; quantity: string; recognizedUnitAmount: string };
type OutboundDraft = { productId: string; quantity: string; itemTypeId: string; option: SaleVariantOption };

function itemOptions(sale: SaleDetail, exchanges: SaleExchange[], returns: SaleReturn[], products: ProductDTO[]) {
  return sale.productVariants.map((line) => ({ line, remaining: remainingReturnQuantity(line.id, sale, exchanges, returns), label: variantLabel(line.productId, products) })).filter((item) => item.remaining > 0);
}

function CreateExchangeDialog({ sale, products, agencies, exchanges, returns, busy, onClose, onSave }: {
  sale: SaleDetail; products: ProductDTO[]; agencies: SaleDeliveryAgency[]; exchanges: SaleExchange[]; returns: SaleReturn[]; busy: boolean;
  onClose: () => void; onSave: (payload: CreateSaleExchangePayload) => Promise<boolean>;
}) {
  const { request } = useAuth();
  const returnChoices = itemOptions(sale, exchanges, returns, products);
  const [returnLines, setReturnLines] = useState<LineDraft[]>([]);
  const [outboundLines, setOutboundLines] = useState<OutboundDraft[]>([]);
  const [searchCode, setSearchCode] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [searchRetry, setSearchRetry] = useState(0);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getSaleProducts>> | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [address, setAddress] = useState("");
  const [shipping, setShipping] = useState("0");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const hasAgency = agencyId.length > 0;
  useEffect(() => {
    const query = searchCode.trim();
    if (!query || !/^\d+$/.test(query)) return undefined;
    let active = true;
    const timeout = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);
      setCatalog(null);
      void getSaleProducts(request, { page: searchPage, pageSize: 8, code: query })
        .then((result) => { if (active) setCatalog(result); })
        .catch((caught: unknown) => { if (active) setSearchError(caught instanceof Error ? caught.message : "No se pudo buscar el catálogo."); })
        .finally(() => { if (active) setSearchLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [request, searchCode, searchPage, searchRetry]);
  const outboundChoices = useMemo(() => saleVariants(catalog?.items ?? []), [catalog]);
  const addOutbound = (option: SaleVariantOption) => {
    if (outboundLines.some((line) => Number(line.productId) === option.variant.id)) return;
    setOutboundLines((current) => [...current, { productId: String(option.variant.id), quantity: "1", itemTypeId: "1", option }]);
  };
  const recognizedReturnTotal = round(returnLines.reduce((total, line) => total + (Number(line.quantity) || 0) * (Number(line.recognizedUnitAmount) || 0), 0));
  const outboundItemsTotal = round(outboundLines.reduce((total, line) => total + (Number(line.quantity) || 0) * line.option.variant.salePrice, 0));
  const exchangeBalance = round(outboundItemsTotal - recognizedReturnTotal);
  const agencyAmountToCollect = round(Math.max(0, exchangeBalance) + (Number(shipping) || 0));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const returnsPayload = returnLines.map((line) => ({ originalSaleProductId: Number(line.saleProductId), quantity: Number(line.quantity), recognizedUnitAmount: Number(line.recognizedUnitAmount) }));
    const outboundPayload = outboundLines.map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity), itemTypeId: Number(line.itemTypeId) }));
    if (!returnsPayload.length || returnsPayload.some((line) => {
      const originalLine = sale.productVariants.find((item) => item.id === line.originalSaleProductId);
      const choice = returnChoices.find((item) => item.line.id === line.originalSaleProductId);
      return !originalLine || !choice || line.quantity < 1 || line.quantity > choice.remaining || line.recognizedUnitAmount < 0 || line.recognizedUnitAmount > originalLine.finalUnitPrice;
    }) || !outboundPayload.length || outboundPayload.some((line, index) => !line.productId || line.quantity < 1 || line.quantity > outboundLines[index].option.variant.availableQuantity)) { setError("Selecciona prendas válidas. La cantidad debe estar disponible y el monto reconocido no puede superar el precio de la prenda."); return; }
    const saved = await onSave({ ...(hasAgency ? { deliveryAgencyId: Number(agencyId), deliveryCode: deliveryCode.trim(), deliveryAddress: address.trim(), shippingChargedToClient: Number(shipping) || 0 } : { shippingChargedToClient: 0 }), ...(comments.trim() ? { comments: comments.trim() } : {}), returnItems: returnsPayload, outboundItems: outboundPayload });
    if (saved) onClose();
  };
  return <AsyncDialog title="Crear cambio" onClose={onClose} wide><form onSubmit={submit} className="space-y-4">
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-extrabold">Prendas que devuelve la clienta</legend>{returnChoices.map(({ line: saleLine, remaining }) => {
      const draft = returnLines.find((item) => Number(item.saleProductId) === saleLine.id);
      const details = variantReturnDetails(saleLine.productId, products);
      return <div key={saleLine.id} className={`grid items-center gap-2 rounded-xl border p-2.5 ${draft ? "grid-cols-[auto_2.5rem_minmax(0,1fr)_4.5rem_7rem] border-pw-brand bg-pw-brand-soft/20" : "grid-cols-[auto_2.5rem_minmax(0,1fr)] border-pw-line"}`}>
        <input type="checkbox" aria-label={`Seleccionar código ${details.code}, talla ${details.size} para cambio`} checked={!!draft} onChange={(event) => setReturnLines((current) => event.target.checked ? [...current, { saleProductId: String(saleLine.id), quantity: "1", recognizedUnitAmount: String(saleLine.finalUnitPrice) }] : current.filter((item) => Number(item.saleProductId) !== saleLine.id))} className="h-4 w-4 accent-pw-brand" />
        {details.imageUrl ? <img src={details.imageUrl} alt="" loading="lazy" className="h-12 w-10 shrink-0 rounded-md bg-pw-canvas object-cover" /> : <span aria-hidden="true" className="grid h-12 w-10 shrink-0 place-items-center rounded-md bg-pw-canvas text-[10px] text-pw-muted">—</span>}
        <div className="min-w-0"><p className="text-sm font-extrabold">Código {details.code}</p><p className="text-xs text-pw-muted">Talla {details.size} · Precio pagado {money.format(saleLine.finalUnitPrice)} por unidad · {remaining} disponibles</p></div>
        {draft ? <>
          <label className="grid min-w-0 gap-1 text-[10px] font-bold leading-tight text-pw-muted">Cantidad<input aria-label={`Cantidad devuelta código ${details.code}`} type="number" min="1" max={remaining} step="1" value={draft.quantity} onChange={(event) => setReturnLines((current) => current.map((item) => item.saleProductId === draft.saleProductId ? { ...item, quantity: event.target.value } : item))} className="min-h-9 w-full rounded-lg border border-pw-line px-2 text-sm text-pw-ink" required /></label>
          <label className="grid min-w-0 gap-1 text-[10px] font-bold leading-tight text-pw-muted">Reconocido / unidad<input aria-label={`Monto reconocido por unidad código ${details.code}`} type="number" min="0" max={saleLine.finalUnitPrice} step="0.01" value={draft.recognizedUnitAmount} onChange={(event) => setReturnLines((current) => current.map((item) => item.saleProductId === draft.saleProductId ? { ...item, recognizedUnitAmount: event.target.value } : item))} className="min-h-9 w-full rounded-lg border border-pw-line px-2 text-sm text-pw-ink" required /></label>
        </> : null}
      </div>;
    })}{returnChoices.length === 0 ? <p className="rounded-lg border border-dashed border-pw-line p-4 text-sm text-pw-muted">No hay prendas disponibles para devolver en este cambio.</p> : null}</fieldset>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-extrabold">Prendas que recibirá la clienta</legend>
      <label className="grid gap-1 text-xs font-bold text-pw-muted">Buscar por código de prenda<input type="search" inputMode="numeric" autoComplete="off" value={searchCode} onChange={(event) => { setSearchCode(event.target.value); setSearchPage(1); setCatalog(null); setSearchError(null); setSearchLoading(false); }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Escribe el código" className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label>
      {!searchCode.trim() ? <p className="rounded-lg border border-dashed border-pw-line p-3 text-sm text-pw-muted">Escribe el código para buscar prendas disponibles.</p> : !/^\d+$/.test(searchCode.trim()) ? <p role="status" className="text-sm text-pw-muted">El código debe contener solo números.</p> : null}
      {searchLoading ? <p role="status" className="text-sm text-pw-muted">Buscando prendas…</p> : null}
      {searchError ? <div className="flex items-center justify-between gap-3 text-sm text-red-700"><p>{searchError}</p><button type="button" onClick={() => { setSearchError(null); setSearchRetry((value) => value + 1); }} className="font-bold underline">Reintentar</button></div> : null}
      {!searchLoading && !searchError && searchCode.trim() && /^\d+$/.test(searchCode.trim()) && !outboundChoices.length ? <p className="rounded-lg border border-dashed border-pw-line p-3 text-sm text-pw-muted">No encontramos prendas disponibles con ese código.</p> : null}
      {outboundChoices.length ? <ul className="max-h-56 divide-y divide-pw-line overflow-y-auto rounded-xl border border-pw-line">{outboundChoices.map((option) => {
        const selected = outboundLines.some((line) => Number(line.productId) === option.variant.id);
        return <li key={option.variant.id} className="flex items-center gap-3 p-3">
          {option.imageUrl ? <img src={option.imageUrl} alt="" loading="lazy" className="h-12 w-10 shrink-0 rounded-md bg-pw-canvas object-cover" /> : <span aria-hidden="true" className="grid h-12 w-10 shrink-0 place-items-center rounded-md bg-pw-canvas text-[10px] text-pw-muted">—</span>}
          <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">Código {option.product.code} · {option.variant.sizeName || "Unitalla"}</p><p className="text-xs text-pw-muted">{option.presentationName} · {money.format(option.variant.salePrice)} · {option.variant.availableQuantity} disponibles</p></div>
          <button type="button" disabled={selected} onClick={() => addOutbound(option)} className="min-h-9 shrink-0 rounded-lg border border-pw-brand px-3 text-xs font-bold text-pw-brand-deep disabled:border-pw-line disabled:text-pw-muted">{selected ? "Agregada" : "Agregar"}</button>
        </li>;
      })}</ul> : null}
      {catalog?.hasNextPage ? <button type="button" onClick={() => setSearchPage((page) => page + 1)} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold">Ver más resultados</button> : null}
      {outboundLines.map((line, index) => <div key={line.productId} className="grid gap-2 rounded-xl border border-pw-line p-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto] sm:items-end">
      <div className="flex min-w-0 items-center gap-3">{line.option.imageUrl ? <img src={line.option.imageUrl} alt="" className="h-12 w-10 shrink-0 rounded-md bg-pw-canvas object-cover" /> : null}<div className="min-w-0"><p className="text-sm font-extrabold">Código {line.option.product.code} · {line.option.variant.sizeName || "Unitalla"}</p><p className="text-xs text-pw-muted">{line.option.presentationName} · {money.format(line.option.variant.salePrice)} · {line.option.variant.availableQuantity} disponibles</p></div></div>
      <label className="grid gap-1 text-xs font-bold text-pw-muted">Tipo<SelectControl id={`sale-post-outbound-type-${index}`} aria-label={`Tipo de prenda de salida ${index + 1}`} value={line.itemTypeId} options={[{ value: "1", label: "Reemplazo" }, { value: "2", label: "Compra adicional" }]} onChange={(event) => setOutboundLines((current) => current.map((value, currentIndex) => currentIndex === index ? { ...value, itemTypeId: event.target.value } : value))} /></label>
      <label className="grid gap-1 text-xs font-bold text-pw-muted">Cantidad<input aria-label={`Cantidad de salida ${index + 1}`} type="number" min="1" step="1" max={line.option.variant.availableQuantity} value={line.quantity} onChange={(event) => setOutboundLines((current) => current.map((value, currentIndex) => currentIndex === index ? { ...value, quantity: event.target.value } : value))} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" required /></label>
      <button type="button" aria-label={`Quitar prenda de salida ${index + 1}`} onClick={() => setOutboundLines((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="grid min-h-10 w-10 place-items-center rounded-lg text-red-700 hover:bg-red-50"><TrashIcon /></button>
    </div>)}
      {searchCode.trim() && searchPage > 1 && catalog?.hasPreviousPage ? <button type="button" onClick={() => setSearchPage((page) => Math.max(1, page - 1))} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold">Resultados anteriores</button> : null}
      {!products.some((product) => product.presentations.some((presentation) => presentation.sizes.some((variant) => variant.availableQuantity > 0))) ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No hay prendas disponibles para entregar en este cambio.</p> : null}
    </fieldset>
    <section aria-label="Resumen de diferencia del cambio" className="rounded-xl border border-pw-line bg-pw-canvas p-4">
      <h3 className="text-sm font-extrabold">Diferencia del cambio</h3>
      <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-pw-muted">Valor reconocido de prendas devueltas</dt><dd className="font-bold tabular-nums">{money.format(recognizedReturnTotal)}</dd></div><div className="flex justify-between gap-4"><dt className="text-pw-muted">Valor de prendas nuevas</dt><dd className="font-bold tabular-nums">{money.format(outboundItemsTotal)}</dd></div><div className="flex justify-between gap-4 border-t border-pw-line pt-2"><dt className="font-extrabold">{exchangeBalance > 0 ? "La clienta paga" : exchangeBalance < 0 ? "Saldo a favor de la clienta" : "Sin diferencia"}</dt><dd className="font-extrabold tabular-nums">{money.format(Math.abs(exchangeBalance))}</dd></div>{hasAgency ? <><div className="flex justify-between gap-4"><dt className="text-pw-muted">Envío cobrado</dt><dd className="font-bold tabular-nums">{money.format(Number(shipping) || 0)}</dd></div><div className="flex justify-between gap-4"><dt className="text-pw-muted">Total a cobrar por agencia</dt><dd className="font-bold tabular-nums">{money.format(agencyAmountToCollect)}</dd></div></> : null}</dl>
    </section>
    <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-1">Entrega<select aria-label="Forma de entrega del cambio" value={agencyId} onChange={(event) => setAgencyId(event.target.value)} className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm"><option value="">En el local</option>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}</select></label>{hasAgency ? <><label className="grid gap-1 text-xs font-bold text-pw-muted">Código del envío<input value={deliveryCode} onChange={(event) => setDeliveryCode(event.target.value)} maxLength={40} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label><label className="grid gap-1 text-xs font-bold text-pw-muted">Envío cobrado<input type="number" min="0" step="0.01" value={shipping} onChange={(event) => setShipping(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label><label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-3">Dirección<input value={address} onChange={(event) => setAddress(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label></> : null}<label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-3">Comentarios<textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={300} rows={2} className="rounded-lg border border-pw-line px-3 py-2 text-sm" /></label></div>
    {error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}<footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} disabled={!returnChoices.length || !products.some((product) => product.presentations.some((presentation) => presentation.sizes.some((variant) => variant.availableQuantity > 0)))} className="min-h-10 text-sm">Crear cambio</LoadingButton></footer>
  </form></AsyncDialog>;
}

function CreateReturnDialog({ sale, products, agencies, exchanges, returns, busy, onClose, onSave }: {
  sale: SaleDetail; products: ProductDTO[]; agencies: SaleDeliveryAgency[]; exchanges: SaleExchange[]; returns: SaleReturn[]; busy: boolean;
  onClose: () => void; onSave: (payload: CreateSaleReturnPayload) => Promise<boolean>;
}) {
  const choices = itemOptions(sale, exchanges, returns, products);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [reason, setReason] = useState("1"); const [method, setMethod] = useState("1"); const [agencyId, setAgencyId] = useState("");
  const [returnCode, setReturnCode] = useState(""); const [address, setAddress] = useState(""); const [shipping, setShipping] = useState("0"); const [comments, setComments] = useState(""); const [error, setError] = useState("");
  const isAgency = method === "2"; const chargeShipping = reason === "1" && isAgency;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const payloadLines = lines.map((line) => ({ originalSaleProductId: Number(line.saleProductId), quantity: Number(line.quantity), recognizedUnitAmount: Number(line.recognizedUnitAmount) }));
    if (!payloadLines.length || payloadLines.some((line) => {
      const originalLine = sale.productVariants.find((item) => item.id === line.originalSaleProductId);
      return !originalLine || line.quantity < 1 || line.recognizedUnitAmount < 0 || line.recognizedUnitAmount > originalLine.finalUnitPrice;
    })) { setError("Agrega al menos una prenda con cantidad y monto válidos. El monto reconocido no puede superar el precio de la prenda."); return; }
    const payload: CreateSaleReturnPayload = { reasonId: Number(reason), methodId: Number(method), returnShippingChargedToClient: chargeShipping ? Number(shipping) || 0 : 0, items: payloadLines, ...(comments.trim() ? { comments: comments.trim() } : {}), ...(isAgency ? { deliveryAgencyId: Number(agencyId), returnCode: returnCode.trim(), deliveryAddress: address.trim() } : {}) };
    if (isAgency && !agencyId) { setError("Selecciona la agencia de envío."); return; }
    const saved = await onSave(payload); if (saved) onClose();
  };
  return <AsyncDialog title="Solicitar devolución" onClose={onClose} wide><form onSubmit={submit} className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold text-pw-muted">Motivo<SelectControl id="sale-return-reason" aria-label="Motivo de devolución" value={reason} options={returnReasons} onChange={(event) => setReason(event.target.value)} /></label>
      <label className="grid gap-1 text-xs font-bold text-pw-muted">Recepción<SelectControl id="sale-return-method" aria-label="Método de devolución" value={method} options={[{ value: "1", label: "En el local" }, { value: "2", label: "Por agencia" }]} onChange={(event) => setMethod(event.target.value)} /></label>
      {isAgency ? <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Agencia<SelectControl id="sale-return-agency" aria-label="Agencia de devolución" value={agencyId} options={[{ value: "", label: "Seleccionar agencia" }, ...agencies.map((agency) => ({ value: String(agency.id), label: agency.name }))]} onChange={(event) => setAgencyId(event.target.value)} required /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Código de retorno<input value={returnCode} onChange={(event) => setReturnCode(event.target.value)} maxLength={40} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label>
        {chargeShipping ? <label className="grid gap-1 text-xs font-bold text-pw-muted">Envío cobrado<input type="number" min="0" step="0.01" value={shipping} onChange={(event) => setShipping(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label> : null}
        <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-3">Dirección<input value={address} onChange={(event) => setAddress(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label>
      </div> : null}
    </div>
    <fieldset className="space-y-2"><legend className="mb-2 text-sm font-extrabold">Marca las prendas que devuelve la clienta</legend>{choices.map(({ line: saleLine, remaining }) => {
      const draft = lines.find((item) => Number(item.saleProductId) === saleLine.id);
      const details = variantReturnDetails(saleLine.productId, products);
      const index = lines.findIndex((item) => Number(item.saleProductId) === saleLine.id);
      return <div key={saleLine.id} className={`rounded-xl border p-3 ${draft ? "border-pw-brand bg-pw-brand-soft/40" : "border-pw-line"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
          <input type="checkbox" aria-label={`Devolver código ${details.code}, talla ${details.size}`} checked={Boolean(draft)} onChange={(event) => {
            if (event.target.checked) setLines((current) => [...current, { saleProductId: String(saleLine.id), quantity: "1", recognizedUnitAmount: String(saleLine.finalUnitPrice) }]);
            else setLines((current) => current.filter((item) => Number(item.saleProductId) !== saleLine.id));
          }} className="h-4 w-4 shrink-0 accent-pw-brand" />
          {details.imageUrl ? <img src={details.imageUrl} alt={`Código ${details.code}`} className="h-14 w-11 shrink-0 rounded-lg bg-pw-canvas object-cover" /> : <span role="img" aria-label="Sin imagen" className="grid h-14 w-11 shrink-0 place-items-center rounded-lg bg-pw-canvas px-1 text-center text-[10px] text-pw-muted">Sin imagen</span>}
          <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">Código {details.code}</p><p className="text-xs text-pw-muted">Talla {details.size} · Disponible para devolución: {remaining}</p></div>
          </div>
          {draft ? <div className="grid shrink-0 grid-cols-[5rem_10rem_2.25rem] items-end gap-2 pl-7 sm:pl-0"><label className="grid gap-1 text-xs font-bold text-pw-muted">Cantidad<input aria-label={`Cantidad devuelta ${index + 1}`} type="number" min="1" max={remaining} step="1" value={draft.quantity} onChange={(event) => setLines((current) => current.map((item) => Number(item.saleProductId) === saleLine.id ? { ...item, quantity: event.target.value } : item))} className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm" required /></label><label className="grid gap-1 text-xs font-bold text-pw-muted">Reconocido por unidad (C$)<input aria-label={`Monto reconocido ${index + 1}`} type="number" min="0" max={saleLine.finalUnitPrice} step="0.01" value={draft.recognizedUnitAmount} onChange={(event) => { const value = event.target.value; setLines((current) => current.map((item) => Number(item.saleProductId) === saleLine.id ? { ...item, recognizedUnitAmount: value && Number(value) > saleLine.finalUnitPrice ? String(saleLine.finalUnitPrice) : value } : item)); }} className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm" required /></label><button type="button" aria-label={`Quitar prenda devuelta ${index + 1}`} onClick={() => setLines((current) => current.filter((item) => Number(item.saleProductId) !== saleLine.id))} className="grid h-9 w-9 place-items-center rounded-lg text-red-700 hover:bg-red-50"><TrashIcon /></button></div> : null}
        </div>
      </div>;
    })}{!choices.length ? <p className="rounded-lg border border-dashed border-pw-line p-4 text-sm text-pw-muted">No hay prendas disponibles para devolver.</p> : null}</fieldset>
    <label className="grid gap-1 text-xs font-bold text-pw-muted">Comentarios<textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={300} rows={2} className="rounded-lg border border-pw-line px-3 py-2 text-sm" /></label>
    {error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}<footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} disabled={!choices.length} className="min-h-10 text-sm">Crear devolución</LoadingButton></footer>
  </form></AsyncDialog>;
}

function SettleExchangeDialog({ exchange, terminals, busy, onClose, onSave }: { exchange: SaleExchange; terminals: SaleCatalogOption[]; busy: boolean; onClose: () => void; onSave: (payload: CreateSaleExchangeSettlementPayload) => Promise<boolean> }) {
  const amount = Math.abs(exchange.balanceToCollect);
  const [tenders, setTenders] = useState([{ paymentMethodId: "1", paymentTerminalId: "", amount: amount.toFixed(2) }]);
  const [comments, setComments] = useState(""); const [error, setError] = useState("");
  const total = round(tenders.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    if (total !== round(amount)) { setError(`Las líneas deben sumar ${money.format(amount)}.`); return; }
    if (tenders.some((item) => Number(item.paymentMethodId) === 3 && !item.paymentTerminalId)) { setError("Selecciona una terminal para cada pago con tarjeta."); return; }
    const payload: CreateSaleExchangeSettlementPayload = { tenders: tenders.map((item) => ({ paymentMethodId: Number(item.paymentMethodId), ...(Number(item.paymentMethodId) === 3 ? { paymentTerminalId: Number(item.paymentTerminalId) } : {}), amount: Number(item.amount) })), ...(comments.trim() ? { comments: comments.trim() } : {}) };
    const saved = await onSave(payload); if (saved) onClose();
  };
  return <AsyncDialog title={exchange.balanceToCollect > 0 ? "Cobrar diferencia del cambio" : "Reembolsar diferencia del cambio"} onClose={onClose}><form onSubmit={submit} className="space-y-4"><p className="text-sm text-pw-muted">{exchange.balanceToCollect > 0 ? "La clienta debe" : "La boutique debe reembolsar"} <strong className="text-pw-ink">{money.format(amount)}</strong>. El cambio se registra por separado de los pagos de la venta.</p>{tenders.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-pw-line p-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-pw-muted">Método<SelectControl id={`sale-exchange-tender-method-${index}`} aria-label={`Método de liquidación ${index + 1}`} value={item.paymentMethodId} options={[{ value: "1", label: "Efectivo" }, { value: "2", label: "Transferencia" }, { value: "3", label: "Tarjeta" }]} onChange={(event) => setTenders((current) => current.map((tender, i) => i === index ? { ...tender, paymentMethodId: event.target.value, paymentTerminalId: "" } : tender))} /></label><label className="grid gap-1 text-xs font-bold text-pw-muted">Monto (C$)<input type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => setTenders((current) => current.map((tender, i) => i === index ? { ...tender, amount: event.target.value } : tender))} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" required /></label>{Number(item.paymentMethodId) === 3 ? <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-2">Terminal<SelectControl id={`sale-exchange-tender-terminal-${index}`} aria-label={`Terminal de liquidación ${index + 1}`} value={item.paymentTerminalId} options={[{ value: "", label: "Seleccionar terminal" }, ...terminals.map((terminal) => ({ value: String(terminal.id), label: terminal.name }))]} onChange={(event) => setTenders((current) => current.map((tender, i) => i === index ? { ...tender, paymentTerminalId: event.target.value } : tender))} required /></label> : null}{tenders.length > 1 ? <button type="button" className="justify-self-start text-xs font-bold text-red-700" onClick={() => setTenders((current) => current.filter((_, i) => i !== index))}>Quitar línea</button> : null}</div>)}<button type="button" onClick={() => setTenders((current) => [...current, { paymentMethodId: "1", paymentTerminalId: "", amount: "0.00" }])} className="min-h-9 rounded-lg border border-pw-brand px-3 text-xs font-bold text-pw-brand-deep">Agregar otro medio</button><p className="text-sm text-pw-muted">Distribuido: <strong className="text-pw-ink">{money.format(total)}</strong> de {money.format(amount)}</p><label className="grid gap-1 text-xs font-bold text-pw-muted">Comentarios<textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={300} rows={2} className="rounded-lg border border-pw-line px-3 py-2 text-sm" /></label>{error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}<footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} className="min-h-10 text-sm">{exchange.balanceToCollect > 0 ? "Registrar cobro" : "Registrar reembolso"}</LoadingButton></footer></form></AsyncDialog>;
}

function ReturnProcessDialog({ saleReturn, busy, onClose, onPickup, onReceive }: { saleReturn: SaleReturnModel; busy: boolean; onClose: () => void; onPickup: (payload: ProcessSaleReturnPayload) => Promise<boolean>; onReceive: (payload: ReceiveSaleReturnPayload) => Promise<boolean> }) {
  const isAgencyPickup = saleReturn.methodId === 2 && saleReturn.statusId === 1;
  const refundRequired = saleReturn.refundTotal > 0 && (isAgencyPickup || saleReturn.methodId === 1);
  const [paymentMethodId, setPaymentMethodId] = useState("1");
  const [damaged, setDamaged] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState("");
  const title = isAgencyPickup ? "Registrar recogida y reembolso" : saleReturn.methodId === 1 ? "Recibir devolución y reembolsar" : "Confirmar recepción de devolución";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAgencyPickup) {
      const payload: ProcessSaleReturnPayload = { paymentMethodId: Number(paymentMethodId), ...(comments.trim() ? { comments: comments.trim() } : {}) };
      if (await onPickup(payload)) onClose();
      return;
    }
    const payload: ReceiveSaleReturnPayload = { ...(refundRequired && saleReturn.methodId === 1 ? { paymentMethodId: Number(paymentMethodId) } : {}), ...(comments.trim() ? { comments: comments.trim() } : {}), items: saleReturn.items.map((item) => ({ saleReturnItemId: item.id, isDamaged: damaged[item.id] ?? false })) };
    if (await onReceive(payload)) onClose();
  };
  return <AsyncDialog title={title} onClose={onClose}><form onSubmit={submit} className="space-y-4"><p className="text-sm text-pw-muted">Reembolso calculado: <strong className="text-pw-ink">{money.format(saleReturn.refundTotal)}</strong></p>{refundRequired ? <label className="grid gap-1 text-xs font-bold text-pw-muted">Método de reembolso<SelectControl id="sale-return-refund-method" aria-label="Método de reembolso" value={paymentMethodId} options={[{ value: "1", label: "Efectivo" }, { value: "2", label: "Transferencia" }, { value: "3", label: "Tarjeta" }]} onChange={(event) => setPaymentMethodId(event.target.value)} /></label> : null}{!isAgencyPickup ? <fieldset className="space-y-2"><legend className="text-xs font-extrabold text-pw-muted">Estado de las prendas recibidas</legend>{saleReturn.items.map((item) => <label key={item.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-pw-line px-3 text-sm"><span>Prenda #{item.productId} · cantidad {item.quantity}</span><span className="flex items-center gap-2"><input type="checkbox" checked={damaged[item.id] ?? false} onChange={(event) => setDamaged((current) => ({ ...current, [item.id]: event.target.checked }))} /> Dañada</span></label>)}</fieldset> : null}<label className="grid gap-1 text-xs font-bold text-pw-muted">Comentarios<textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={300} rows={2} className="rounded-lg border border-pw-line px-3 py-2 text-sm" /></label><footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} className="min-h-10 text-sm">{isAgencyPickup ? "Confirmar recogida" : "Confirmar recepción"}</LoadingButton></footer></form></AsyncDialog>;
}

export function SaleDetailPostSale({ sale, products, catalogLoading, agencies, terminals, isAdmin, busy, onMutation }: { sale: SaleDetail; products: ProductDTO[]; catalogLoading: boolean; agencies: SaleDeliveryAgency[]; terminals: SaleCatalogOption[]; isAdmin: boolean; busy: boolean; onMutation: (action: () => Promise<unknown>, title: string) => Promise<boolean> }) {
  const { request } = useAuth();
  const [exchanges, setExchanges] = useState<SaleExchange[]>([]); const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [refresh, setRefresh] = useState(0);
  const [creatingExchange, setCreatingExchange] = useState(false); const [creatingReturn, setCreatingReturn] = useState(false);
  const [settling, setSettling] = useState<SaleExchange | null>(null); const [processingReturn, setProcessingReturn] = useState<SaleReturn | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; label: string; action: () => Promise<unknown>; success: string } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([getSaleExchanges(request, sale.id), getSaleReturns(request, sale.id)])
      .then(([nextExchanges, nextReturns]) => { if (active) { setExchanges(nextExchanges); setReturns(nextReturns); setError(null); } })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudo cargar el historial postventa."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, sale.id, refresh]);
  const canStart = isAdmin && (sale.saleStatusId === 4 || sale.saleStatusId === 5);
  const hasAvailableOutbound = products.some((product) => product.presentations.some((presentation) => presentation.sizes.some((variant) => variant.availableQuantity > 0)));
  const handle = async (action: () => Promise<unknown>, title: string) => { const saved = await onMutation(action, title); if (saved) setRefresh((value) => value + 1); return saved; };
  const hasAvailableReturn = useMemo(() => itemOptions(sale, exchanges, returns, products).length > 0, [sale, exchanges, returns, products]);
  const createExchangeAction = (payload: CreateSaleExchangePayload) => handle(() => createSaleExchange(request, sale.id, payload), "Cambio registrado.");
  const createReturnAction = (payload: CreateSaleReturnPayload) => handle(() => createSaleReturn(request, sale.id, payload), "Devolución solicitada.");
  const confirmAction = async () => { if (!confirm) return; if (await handle(confirm.action, confirm.success)) setConfirm(null); };
  const methods = (value: number | null) => ({ 1: "Efectivo", 2: "Transferencia", 3: "Tarjeta" }[value ?? 0] ?? "—");
  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-post-sale-title">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="sale-post-sale-title" className="text-base font-extrabold">Cambios y devoluciones</h2><p className="mt-1 text-xs text-pw-muted">La venta original y sus pagos se conservan sin cambios.</p></div>{canStart ? <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || loading || catalogLoading || !hasAvailableReturn || !hasAvailableOutbound} onClick={() => setCreatingExchange(true)} className="min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep disabled:opacity-50">Crear cambio</button><button type="button" disabled={busy || loading || !hasAvailableReturn} onClick={() => setCreatingReturn(true)} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-extrabold text-white disabled:opacity-50">Solicitar devolución</button></div> : null}</header>
    {loading ? <LoadingState /> : error ? <ErrorState title="No pudimos cargar los cambios y devoluciones" description={error} onRetry={() => setRefresh((value) => value + 1)} /> : <div className="space-y-4">
      {!exchanges.length && !returns.length ? <p className="rounded-xl border border-dashed border-pw-line py-6 text-center text-sm text-pw-muted">Esta venta aún no tiene cambios ni devoluciones.</p> : null}
      {exchanges.map((exchange) => <article key={`exchange-${exchange.id}`} className="rounded-xl border border-pw-line p-4"><header className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-extrabold">Cambio #{exchange.id}</h3><p className="mt-1 text-xs text-pw-muted">{exchangeStatuses[exchange.statusId] ?? exchange.statusName} · {exchange.postSaleDelivery ? `Agencia ${exchange.postSaleDelivery.deliveryAgencyName ?? ""}` : "En el local"}</p></div><strong className={`text-sm tabular-nums ${exchange.balanceToCollect < 0 ? "text-pw-brand-deep" : ""}`}>{exchange.balanceToCollect < 0 ? "Reembolso " : "Saldo a cobrar "}{money.format(Math.abs(exchange.balanceToCollect))}</strong></header>
        <div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h4 className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Devueltas</h4><ul className="mt-1 space-y-1 text-sm">{exchange.returnItems.map((item) => <li key={item.id}>{variantLabel(item.productId, products)} × {item.quantity} <span className="text-xs text-pw-muted">· {exchangeReturnStatuses[item.statusId] ?? item.statusName}</span></li>)}</ul></div><div><h4 className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Entregadas a la clienta</h4><ul className="mt-1 space-y-1 text-sm">{exchange.outboundItems.map((item) => <li key={item.id}>{variantLabel(item.productId, products)} × {item.quantity} · {item.itemTypeId === 1 ? "Reemplazo" : "Compra adicional"}</li>)}</ul></div></div>
        {exchange.postSaleDelivery ? <p className="mt-3 rounded-lg bg-pw-canvas p-3 text-xs text-pw-muted">Envío {exchange.postSaleDelivery.code || "sin código"} · {postSaleDeliveryStatuses[exchange.postSaleDelivery.statusId] ?? exchange.postSaleDelivery.statusName} · Cobrar a clienta: <strong className="text-pw-ink">{money.format(exchange.postSaleDelivery.amountToCollect)}</strong>{exchange.postSaleDelivery.address ? ` · ${exchange.postSaleDelivery.address}` : ""}</p> : null}
        {exchange.settlement ? <p className="mt-3 rounded-lg bg-pw-canvas p-3 text-sm">{exchange.settlement.movementDirectionId === 1 ? "Cobro" : "Reembolso"} de <strong>{money.format(exchange.settlement.amount)}</strong> · {date(exchange.settlement.movementDate)} · {exchange.settlement.tenders.map((tender) => `${methods(tender.paymentMethodId)}${tender.paymentTerminalName ? ` (${tender.paymentTerminalName})` : ""} ${money.format(tender.amount)}`).join(" + ")}</p> : null}
        {isAdmin ? <div className="mt-3 flex flex-wrap gap-2">{exchange.statusId === 1 ? <button type="button" disabled={busy} onClick={() => setConfirm({ title: `Confirmar entrega del cambio #${exchange.id}`, description: "Confirma que se entregaron las prendas nuevas y se recibieron las prendas devueltas.", label: "Confirmar entrega", action: () => completeSaleExchangeHandover(request, sale.id, exchange.id), success: "Entrega del cambio registrada." })} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold">Registrar entrega</button> : null}{exchange.returnItems.filter((item) => item.statusId === 2).map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => setConfirm({ title: "Confirmar recepción de prenda", description: `Se marcará recibida: ${variantLabel(item.productId, products)}.`, label: "Confirmar recepción", action: () => receiveSaleExchangeReturnItem(request, sale.id, exchange.id, item.id), success: "Prenda devuelta recibida." })} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold">Recibir prenda #{item.id}</button>)}{!exchange.postSaleDelivery && exchange.statusId !== 1 && exchange.statusId !== 5 && !exchange.settlement && Math.abs(exchange.balanceToCollect) > 0 ? <button type="button" disabled={busy} onClick={() => setSettling(exchange)} className="min-h-9 rounded-lg bg-pw-brand px-3 text-xs font-extrabold text-white">{exchange.balanceToCollect > 0 ? "Cobrar diferencia" : "Registrar reembolso"}</button> : null}{exchange.statusId === 1 ? <button type="button" disabled={busy} onClick={() => setConfirm({ title: `Cancelar cambio #${exchange.id}`, description: "Se liberarán las prendas reservadas para este cambio.", label: "Cancelar cambio", action: () => cancelSaleExchange(request, sale.id, exchange.id), success: "Cambio cancelado." })} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700">Cancelar cambio</button> : null}</div> : null}
      </article>)}
      {returns.map((saleReturn) => <article key={`return-${saleReturn.id}`} className="rounded-xl border border-pw-line p-4"><header className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-extrabold">Devolución #{saleReturn.id}</h3><p className="mt-1 text-xs text-pw-muted">{returnStatuses[saleReturn.statusId] ?? saleReturn.statusName} · {returnReasonLabels[saleReturn.reasonId] ?? saleReturn.reasonName} · {returnMethodLabels[saleReturn.methodId] ?? saleReturn.methodName}</p></div><strong className="text-sm tabular-nums">Reembolso calculado: {money.format(saleReturn.refundTotal)}</strong></header>
        <ul className="mt-3 divide-y divide-pw-line rounded-xl border border-pw-line">{saleReturn.items.map((item) => {
          const details = variantReturnDetails(item.productId, products);
          return <li key={item.id} className="flex flex-wrap items-center gap-3 p-3 sm:gap-4">
            {details.imageUrl ? <img src={details.imageUrl} alt={`Código ${details.code}`} loading="lazy" className="h-16 w-12 shrink-0 rounded-lg bg-pw-canvas object-cover" /> : <span role="img" aria-label="Sin imagen" className="grid h-16 w-12 shrink-0 place-items-center rounded-lg bg-pw-canvas px-1 text-center text-[10px] text-pw-muted">Sin imagen</span>}
            <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">Código {details.code}</p><p className="text-xs text-pw-muted">Talla {details.size} · Cantidad {item.quantity}{item.receivedAt ? ` · ${item.productInventoryIssueId ? "Dañada" : "Recibida"}` : ""}</p></div>
            <div className="ml-auto grid grid-cols-2 gap-x-5 text-right text-xs tabular-nums sm:gap-x-8"><span><span className="block text-pw-muted">Reconocido / unidad</span><strong className="text-pw-ink">{money.format(item.recognizedUnitAmount)}</strong></span><span><span className="block text-pw-muted">Total prenda</span><strong className="text-pw-ink">{money.format(item.recognizedUnitAmount * item.quantity)}</strong></span></div>
          </li>;
        })}</ul>{saleReturn.postSaleDelivery ? <p className="mt-3 rounded-lg bg-pw-canvas p-3 text-xs text-pw-muted">Retorno {saleReturn.postSaleDelivery.code || "sin código"} · Agencia {saleReturn.postSaleDelivery.deliveryAgencyName ?? ""} · {postSaleDeliveryStatuses[saleReturn.postSaleDelivery.statusId] ?? saleReturn.postSaleDelivery.statusName}{saleReturn.postSaleDelivery.address ? ` · ${saleReturn.postSaleDelivery.address}` : ""}</p> : null}{saleReturn.refundPaymentMethodId ? <p className="mt-2 text-xs text-pw-muted">Reembolso registrado por {methods(saleReturn.refundPaymentMethodId)}{saleReturn.pickedUpAt ? ` · ${date(saleReturn.pickedUpAt)}` : ""}</p> : null}
        {isAdmin ? <div className="mt-3 flex flex-wrap gap-2">{saleReturn.statusId === 1 || saleReturn.statusId === 2 && saleReturn.methodId === 2 ? <button type="button" disabled={busy} onClick={() => setProcessingReturn(saleReturn)} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold">{saleReturn.statusId === 1 && saleReturn.methodId === 2 ? "Registrar recogida" : saleReturn.methodId === 1 ? "Recibir y reembolsar" : "Confirmar llegada"}</button> : null}{saleReturn.statusId === 1 ? <button type="button" disabled={busy} onClick={() => setConfirm({ title: `Cancelar devolución #${saleReturn.id}`, description: "La solicitud se cancelará y las prendas volverán a estar disponibles para otros procesos postventa.", label: "Cancelar devolución", action: () => cancelSaleReturn(request, sale.id, saleReturn.id), success: "Devolución cancelada." })} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700">Cancelar devolución</button> : null}</div> : null}
      </article>)}
    </div>}
    {creatingExchange ? <CreateExchangeDialog sale={sale} products={products} agencies={agencies} exchanges={exchanges} returns={returns} busy={busy} onClose={() => setCreatingExchange(false)} onSave={createExchangeAction} /> : null}
    {creatingReturn ? <CreateReturnDialog sale={sale} products={products} agencies={agencies} exchanges={exchanges} returns={returns} busy={busy} onClose={() => setCreatingReturn(false)} onSave={createReturnAction} /> : null}
    {settling ? <SettleExchangeDialog exchange={settling} terminals={terminals} busy={busy} onClose={() => setSettling(null)} onSave={(payload) => handle(() => settleSaleExchange(request, sale.id, settling.id, payload), "Saldo del cambio liquidado.")} /> : null}
    {processingReturn ? <ReturnProcessDialog saleReturn={processingReturn} busy={busy} onClose={() => setProcessingReturn(null)} onPickup={(payload) => handle(() => registerSaleReturnPickup(request, sale.id, processingReturn.id, payload), "Recogida y reembolso registrados.")} onReceive={(payload) => handle(() => receiveSaleReturn(request, sale.id, processingReturn.id, payload), "Recepción de devolución registrada.")} /> : null}
    <ConfirmDialog open={!!confirm} title={confirm?.title ?? "Confirmar acción"} description={confirm?.description ?? ""} confirmLabel={confirm?.label ?? "Confirmar"} isPending={busy} onConfirm={() => void confirmAction()} onClose={() => { if (!busy) setConfirm(null); }} />
  </section>;
}
