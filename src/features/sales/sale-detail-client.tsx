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
  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-client-title">
    <header className="mb-4"><h2 id="sale-client-title" className="text-base font-extrabold text-pw-ink">Clienta</h2></header>
    {isAdmin ? <div className={busy ? "pointer-events-none opacity-60" : ""}><SaleClientPicker selectedClient={client} onSelect={(selected) => void onSave(selected)} onCreateClient={() => setCreating(true)} /></div> : client ? <div className="grid gap-3 sm:grid-cols-2">
      <div><p className="text-xs font-bold text-pw-muted">Nombre</p><p className="mt-1 font-bold text-pw-ink">{client.name}</p></div>
      <div><p className="text-xs font-bold text-pw-muted">Teléfono</p><p className="mt-1 font-bold text-pw-ink">{client.phone || "Sin teléfono"}</p></div>
      {client.instagram ? <div><p className="text-xs font-bold text-pw-muted">Instagram</p><p className="mt-1 text-sm text-pw-ink">{client.instagram}</p></div> : null}
      {client.messenger ? <div><p className="text-xs font-bold text-pw-muted">Messenger</p><p className="mt-1 text-sm text-pw-ink">{client.messenger}</p></div> : null}
    </div> : <p className="text-sm text-pw-muted">Esta venta no tiene clienta asociada.</p>}
    {!client && !isAdmin ? <p className="mt-2 text-xs text-pw-muted">Una venta sin clienta no puede tener envío.</p> : null}
    {sale.clientName && !client ? <p className="text-sm font-bold text-pw-ink">{sale.clientName}</p> : null}
    <SaleClientCreateDialog open={creating} onClose={() => setCreating(false)} onCreated={(created) => { setCreating(false); void onCreateClient(created); }} />
  </section>;
}
