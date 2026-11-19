import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "../../shared/ui/status-badge";
import { blockSaleClient, getSaleClient, type AuthRequest } from "../sales/sales-api";
import type { SaleClient } from "../sales/sales-types";

export function ShipmentClientDialog({ clientId, isAdmin, request, onClose }: {
  clientId: number;
  isAdmin: boolean;
  request: AuthRequest;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const blocking = useRef(false);
  const [client, setClient] = useState<SaleClient | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockError, setBlockError] = useState("");

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    let active = true;
    void getSaleClient(request, clientId).then(
      (data) => { if (active) setClient(data); },
      () => { if (active) setLoadError(true); },
    );
    return () => { active = false; };
  }, [clientId, request, retry]);

  const block = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const blockedReason = reason.trim();
    if (!isAdmin || !client || client.isBlocked || !blockedReason || blocking.current) return;
    blocking.current = true;
    setBusy(true);
    setBlockError("");
    try {
      await blockSaleClient(request, client.id, blockedReason);
      setClient({ ...client, isBlocked: true, blockedReason });
      setConfirming(false);
    } catch (error) {
      setBlockError(error instanceof Error ? error.message : "No se pudo bloquear a la clienta.");
    } finally {
      blocking.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <dialog ref={dialog} aria-labelledby="shipment-client-title" onCancel={(event) => {
      event.preventDefault();
      if (!blocking.current) onClose();
    }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-pw-line bg-white p-5 text-pw-ink shadow-2xl backdrop:bg-black/50 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <h2 id="shipment-client-title" className="min-w-0 break-words text-lg font-extrabold">{client?.name ?? "Detalle de la clienta"}</h2>
        <button type="button" aria-label="Cerrar ficha" disabled={busy} onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button>
      </header>
      {loadError ? <div className="mt-4 space-y-2"><p role="alert" className="text-sm text-red-800">No se pudo cargar la ficha de la clienta.</p><button type="button" className="min-h-10 font-bold text-pw-brand-deep underline" onClick={() => { setLoadError(false); setRetry((value) => value + 1); }}>Reintentar</button></div> : null}
      {!client && !loadError ? <p className="mt-4 text-sm text-pw-muted" role="status">Cargando ficha…</p> : null}
      {client ? <>
        <div className="mt-2"><StatusBadge tone={client.isBlocked ? "danger" : "success"}>{client.isBlocked ? "Bloqueada" : "Activa"}</StatusBadge></div>
        <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
          {[
            ["Teléfono", client.phone], ["Instagram", client.instagram], ["Messenger", client.messenger],
            ["Dirección", client.address], ...(client.comments ? [["Comentarios", client.comments]] : []),
            ...(client.isBlocked && client.blockedReason ? [["Motivo del bloqueo", client.blockedReason]] : []),
          ].map(([label, value], index) => (
            <div key={label} className={index >= 3 ? "min-w-0 sm:col-span-2" : "min-w-0"}>
              <dt className="text-xs font-bold text-pw-muted">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{value?.trim() || "Sin registrar"}</dd>
            </div>
          ))}
        </dl>
        {isAdmin && !client.isBlocked ? <div className="mt-5 border-t border-pw-line pt-4">
          {confirming ? (
            <form onSubmit={block} className="space-y-3">
              <label className="grid gap-1.5 text-sm font-bold">
                Motivo del bloqueo
                <textarea required disabled={busy} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-lg border border-pw-line bg-white px-3 py-2 font-normal focus-visible:outline-2 focus-visible:outline-pw-brand" />
              </label>
              {blockError ? <p role="alert" className="text-sm text-red-800">{blockError}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => { setConfirming(false); setReason(""); setBlockError(""); }} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button>
                <button type="submit" disabled={busy || !reason.trim()} className="min-h-10 rounded-lg bg-red-700 px-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Bloqueando…" : "Confirmar bloqueo"}</button>
              </div>
            </form>
          ) : <button type="button" onClick={() => setConfirming(true)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold text-red-800 hover:bg-red-50">Bloquear clienta</button>}
        </div> : null}
      </> : null}
    </dialog>,
    document.body,
  );
}
