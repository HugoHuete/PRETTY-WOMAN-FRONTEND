import { SaleClientEditButton } from "./sale-client-edit-button";
import { SaleCardAction } from "./sale-card-action";
import { SaleClientFields } from "./sale-client-fields";
import { createPortal } from "react-dom";
import type { SaleClient, SaleDetail } from "./sales-types";
import { useEffect, useRef, useState } from "react";

export function SaleDetailClient({ sale, client, isAdmin, busy, onSave, onClientUpdated }: {
  sale: SaleDetail;
  client: SaleClient | null;
  isAdmin: boolean;
  busy: boolean;
  onSave: (client: SaleClient | null) => Promise<boolean>;
  onClientUpdated: (client: SaleClient) => void;
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
  const openClientDialog = () => {
    setDraft(null);
    setSaveError(false);
    setOpen(true);
  };
  const instagram = client?.instagram?.trim();
  const messenger = client?.messenger?.trim();
  const comments = client?.comments?.trim();
  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-client-title">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="sale-client-title" className="text-base font-extrabold text-pw-ink">Clienta</h2>
      {client && (client.id === sale.clientId || isAdmin) ? (
        <div className="flex gap-1.5" role="group" aria-label="Acciones de clienta">
          {client.id === sale.clientId ? <SaleClientEditButton key={client.id} client={client} disabled={busy} onUpdated={onClientUpdated} iconOnly /> : null}
          {isAdmin ? (
            <>
              <SaleCardAction action="change" label="Cambiar clienta" disabled={busy} onClick={openClientDialog} />
              <SaleCardAction action="remove" label="Quitar clienta" disabled={busy} onClick={() => void onSave(null)} />
            </>
          ) : null}
        </div>
      ) : null}
    </header>
    {client ? (
      <div className="mt-3 space-y-1 rounded-lg bg-pw-canvas p-3 text-sm wrap-anywhere">
        <p className="font-bold text-pw-ink">{client.name}</p>
        <p className="text-pw-muted">{client.phone || "Sin teléfono"}</p>
        {client.address?.trim() ? <p className="whitespace-pre-wrap text-pw-muted">{client.address}</p> : null}
        {instagram || messenger || client.blockedReason || comments ? (
          <dl className="mt-2 grid gap-2 border-t border-pw-line pt-2">
            {instagram ? <div><dt className="text-xs font-bold text-pw-muted">Instagram</dt><dd>{instagram}</dd></div> : null}
            {messenger ? <div><dt className="text-xs font-bold text-pw-muted">Messenger</dt><dd>{messenger}</dd></div> : null}
            {client.blockedReason ? <div><dt className="text-xs font-bold text-pw-muted">Motivo de bloqueo</dt><dd>{client.blockedReason}</dd></div> : null}
            {comments ? <div><dt className="text-xs font-bold text-pw-muted">Comentarios</dt><dd className="whitespace-pre-wrap">{comments}</dd></div> : null}
          </dl>
        ) : null}
      </div>
    ) : (
      <>
        <p className="mt-3 text-sm text-pw-muted">Esta venta no tiene clienta asociada.</p>
        {isAdmin ? <button type="button" disabled={busy} onClick={openClientDialog} className="mt-3 min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep disabled:opacity-50">Buscar o crear clienta</button> : null}
      </>
    )}
    {!client && !isAdmin ? <p className="mt-2 text-xs text-pw-muted">Una venta sin clienta no puede tener envío.</p> : null}
    {sale.clientName && !client ? <p className="text-sm font-bold text-pw-ink">{sale.clientName}</p> : null}
    {open ? createPortal(<dialog ref={dialogRef} aria-labelledby="detail-client-dialog-title" onCancel={(event) => { event.preventDefault(); if (!clientBusy && !savingClient) setOpen(false); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-pw-line bg-white p-5 text-pw-ink shadow-2xl backdrop:bg-black/50">
      <header className="mb-4 flex items-start justify-between gap-3"><h2 id="detail-client-dialog-title" className="text-lg font-extrabold">Buscar o crear clienta</h2><button type="button" aria-label="Cerrar clienta" disabled={clientBusy || savingClient} onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
      <SaleClientFields context="venta" client={draft} disabled={savingClient} onSelect={(selected) => void chooseClient(selected)} onProfileUpdated={setDraft} onBusyChange={setClientBusy} onDirtyChange={setClientDirty} />
      {saveError ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">No se pudo asociar la clienta. Inténtalo de nuevo.</p> : null}
      {saveError && draft ? <button type="button" disabled={clientBusy || savingClient} onClick={() => void chooseClient(draft)} className="mt-3 min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep">Reintentar asociación</button> : null}
      <footer className="mt-4 flex justify-end border-t border-pw-line pt-4"><button type="button" disabled={clientBusy || savingClient} onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button></footer>
    </dialog>, document.body) : null}
  </section>;
}
