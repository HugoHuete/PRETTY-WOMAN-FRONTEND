import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { LoadingButton } from "../../shared/ui/loading-button";
import { Pagination } from "../../shared/ui/pagination";
import { ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { useAuth } from "../auth/auth-provider";
import type { SaleDetail, SaleDelivery, SaleSelectionHold, SaleDeliveryAction, PatchSaleDeliveryPayload, CreateSaleDeliveryPayload, CreateSaleSelectionProductPayload, SaleDeliveryAgency, SaleMunicipality } from "./sales-types";
import type { ProductDTO } from "../products/product-types";
import { getSaleProducts } from "./sales-api";
import { saleVariants, type SaleVariantOption } from "./sale-product-types";
import { SaleDeliveryEditDialog } from "./sale-delivery-edit-dialog";
import { SaleDeliveryCreateDialog } from "./sale-delivery-create-dialog";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const statuses: Record<number, string> = { 1: "Pendiente", 2: "Completada", 3: "Cancelada", 4: "Despachada", 5: "Entrega fallida", 6: "Entregada · selección pendiente" };
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
function paidAmount(amounts: number[]) { return Math.round((amounts.reduce((total, amount) => total + amount, 0) + Number.EPSILON) * 100) / 100; }
function signedPaymentAmount(directionId: number, amount: number) { return directionId === 2 ? -amount : amount; }
function variantName(hold: SaleSelectionHold, products: ProductDTO[]) {
  for (const product of products) for (const presentation of product.presentations) for (const variant of presentation.sizes) if (variant.id === hold.productId) return { product, presentation, variant };
  return null;
}
function SelectionProductThumb({ choice }: { choice: ReturnType<typeof variantName> }) {
  const image = choice?.presentation.primaryImageUrl || choice?.product.primaryImageUrl;
  return image
    ? <img src={image} alt="" className="h-12 w-10 shrink-0 rounded-lg bg-pw-brand-soft object-cover" />
    : <span aria-hidden="true" className="grid h-12 w-10 shrink-0 place-items-center rounded-lg bg-pw-brand-soft text-[10px] font-bold text-pw-brand-deep">{choice?.product.code ?? "—"}</span>;
}
function AddHoldDialog({ existingProductIds, busy, onClose, onSave }: {
  existingProductIds: number[];
  busy: boolean;
  onClose: () => void;
  onSave: (payload: CreateSaleSelectionProductPayload[]) => Promise<boolean>;
}) {
  const { request } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getSaleProducts>> | null>(null);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    return () => dialog.current?.close();
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

  const addVariant = async (option: SaleVariantOption) => {
    const saved = await onSave([{ productId: option.variant.id, quantity: 1 }]);
    if (!saved) return;
    setAddedIds((current) => current.includes(option.variant.id) ? current : [...current, option.variant.id]);
    setAnnouncement(option.product.name + ", " + option.presentationName + (option.variant.sizeName ? ", talla " + option.variant.sizeName : "") + ", apartada para selección.");
  };

  return createPortal(<dialog ref={dialog} aria-labelledby="sale-add-hold-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/45">
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex items-center justify-between border-b border-pw-line px-5 py-4"><h2 id="sale-add-hold-title" className="text-lg font-extrabold">Buscar prendas para selección</h2><button type="button" aria-label="Cerrar búsqueda de prendas" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
      <div className="space-y-4 overflow-y-auto p-5">
        <label htmlFor="selection-hold-code" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">Código de la prenda<input id="selection-hold-code" type="search" inputMode="numeric" autoComplete="off" value={code} onChange={(event) => { setCode(event.target.value); setPage(1); setAnnouncement(""); }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Escribe el código" className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink" /></label>
        {!code.trim() ? <p className="rounded-xl border border-dashed border-pw-line p-5 text-center text-sm text-pw-muted">Escribe el código para consultar las prendas disponibles.</p> : null}
        {code.trim() && !/^\d+$/.test(code.trim()) ? <p role="status" className="text-sm text-pw-muted">El código debe contener solo números.</p> : null}
        {loading ? <LoadingState /> : null}
        {!loading && error ? <ErrorState title="No se pudo buscar el catálogo" description={error} onRetry={() => setRetry((value) => value + 1)} /> : null}
        {!loading && !error && catalog && options.length === 0 ? <p className="rounded-xl border border-dashed border-pw-line p-5 text-center text-sm text-pw-muted">No encontramos prendas disponibles con ese código.</p> : null}
        {!loading && !error && options.length > 0 ? <div className="grid gap-3">{groups.map((group) => {
          const first = group[0];
          return <section key={first.product.id + ":" + first.presentationId} className="overflow-hidden rounded-xl border border-pw-line">
            <header className="flex items-center gap-3 px-3 py-2.5 sm:px-4">{first.imageUrl ? <img src={first.imageUrl} alt="" className="h-12 w-10 shrink-0 rounded-md bg-pw-canvas object-cover" /> : <span aria-hidden="true" className="grid h-12 w-10 shrink-0 place-items-center rounded-md bg-pw-brand-soft text-[10px] font-bold text-pw-brand-deep">{first.product.code}</span>}<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5"><p className="text-xs font-extrabold text-pw-brand-deep">Código {first.product.code}</p><h3 className="text-sm font-extrabold text-pw-ink">{first.presentationName}</h3><p className="min-w-0 text-xs text-pw-muted">{first.product.subcategoryName?.trim() || "Sin subcategoría"}</p></div></header>
            <div>{group.map((option) => {
              const added = existingProductIds.includes(option.variant.id) || addedIds.includes(option.variant.id);
              const price = option.variant.discountedSalePrice ?? option.variant.salePrice;
              return <div key={option.variant.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-pw-line px-3 py-2 sm:px-4"><div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5"><p className="text-sm font-bold text-pw-ink">{option.variant.sizeName || "Talla única"}</p><p className="text-xs text-pw-muted">{money.format(price)}</p><p className="text-xs text-pw-muted">{option.variant.availableQuantity} disponibles</p></div><button type="button" disabled={busy || added} onClick={() => void addVariant(option)} className="min-h-9 shrink-0 rounded-lg border border-pw-brand px-3 text-xs font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft disabled:cursor-default disabled:border-pw-line disabled:text-pw-muted">{added ? "Apartada" : "Agregar"}</button></div>;
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
function DeliveryCard({ sale, delivery, isAdmin, busy, onAction, onEdit }: { sale: SaleDetail; delivery: SaleDelivery; isAdmin: boolean; busy: boolean; onAction: (deliveryId: number, action: SaleDeliveryAction) => Promise<boolean>; onEdit: (deliveryId: number, payload: PatchSaleDeliveryPayload) => Promise<boolean> }) {
  const productPaid = paidAmount(sale.paymentMovements.map((movement) => signedPaymentAmount(movement.movementDirectionId, movement.productAmount)));
  const deliveryShippingPaid = paidAmount(sale.paymentMovements
    .filter((movement) => movement.saleDeliveryId === delivery.id)
    .map((movement) => signedPaymentAmount(movement.movementDirectionId, movement.shippingAmount)));
  const paymentRequirementsMet = delivery.deliveryAgencyCanCollectCashOnDelivery
    || (productPaid >= sale.total && deliveryShippingPaid >= delivery.shippingChargedToClient);
  const canSend = delivery.deliveryStatusId === 1 && paymentRequirementsMet;
  const [editing, setEditing] = useState(false);
  const hasPendingSelection = sale.selectionHolds.some((hold) => hold.productHoldStatusId === 1);
  const openHolds = sale.selectionHolds.some((hold) => hold.productHoldStatusId === 1 || hold.productHoldStatusId === 4);
  return <article className="rounded-xl border border-pw-line p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">Envío {delivery.code}</h3><p className="mt-1 text-xs text-pw-muted">Creado {date(delivery.createdAt)}</p></div><span className="rounded-full bg-pw-brand-soft px-2.5 py-1 text-xs font-bold text-pw-brand-deep">{delivery.deliveryStatusName ?? statuses[delivery.deliveryStatusId] ?? "Estado desconocido"}</span></div>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-pw-muted">Agencia</dt><dd className="font-bold">{delivery.deliveryAgencyName ?? "—"}</dd></div><div><dt className="text-xs text-pw-muted">Municipio</dt><dd className="font-bold">{delivery.municipalityName ?? "—"}</dd></div><div><dt className="text-xs text-pw-muted">Dirección</dt><dd className="font-bold">{delivery.deliveryAddress || "Dirección registrada en la clienta"}</dd></div><div><dt className="text-xs text-pw-muted">Costo de envío</dt><dd className="font-bold tabular-nums">{money.format(delivery.shippingChargedToClient)}</dd></div>{delivery.comments ? <div className="sm:col-span-2"><dt className="text-xs text-pw-muted">Comentario</dt><dd className="font-bold">{delivery.comments}</dd></div> : null}</dl>
    <div className="mt-4 flex flex-wrap gap-2">{isAdmin && delivery.deliveryStatusId === 1 ? <button type="button" disabled={busy} onClick={() => setEditing(true)} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold">Editar envío</button> : null}{canSend ? <button type="button" disabled={busy} onClick={() => void onAction(delivery.id, "send")} className="min-h-9 rounded-lg bg-pw-brand px-3 text-xs font-extrabold text-white">Marcar despachada</button> : null}{isAdmin && delivery.deliveryStatusId === 4 ? <><button type="button" disabled={busy} onClick={() => void onAction(delivery.id, hasPendingSelection ? "delivered-pending-selection" : "complete")} className="min-h-9 rounded-lg bg-pw-brand px-3 text-xs font-extrabold text-white">Confirmar entrega</button><button type="button" disabled={busy} onClick={() => void onAction(delivery.id, "fail")} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold">Registrar falla</button></> : null}{isAdmin && delivery.deliveryStatusId === 6 ? <button type="button" disabled={busy || openHolds} title={openHolds ? "Resuelve primero los apartados pendientes." : undefined} onClick={() => void onAction(delivery.id, "complete")} className="min-h-9 rounded-lg bg-pw-brand px-3 text-xs font-extrabold text-white disabled:opacity-50">Finalizar entrega</button> : null}{isAdmin && delivery.deliveryStatusId === 1 ? <button type="button" disabled={busy} onClick={() => void onAction(delivery.id, "cancel")} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold text-red-700">Cancelar envío</button> : null}</div>
    {editing ? <SaleDeliveryEditDialog delivery={delivery} busy={busy} onClose={() => setEditing(false)} onSave={(payload) => onEdit(delivery.id, payload)} /> : null}
    {delivery.deliveryStatusId === 1 && !canSend ? <p className="mt-2 text-xs text-pw-muted">Para despachar con esta agencia, los productos y el costo de envío deben estar pagados.</p> : null}
  </article>;
}
export function SaleDetailLogistics({ sale, isAdmin, busy, municipalities, deliveryAgencies, deliveryCatalogLoading, deliveryCatalogError, onRetryDeliveryCatalogs, onDeliveryAction, onEditDelivery, onCreateDelivery }: {
  sale: SaleDetail;
  isAdmin: boolean;
  busy: boolean;
  municipalities: SaleMunicipality[];
  deliveryAgencies: SaleDeliveryAgency[];
  deliveryCatalogLoading: boolean;
  deliveryCatalogError: string | null;
  onRetryDeliveryCatalogs: () => void;
  onDeliveryAction: (deliveryId: number, action: SaleDeliveryAction) => Promise<boolean>;
  onEditDelivery: (deliveryId: number, payload: PatchSaleDeliveryPayload) => Promise<boolean>;
  onCreateDelivery: (payload: CreateSaleDeliveryPayload) => Promise<boolean>;
}) {
  const local = sale.saleChannelId === 1;
  const [addingDelivery, setAddingDelivery] = useState(false);
  const hasActiveDelivery = sale.deliveries.some((delivery) => [1, 4, 6].includes(delivery.deliveryStatusId));
  const canCreateDelivery = !local && [1, 2, 3].includes(sale.saleStatusId) && !hasActiveDelivery;
  return <>
    <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-delivery-title">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 id="sale-delivery-title" className="text-base font-extrabold">Entrega</h2></div>{canCreateDelivery ? <button type="button" disabled={busy} onClick={() => setAddingDelivery(true)} className="min-h-9 rounded-lg border border-pw-brand px-3 text-xs font-bold text-pw-brand-deep">Crear envío</button> : null}</header>
      {local ? <p className="rounded-xl bg-pw-canvas p-4 text-sm text-pw-muted">Esta venta se retira en la tienda y no requiere envío.</p> : sale.deliveries.length ? <div className="space-y-3">{sale.deliveries.map((delivery) => <DeliveryCard key={delivery.id} sale={sale} delivery={delivery} isAdmin={isAdmin} busy={busy} onAction={onDeliveryAction} onEdit={onEditDelivery} />)}</div> : <p className="rounded-xl border border-dashed border-pw-line py-7 text-center text-sm text-pw-muted">Todavía no se ha creado una entrega.</p>}
    </section>
    {addingDelivery && canCreateDelivery ? <SaleDeliveryCreateDialog municipalities={municipalities} agencies={deliveryAgencies} loading={deliveryCatalogLoading} error={deliveryCatalogError} busy={busy} saleIsPaid={sale.salePaymentStatusId === 3} clientId={sale.clientId} onRetryCatalogs={onRetryDeliveryCatalogs} onClose={() => setAddingDelivery(false)} onSave={onCreateDelivery} /> : null}
  </>;
}

type SelectionHoldDecision = { hold: SaleSelectionHold; decision: "kept" | "not-selected" | "undo" };

function SelectionHoldDecisionDialog({ pending, itemName, itemDetails, busy, onClose, onConfirm }: {
  pending: SelectionHoldDecision;
  itemName: string;
  itemDetails: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    return () => dialog.current?.close();
  }, []);

  const content = {
    kept: {
      title: "Confirmar prenda conservada",
      description: "La prenda se agregará a los productos de la venta y actualizará su total.",
      action: "Sí, la conservó",
    },
    "not-selected": {
      title: "Confirmar prenda no elegida",
      description: "El apartado quedará pendiente de devolución física. Cuando la prenda regrese, podrás confirmar la devolución.",
      action: "Sí, no la eligió",
    },
    undo: {
      title: "Deshacer decisión de selección",
      description: "El apartado volverá a estar pendiente y se actualizarán el inventario y el saldo de la venta. El cambio puede rechazarse si ya no hay existencias o si los pagos superan el nuevo saldo.",
      action: "Deshacer decisión",
    },
  }[pending.decision];

  return createPortal(<dialog ref={dialog} aria-labelledby="sale-hold-decision-title" aria-describedby="sale-hold-decision-description" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50">
    <div className="space-y-4 p-5">
      <header className="flex items-start justify-between gap-3"><div><h2 id="sale-hold-decision-title" className="text-lg font-extrabold">{content.title}</h2><p className="mt-1 text-sm text-pw-muted">Revisa la prenda antes de aplicar el cambio.</p></div><button type="button" aria-label="Cerrar" disabled={busy} onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-xl disabled:opacity-50">×</button></header>
      <div className="rounded-xl bg-pw-canvas p-4"><strong className="block text-sm">{itemName}</strong><span className="mt-1 block text-xs text-pw-muted">{itemDetails}</span></div>
      <p id="sale-hold-decision-description" className="text-sm leading-6 text-pw-muted">{content.description}</p>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold disabled:opacity-50">Cancelar</button><LoadingButton type="button" isLoading={busy} onClick={() => void onConfirm()} className="min-h-10 text-sm">{content.action}</LoadingButton></footer>
    </div>
  </dialog>, document.body);
}

export function SaleDetailSelectionHolds({ sale, products, isAdmin, busy, onAddHold, onResolveHold, onReturnHold, onUndoResolution }: {
  sale: SaleDetail;
  products: ProductDTO[];
  isAdmin: boolean;
  busy: boolean;
  onAddHold: (payload: CreateSaleSelectionProductPayload[]) => Promise<boolean>;
  onResolveHold: (holdId: number, selected: boolean) => Promise<boolean>;
  onReturnHold: (holdId: number) => Promise<boolean>;
  onUndoResolution: (holdId: number) => Promise<boolean>;
}) {
  const [addingHold, setAddingHold] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<SelectionHoldDecision | null>(null);
  const canManageHolds = isAdmin && ![5, 6].includes(sale.saleStatusId) && sale.deliveries.every((delivery) => delivery.deliveryStatusId === 1);
  const canResolveHolds = isAdmin && ![5, 6].includes(sale.saleStatusId);
  const pendingChoice = pendingDecision ? variantName(pendingDecision.hold, products) : null;
  const itemName = pendingChoice ? `${pendingChoice.product.code} · ${pendingChoice.product.subcategoryName || pendingChoice.product.name}` : pendingDecision ? `Producto #${pendingDecision.hold.productId}` : "";
  const itemDetails = pendingDecision ? `${pendingChoice ? `${pendingChoice.presentation.name} · ${pendingChoice.variant.sizeName || "Única"}` : "Variante"} · Cantidad ${pendingDecision.hold.quantity}` : "";
  const confirmDecision = async () => {
    if (!pendingDecision) return false;
    const saved = pendingDecision.decision === "undo"
      ? await onUndoResolution(pendingDecision.hold.id)
      : await onResolveHold(pendingDecision.hold.id, pendingDecision.decision === "kept");
    if (saved) setPendingDecision(null);
    return saved;
  };

  if (!sale.selectionHolds.length && !canManageHolds) return null;
  return <>
    <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-holds-title">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 id="sale-holds-title" className="text-base font-extrabold">Prendas en selección</h2></div>{canManageHolds ? <button type="button" disabled={busy} onClick={() => setAddingHold(true)} className="min-h-9 rounded-lg border border-pw-brand px-3 text-xs font-bold text-pw-brand-deep">Agregar prenda</button> : null}</header>
      <div className="mb-1 hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(8rem,.9fr)_minmax(3rem,.35fr)_minmax(3.5rem,.35fr)_12rem] gap-3 border-b border-pw-line pb-2 text-[10px] font-bold uppercase tracking-wide text-pw-muted xl:grid"><span>Prenda</span><span>Presentación</span><span>Estado</span><span className="text-center">Talla</span><span className="text-center">Cantidad</span><span className="sr-only">Acciones</span></div><ul className="divide-y divide-pw-line">{sale.selectionHolds.map((hold) => {
        const choice = variantName(hold, products);
        const active = hold.productHoldStatusId === 1;
        const awaitingReturn = hold.productHoldStatusId === 4;
        const reversible = [2, 3, 4].includes(hold.productHoldStatusId);
        const canUndo = canResolveHolds && reversible;
        const label = ({ 1: "Por decidir", 2: "Conservada", 3: "No elegida", 4: "Devolución pendiente" }[hold.productHoldStatusId] ?? hold.productHoldStatusName ?? "Estado desconocido");
        return <li key={hold.id} className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(8rem,.9fr)_minmax(3rem,.35fr)_minmax(3.5rem,.35fr)_12rem] xl:items-center">
          <div className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted xl:hidden">Prenda</span><div className="flex min-w-0 items-center gap-2"><SelectionProductThumb choice={choice} /><div className="min-w-0"><strong className="block truncate text-sm">{choice ? choice.product.code + " · " + choice.product.name : "Producto #" + hold.productId}</strong><span className="block truncate text-xs text-pw-muted">{choice?.product.subcategoryName || "Sin subcategoría"}</span></div></div></div>
          <div className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted xl:hidden">Presentación</span><span className="block truncate text-sm">{choice?.presentation.name || "—"}</span></div>
          <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted xl:hidden">Estado</span><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${hold.productHoldStatusId === 1 ? "bg-pw-brand-soft text-pw-brand-deep" : hold.productHoldStatusId === 2 ? "bg-green-50 text-green-800" : hold.productHoldStatusId === 4 ? "bg-amber-50 text-amber-900" : "bg-pw-canvas text-pw-ink"}`}>{label}</span></div>
          <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted xl:hidden">Talla</span><span className="text-sm font-bold xl:block xl:text-center">{choice?.variant.sizeName || "Única"}</span></div>
          <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted xl:hidden">Cantidad</span><span className="text-sm font-bold tabular-nums xl:block xl:text-center">{hold.quantity}</span></div><div className="col-span-2 flex flex-wrap items-center justify-between gap-2 xl:col-span-1 xl:flex-nowrap xl:justify-end">
            <div className="flex flex-wrap gap-2 xl:flex-nowrap">
              {canResolveHolds && active ? <><button type="button" disabled={busy} onClick={() => setPendingDecision({ hold, decision: "kept" })} className="min-h-9 rounded-lg bg-pw-brand px-3 text-xs font-extrabold text-white disabled:opacity-50 xl:whitespace-nowrap">La conservó</button><button type="button" disabled={busy} onClick={() => setPendingDecision({ hold, decision: "not-selected" })} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold disabled:opacity-50 xl:whitespace-nowrap">No la eligió</button></> : null}
              {canResolveHolds && awaitingReturn ? <button type="button" disabled={busy} onClick={() => void onReturnHold(hold.id)} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold disabled:opacity-50 xl:whitespace-nowrap">Confirmar devolución física</button> : null}
              {canUndo ? <button type="button" disabled={busy} onClick={() => setPendingDecision({ hold, decision: "undo" })} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold disabled:opacity-50 xl:whitespace-nowrap">Deshacer decisión</button> : null}
            </div>
          </div>
        </li>;
      })}</ul>
      {!sale.selectionHolds.length ? <p className="rounded-xl border border-dashed border-pw-line py-6 text-center text-sm text-pw-muted">No hay prendas pendientes de selección.</p> : null}
    </section>
    {addingHold ? <AddHoldDialog existingProductIds={sale.selectionHolds.map((hold) => hold.productId)} busy={busy} onClose={() => setAddingHold(false)} onSave={onAddHold} /> : null}
    {pendingDecision ? <SelectionHoldDecisionDialog pending={pendingDecision} itemName={itemName} itemDetails={itemDetails} busy={busy} onClose={() => setPendingDecision(null)} onConfirm={confirmDecision} /> : null}
  </>;
}
