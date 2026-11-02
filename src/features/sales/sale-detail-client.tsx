import { SaleClientCreateDialog } from "./sale-client-create-dialog";
import { SaleClientPicker } from "./sale-client-picker";
import type { SaleClient, SaleDetail } from "./sales-types";
import { useState } from "react";

export function SaleDetailClient({ sale, client, isAdmin, busy, onSave, onCreateClient }: {
  sale: SaleDetail;
  client: SaleClient | null;
  isAdmin: boolean;
  busy: boolean;
  onSave: (client: SaleClient | null) => Promise<void>;
  onCreateClient: (client: SaleClient) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
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
    {isAdmin ? <div className={(client ? "mt-4 border-t border-pw-line pt-4 " : "") + (busy ? "pointer-events-none opacity-60" : "")}><SaleClientPicker selectedClient={client} showSelectedClientSummary={false} onSelect={(selected) => void onSave(selected)} onCreateClient={() => setCreating(true)} /></div> : null}
    {!client && !isAdmin ? <p className="mt-2 text-xs text-pw-muted">Una venta sin clienta no puede tener envío.</p> : null}
    {sale.clientName && !client ? <p className="text-sm font-bold text-pw-ink">{sale.clientName}</p> : null}
    <SaleClientCreateDialog open={creating} onClose={() => setCreating(false)} onCreated={(created) => { setCreating(false); void onCreateClient(created); }} />
  </section>;
}
