import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { LoadingButton } from "../../shared/ui/loading-button";
import { SelectControl } from "../../shared/ui/select-control";
import { saleChannels, saleStatuses, paymentStatuses, saleCatalogLabel, type PatchSaleHeaderPayload, type SaleDetail } from "./sales-types";

function dateValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function SaleDetailOverview({ sale, isAdmin, busy, onSave, onCancelSale, cancelError }: {
  sale: SaleDetail;
  isAdmin: boolean;
  busy: boolean;
  onSave: (payload: PatchSaleHeaderPayload) => Promise<boolean>;
  onCancelSale: () => Promise<boolean>;
  cancelError: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saleDate, setSaleDate] = useState(dateValue(sale.saleDate));
  const [channelId, setChannelId] = useState(String(sale.saleChannelId));
  const [comments, setComments] = useState(sale.comments ?? "");
  const cancelled = sale.saleStatusId === 6;
  const canEdit = isAdmin && !cancelled;
  const blockedByDelivery = sale.deliveries.some((delivery) => [4, 6].includes(delivery.deliveryStatusId));
  const canCancelSale = isAdmin && ![5, 6].includes(sale.saleStatusId) && !blockedByDelivery;

  useEffect(() => {
    setSaleDate(dateValue(sale.saleDate));
    setChannelId(String(sale.saleChannelId));
    setComments(sale.comments ?? "");
  }, [sale.comments, sale.saleChannelId, sale.saleDate]);

  useEffect(() => {
    if (!confirmingCancel) return undefined;
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    return () => dialogRef.current?.close();
  }, [confirmingCancel]);

  const confirmCancel = async () => {
    if (await onCancelSale()) setConfirmingCancel(false);
  };
  const formattedDate = useMemo(() => new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(sale.saleDate)), [sale.saleDate]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dateChanged = saleDate !== dateValue(sale.saleDate);
    const updatedDate = new Date(sale.saleDate);
    if (dateChanged) {
      const [year, month, day] = saleDate.split("-").map(Number);
      updatedDate.setFullYear(year, month - 1, day);
    }
    const saved = await onSave({ ...(dateChanged ? { saleDate: updatedDate.toISOString() } : {}), saleChannelId: Number(channelId), comments: comments.trim() || null });
    if (saved) setEditing(false);
  };

  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-overview-title">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="sale-overview-title" className="text-base font-extrabold text-pw-ink">Información general</h2>
      </div>
      {!editing ? <div className="flex flex-wrap gap-2">{canCancelSale ? <button type="button" disabled={busy} onClick={() => setConfirmingCancel(true)} className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700 disabled:opacity-50">Cancelar venta</button> : null}{canEdit ? <button type="button" onClick={() => setEditing(true)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold text-pw-ink hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-pw-brand">Editar información</button> : null}</div> : null}
      {!canEdit ? <span className="rounded-full bg-pw-canvas px-3 py-1.5 text-xs font-bold text-pw-muted">{cancelled ? "Venta cancelada" : "Solo lectura"}</span> : null}
    </header>
    {editing ? <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label htmlFor="sale-detail-date" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">Fecha de venta<input id="sale-detail-date" type="date" required value={saleDate} onChange={(event) => setSaleDate(event.target.value)} className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand" /></label>
      <label htmlFor="sale-detail-channel" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">Canal de venta<SelectControl aria-label="Canal de venta" id="sale-detail-channel" value={channelId} options={saleChannels.map((channel) => ({ value: String(channel.id), label: channel.name }))} onChange={(event) => setChannelId(event.target.value)} /></label>
      <label htmlFor="sale-detail-comments" className="grid gap-1.5 text-xs font-extrabold text-pw-muted sm:col-span-2">Observaciones<textarea id="sale-detail-comments" rows={3} maxLength={500} value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Agrega una nota sobre esta venta" className="rounded-lg border border-pw-line bg-white px-3 py-2.5 text-sm font-normal text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand" /></label>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button type="button" disabled={busy} onClick={() => setEditing(false)} className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold">Cancelar</button><button type="submit" disabled={busy || !saleDate} className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white disabled:opacity-60">{busy ? "Guardando…" : "Guardar cambios"}</button></div>
    </form> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div><p className="text-xs font-bold text-pw-muted">Fecha de venta</p><p className="mt-1 font-bold text-pw-ink">{formattedDate}</p></div>
      <div><p className="text-xs font-bold text-pw-muted">Canal</p><p className="mt-1 font-bold text-pw-ink">{saleCatalogLabel(sale.saleChannelId, saleChannels, sale.saleChannelName)}</p></div>
      <div><p className="text-xs font-bold text-pw-muted">Estado de venta</p><p className="mt-1 font-bold text-pw-ink">{saleCatalogLabel(sale.saleStatusId, saleStatuses, sale.saleStatusName)}</p></div>
      <div><p className="text-xs font-bold text-pw-muted">Estado de pago</p><p className="mt-1 font-bold text-pw-ink">{saleCatalogLabel(sale.salePaymentStatusId, paymentStatuses, sale.salePaymentStatusName)}</p></div>
      {sale.comments ? <div className="border-t border-pw-line pt-3 sm:col-span-3"><p className="text-xs font-bold text-pw-muted">Observaciones</p><p className="mt-1 whitespace-pre-wrap text-sm text-pw-ink">{sale.comments}</p></div> : null}
    </div>}
    {confirmingCancel ? createPortal(<dialog ref={dialogRef} aria-labelledby="sale-cancel-title" aria-describedby="sale-cancel-description" onCancel={(event) => { event.preventDefault(); if (!busy) setConfirmingCancel(false); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50"><div className="space-y-4 p-5"><header className="flex items-start justify-between gap-3"><div><h2 id="sale-cancel-title" className="text-lg font-extrabold">¿Cancelar la venta #{sale.id}?</h2><p className="mt-1 text-sm text-pw-muted">Esta acción no se puede deshacer.</p></div><button type="button" aria-label="Cerrar" disabled={busy} onClick={() => setConfirmingCancel(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-xl disabled:opacity-50">×</button></header><p id="sale-cancel-description" className="text-sm leading-6 text-pw-muted">Se cancelarán los envíos pendientes y se liberarán las prendas del inventario. Primero debes reembolsar cualquier pago registrado. No se pueden cancelar ventas completadas ni envíos que ya fueron despachados.</p>{cancelError ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{cancelError}</p> : null}<footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={() => setConfirmingCancel(false)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold disabled:opacity-50">Volver</button><LoadingButton type="button" isLoading={busy} onClick={() => void confirmCancel()} className="min-h-10 bg-red-700 text-sm hover:bg-red-800">Cancelar venta</LoadingButton></footer></div></dialog>, document.body) : null}
  </section>;
}
