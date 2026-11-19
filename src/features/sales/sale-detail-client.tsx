import { SaleClientFields } from "./sale-client-fields";
import { createPortal } from "react-dom";
import type { SaleClient, SaleDetail } from "./sales-types";
import { useEffect, useRef, useState } from "react";

export function SaleDetailClient({ sale, client, isAdmin, busy, onSave }: {
  sale: SaleDetail;
  client: SaleClient | null;
  isAdmin: boolean;
  busy: boolean;
  onSave: (client: SaleClient | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SaleClient | null>(null);
  const [clientBusy, setClientBusy] = useState(false);
  const [, setClientDirty] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const associationInProgress = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialogRef.current; if (open) element?.showModal(); return () => element?.close(); }, [open]);
  const chooseClient = async (selected: SaleClient | null) => {
    if (associationInProgress.current) return;
    setDraft(selected);
    if (!selected) return;
    associationInProgress.current = true;
    setSavingClient(true);
    setSaveError(false);
    try {
      if (await onSave(selected)) setOpen(false);
      else setSaveError(true);
    } catch { setSaveError(true); }
    finally {
      associationInProgress.current = false;
      setSavingClient(false);
    }
  };
  const instagram = client?.instagram?.trim();
  const messenger = client?.messenger?.trim();
  const comments = client?.comments?.trim();
  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-client-title">
    <header className="mb-4"><h2 id="sale-client-title" className="text-base font-extrabold text-pw-ink">Clienta</h2></header>
    {client ? <dl className="grid gap-x-4 gap-y-3 rounded-xl bg-pw-canvas p-3 text-sm md:grid-cols-2 xl:grid-cols-1">
      <div><dt className="text-xs font-bold text-pw-muted">Nombre</dt><dd className="mt-1 break-words font-bold text-pw-ink">{client.name}</dd></div>
      <div><dt className="text-xs font-bold text-pw-muted">Teléfono</dt><dd className="mt-1 break-words font-bold text-pw-ink">{client.phone || "Sin registrar"}</dd></div>
      {instagram ? <div><dt className="text-xs font-bold text-pw-muted">Instagram</dt><dd className="mt-1 break-words text-pw-ink">{instagram}</dd></div> : null}
      {messenger ? <div><dt className="text-xs font-bold text-pw-muted">Messenger</dt><dd className="mt-1 break-words text-pw-ink">{messenger}</dd></div> : null}
      <div className="md:col-span-2 xl:col-span-1"><dt className="text-xs font-bold text-pw-muted">Dirección</dt><dd className="mt-1 break-words text-pw-ink">{client.address || "Sin registrar"}</dd></div>
      {client.blockedReason ? <div className="md:col-span-2 xl:col-span-1"><dt className="text-xs font-bold text-pw-muted">Motivo de bloqueo</dt><dd className="mt-1 break-words text-pw-ink">{client.blockedReason}</dd></div> : null}
      {comments ? <div className="md:col-span-2 xl:col-span-1"><dt className="text-xs font-bold text-pw-muted">Comentarios</dt><dd className="mt-1 whitespace-pre-wrap break-words text-pw-ink">{comments}</dd></div> : null}
    </dl> : <p className="text-sm text-pw-muted">Esta venta no tiene clienta asociada.</p>}
    {isAdmin ? <div className="mt-4 flex flex-wrap gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={() => { setDraft(null); setSaveError(false); setOpen(true); }} className="min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep disabled:opacity-50">{client ? "Cambiar" : "Buscar o crear clienta"}</button>{client ? <button type="button" disabled={busy} onClick={() => void onSave(null)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold disabled:opacity-50">Quitar</button> : null}</div> : null}
    {!client && !isAdmin ? <p className="mt-2 text-xs text-pw-muted">Una venta sin clienta no puede tener envío.</p> : null}
    {sale.clientName && !client ? <p className="text-sm font-bold text-pw-ink">{sale.clientName}</p> : null}
    {open ? createPortal(<dialog ref={dialogRef} aria-labelledby="detail-client-dialog-title" onCancel={(event) => { event.preventDefault(); if (!clientBusy && !savingClient) setOpen(false); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-pw-line bg-white p-5 text-pw-ink shadow-2xl backdrop:bg-black/50">
      <header className="mb-4 flex items-start justify-between gap-3"><h2 id="detail-client-dialog-title" className="text-lg font-extrabold">Buscar o crear clienta</h2><button type="button" aria-label="Cerrar clienta" disabled={clientBusy || savingClient} onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
      <SaleClientFields context="venta" client={draft} disabled={savingClient} onSelect={(selected) => void chooseClient(selected)} onBusyChange={setClientBusy} onDirtyChange={setClientDirty} />
      {saveError ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">No se pudo asociar la clienta. Inténtalo de nuevo.</p> : null}
      {saveError && draft ? <button type="button" disabled={clientBusy || savingClient} onClick={() => void chooseClient(draft)} className="mt-3 min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep">Reintentar asociación</button> : null}
      <footer className="mt-4 flex justify-end border-t border-pw-line pt-4"><button type="button" disabled={clientBusy || savingClient} onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button></footer>
    </dialog>, document.body) : null}
  </section>;
}
