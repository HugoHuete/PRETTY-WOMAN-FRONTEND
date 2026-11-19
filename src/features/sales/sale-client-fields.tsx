import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/auth-provider";
import { createSaleClient, getSaleClient, getSaleClients, updateSaleClient } from "./sales-api";
import type { SaleClient } from "./sales-types";

export function SaleClientFields({ client, onSelect, onBusyChange, onDirtyChange, context = "envío", disabled = false }: { disabled?: boolean; context?: "venta" | "envío"; client: SaleClient | null; onSelect: (client: SaleClient | null) => void; onBusyChange: (busy: boolean) => void; onDirtyChange: (dirty: boolean) => void }) {
  const { request } = useAuth();
  const clientSelection = { client, onSelect };
  const [clientValues, setClientValues] = useState({ name: "", phoneNumber: "", address: "", instagramUser: "", messengerUser: "" });
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [matches, setMatches] = useState<SaleClient[] | null>(null);
  const [matchPage, setMatchPage] = useState(1);
  const [matchPages, setMatchPages] = useState(1);
  const [contactConflict, setContactConflict] = useState(false);
  const [candidate, setCandidate] = useState<SaleClient | null>(null);
  const [updates, setUpdates] = useState<Record<string, boolean>>({});
  const searchClients = async (page: number, createIfNone = false) => {
    if (!clientSelection || creatingClient) return;
    const search = { name: clientValues.name.trim(), phoneNumber: clientValues.phoneNumber.trim(), instagramUser: clientValues.instagramUser.trim(), messengerUser: clientValues.messengerUser.trim() };
    if (!Object.values(search).some(Boolean)) { setClientError("Escribe un nombre, teléfono o usuario para buscar."); return; }
    setCreatingClient(true);
    setClientError(null);
    setCandidate(null);
    try {
      const result = await getSaleClients(request, { ...search, page, pageSize: 8 });
      const contactFields = ["phoneNumber", "instagramUser", "messengerUser"] as const;
      const conflicts = await Promise.all(contactFields.filter((field) => search[field]).map(async (field) => {
        for (let contactPage = 1; ; contactPage++) {
          const contacts = await getSaleClients(request, { name: "", phoneNumber: "", instagramUser: "", messengerUser: "", [field]: search[field], page: contactPage, pageSize: 100 });
          const property = field === "phoneNumber" ? "phone" : field === "instagramUser" ? "instagram" : "messenger";
          if (contacts.items.some((item) => item[property]?.trim().toLowerCase() === search[field].toLowerCase())) return true;
          if (contactPage >= contacts.totalPages) return false;
        }
      }));
      setContactConflict(conflicts.some(Boolean));
      setMatches(result.items);
      setMatchPage(result.page);
      setMatchPages(result.totalPages);
      if (createIfNone && result.totalCount === 0 && !conflicts.some(Boolean)) await createClient();
    } catch (caught) {
      setClientError(caught instanceof Error ? caught.message : "No se pudo buscar a la clienta.");
    } finally { setCreatingClient(false); }
  };

  const createClient = async () => {
    if (!clientSelection || !clientValues.name.trim() || !clientValues.phoneNumber.trim()) return;
    const id = await createSaleClient(request, {
      name: clientValues.name.trim(), phoneNumber: clientValues.phoneNumber.trim(),
      address: clientValues.address.trim() || undefined, instagramUser: clientValues.instagramUser.trim() || undefined,
      messengerUser: clientValues.messengerUser.trim() || undefined,
    });
    let client: SaleClient;
    try { client = await getSaleClient(request, id); }
    catch { client = { id, name: clientValues.name.trim(), phone: clientValues.phoneNumber.trim() }; }
    clientSelection.onSelect(client);
    setClientValues({ name: "", phoneNumber: "", address: "", instagramUser: "", messengerUser: "" });
    setMatches(null);
  };

  const chooseCandidate = async (selected: SaleClient | null = candidate, keepExisting = false) => {
    if (!selected || !clientSelection || creatingClient) return;
    setCreatingClient(true);
    setClientError(null);
    try {
      const current = await getSaleClient(request, selected.id);
      if (current.isBlocked) throw new Error("Esta clienta está bloqueada y no puede usarse en un envío.");
      const selectedUpdates = keepExisting ? {} : updates;
      const next = {
        name: selectedUpdates.name ? clientValues.name.trim() : current.name,
        phoneNumber: selectedUpdates.phoneNumber ? clientValues.phoneNumber.trim() : current.phone ?? "",
        instagramUser: selectedUpdates.instagramUser ? clientValues.instagramUser.trim() : current.instagram ?? "",
        messengerUser: selectedUpdates.messengerUser ? clientValues.messengerUser.trim() : current.messenger ?? "",
        address: selectedUpdates.address ? clientValues.address.trim() : current.address ?? "",
        isFriend: Boolean(current.isFriend), comments: current.comments ?? null,
      };
      if (Object.values(selectedUpdates).some(Boolean)) await updateSaleClient(request, current.id, next);
      clientSelection.onSelect({ ...current, name: next.name, phone: next.phoneNumber, instagram: next.instagramUser, messenger: next.messengerUser, address: next.address });
      setClientValues({ name: "", phoneNumber: "", address: "", instagramUser: "", messengerUser: "" });
      setMatches(null);
      setCandidate(null);
      setUpdates({});
    } catch (caught) { setClientError(caught instanceof Error ? caught.message : "No se pudo seleccionar la clienta."); }
    finally { setCreatingClient(false); }
  };

  const hasUnsavedClient = Boolean(clientSelection && !clientSelection.client && Object.values(clientValues).some((value) => value.trim()));
  useEffect(() => { onBusyChange(creatingClient); }, [creatingClient, onBusyChange]);
  useEffect(() => { onDirtyChange(hasUnsavedClient); }, [hasUnsavedClient, onDirtyChange]);
  return <>
      {clientSelection ? <section aria-labelledby="delivery-client-title" className="space-y-3 rounded-xl border border-pw-line p-3">
        <h3 id="delivery-client-title" className="text-sm font-extrabold">Clienta <span className="font-medium text-pw-muted">(opcional)</span></h3>
        {clientSelection.client ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-pw-brand-soft p-3"><strong>{clientSelection.client.name}</strong><button type="button" disabled={disabled} onClick={() => clientSelection.onSelect(null)} className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-bold">Cambiar clienta</button></div> : null}
        {!clientSelection.client ? <><div className="grid gap-3 sm:grid-cols-2">
          {([ ["name", "Nombre"], ["phoneNumber", "Teléfono"], ["instagramUser", "Usuario de Instagram"], ["messengerUser", "Usuario de Messenger"], ["address", "Dirección"] ] as const).map(([key, label]) => <label key={key} htmlFor={`delivery-client-${key}`} className={"grid gap-1 text-xs font-bold text-pw-muted " + (key === "address" ? "sm:col-span-2" : "")}>{label}{key === "name" || key === "phoneNumber" ? " *" : " (opcional)"}{key === "address" ? <textarea id={`delivery-client-${key}`} rows={2} disabled={creatingClient} value={clientValues[key]} onChange={(event) => (setMatches(null), setCandidate(null), setUpdates({}), setClientValues((current) => ({ ...current, [key]: event.target.value })))} className="rounded-lg border border-pw-line px-3 py-2 text-sm text-pw-ink" /> : <input id={`delivery-client-${key}`} disabled={creatingClient} value={clientValues[key]} onChange={(event) => (setMatches(null), setCandidate(null), setUpdates({}), setClientValues((current) => ({ ...current, [key]: event.target.value })))} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm text-pw-ink" />}</label>)}
        </div>{hasUnsavedClient ? <p className="text-xs text-pw-muted">Crea la clienta o borra sus datos antes de guardar {context === "venta" ? "la venta" : "el envío"}.</p> : null}{clientError ? <p role="alert" className="text-sm text-red-800">{clientError}</p> : null}<div className="flex flex-wrap items-center gap-2"><button type="button" disabled={creatingClient || !clientValues.name.trim() || !clientValues.phoneNumber.trim()} onClick={() => void searchClients(1, true)} className="min-h-11 rounded-lg border border-pw-brand px-4 text-sm font-bold text-pw-brand-deep disabled:opacity-50">{creatingClient ? "Creando clienta…" : "Crear clienta"}</button><button type="button" disabled={creatingClient} onClick={() => void searchClients(1)} className="min-h-11 rounded-lg border border-pw-brand px-4 text-sm font-bold text-pw-brand-deep disabled:opacity-50">Buscar clienta</button></div></> : null}
      </section> : null}
    {matches ? <ClientMatchesDialog matches={matches} page={matchPage} pages={matchPages} candidate={candidate} updates={updates} values={clientValues} busy={creatingClient} error={clientError} contactConflict={contactConflict} onClose={() => { setMatches(null); setCandidate(null); }} onPage={(page) => void searchClients(page)} onChoose={(match) => { setUpdates({}); const differences = ([ ["name", match.name], ["phoneNumber", match.phone], ["instagramUser", match.instagram], ["messengerUser", match.messenger], ["address", match.address] ] as const).some(([key, current]) => clientValues[key].trim() && clientValues[key].trim() !== (current ?? "").trim()); if (differences) setCandidate(match); else void chooseCandidate(match, true); }} onUpdate={(key, checked) => setUpdates((old) => ({ ...old, [key]: checked }))} onConfirm={() => void chooseCandidate()} onCreate={async () => { setCreatingClient(true); setClientError(null); try { await createClient(); } catch (caught) { setClientError(caught instanceof Error ? caught.message : "No se pudo crear la clienta."); } finally { setCreatingClient(false); } }} /> : null}
  </>;
}

type ClientValues = { name: string; phoneNumber: string; instagramUser: string; messengerUser: string; address: string };
function ClientMatchesDialog({ matches, page, pages, candidate, updates, values, busy, error, contactConflict, onClose, onPage, onChoose, onUpdate, onConfirm, onCreate }: {
  matches: SaleClient[]; page: number; pages: number; candidate: SaleClient | null; updates: Record<string, boolean>; values: ClientValues; busy: boolean; error: string | null; contactConflict: boolean;
  onClose: () => void; onPage: (page: number) => void; onChoose: (client: SaleClient) => void; onUpdate: (key: string, checked: boolean) => void; onConfirm: () => void; onCreate: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialogRef.current; element?.showModal(); return () => element?.close(); }, []);
  return createPortal(<dialog ref={dialogRef} aria-labelledby="client-matches-title" onCancel={(event) => { event.stopPropagation(); event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-pw-line bg-white p-5 text-pw-ink shadow-2xl backdrop:bg-black/50">
    <header className="flex items-center justify-between gap-3"><h2 id="client-matches-title" className="text-lg font-extrabold">Coincidencias de clientas</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar coincidencias" className="min-h-10 rounded-lg border border-pw-line px-3">×</button></header>
    <div className="mt-4 space-y-3">{error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {!matches.length ? <p className="text-sm text-pw-muted">No se encontraron coincidencias.</p> : matches.map((match) => (
        <article key={match.id} className={"rounded-xl border p-4 " + (match.isBlocked ? "border-red-300 bg-red-50" : "border-pw-line bg-white")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 break-words text-base font-extrabold text-pw-ink">{match.name}</h3>
            <div className="flex shrink-0 flex-wrap items-center gap-2">{match.isBlocked ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">Bloqueada</span> : null}<button type="button" disabled={busy || match.isBlocked} onClick={() => onChoose(match)} className="min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:cursor-not-allowed disabled:opacity-50">Seleccionar</button></div>
          </div>
          <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-3">
            {([ ["Teléfono", match.phone], ["Instagram", match.instagram], ["Messenger", match.messenger], ["Dirección", match.address] ] as const).map(([label, value]) => <div key={label} className={"min-w-0 " + (label === "Dirección" ? "sm:col-span-3" : "")}><dt className="text-xs font-bold text-pw-muted">{label}</dt><dd className={"mt-1 break-words " + (value ? "font-semibold text-pw-ink" : "text-pw-muted")}>{value || "Sin registrar"}</dd></div>)}
            {match.isBlocked && match.blockedReason ? <div className="sm:col-span-3"><dt className="text-xs font-bold text-red-800">Motivo de bloqueo</dt><dd className="mt-1 break-words text-red-800">{match.blockedReason}</dd></div> : null}
          </dl>
        </article>
      ))}
      {pages > 1 ? <div className="flex items-center justify-between text-sm"><button type="button" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page >= pages || busy} onClick={() => onPage(page + 1)}>Siguiente</button></div> : null}
      {candidate ? <div className="space-y-2 rounded-lg border border-pw-line p-3"><p className="font-bold">Comparar datos de {candidate.name}</p>{([ ["name", "Nombre", candidate.name], ["phoneNumber", "Teléfono", candidate.phone], ["instagramUser", "Instagram", candidate.instagram], ["messengerUser", "Messenger", candidate.messenger], ["address", "Dirección", candidate.address] ] as const).filter(([key, , current]) => values[key].trim() && values[key].trim() !== (current ?? "").trim()).map(([key, label, current]) => <label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(updates[key])} onChange={(event) => onUpdate(key, event.target.checked)} /><span><strong>{label}</strong>: {current || "Sin dato"} → {values[key].trim()}<span className="block text-pw-muted">Marcar para actualizar</span></span></label>)}<button type="button" disabled={busy} onClick={onConfirm} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-bold text-white disabled:opacity-50">Usar esta clienta</button></div> : null}
      {contactConflict ? <p className="text-sm text-pw-muted">Ya existe una clienta con el teléfono o usuario indicado. Selecciónala o cambia ese dato.</p> : <button type="button" disabled={busy || !values.name.trim() || !values.phoneNumber.trim()} onClick={onCreate} className="min-h-11 rounded-lg border border-pw-brand px-4 text-sm font-bold text-pw-brand-deep disabled:opacity-50">Crear clienta nueva</button>}
    </div>
  </dialog>, document.body);
}
