import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { SelectControl } from "../../shared/ui/select-control";
import { LoadingButton } from "../../shared/ui/loading-button";
import { useAuth } from "../auth/auth-provider";
import { createSaleClient, getSaleClient, getSaleClients, updateSaleClient } from "./sales-api";
import type { CreateSaleDeliveryPayload, SaleClient, SaleDeliveryAgency, SaleMunicipality } from "./sales-types";

export function SaleDeliveryCreateDialog({
  municipalities,
  agencies,
  loading,
  error,
  busy,
  clientId,
  clientSelection,
  initialDelivery,
  onRetryCatalogs,
  onClose,
  onSave,
}: {
  municipalities: SaleMunicipality[];
  agencies: SaleDeliveryAgency[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  clientId: number | null;
  clientSelection?: { client: SaleClient | null; onSelect: (client: SaleClient | null) => void };
  initialDelivery?: CreateSaleDeliveryPayload;
  onRetryCatalogs: () => void;
  onClose: () => void;
  onSave: (payload: CreateSaleDeliveryPayload) => Promise<boolean>;
}) {
  const { request } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const defaultMunicipalitySelected = useRef(Boolean(initialDelivery?.municipalityId));
  const [clientValues, setClientValues] = useState({ name: "", phoneNumber: "", address: "", instagramUser: "", messengerUser: "" });
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [matches, setMatches] = useState<SaleClient[] | null>(null);
  const [matchPage, setMatchPage] = useState(1);
  const [matchPages, setMatchPages] = useState(1);
  const [contactConflict, setContactConflict] = useState(false);
  const [candidate, setCandidate] = useState<SaleClient | null>(null);
  const [updates, setUpdates] = useState<Record<string, boolean>>({});
  const [code, setCode] = useState(initialDelivery?.code ?? "");
  const [agencyId, setAgencyId] = useState(initialDelivery ? String(initialDelivery.deliveryAgencyId) : "");
  const [municipalityId, setMunicipalityId] = useState(initialDelivery ? String(initialDelivery.municipalityId) : "");
  const [shippingAmount, setShippingAmount] = useState(initialDelivery ? String(initialDelivery.shippingChargedToClient) : "0");
  const [address, setAddress] = useState(initialDelivery?.deliveryAddress ?? "");
  const [comments, setComments] = useState(initialDelivery?.comments ?? "");
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => {
    if (defaultMunicipalitySelected.current || municipalities.length === 0) return;
    const managua = municipalities.find((municipality) =>
      municipality.name.trim().toLocaleLowerCase("es-NI") === "managua"
      && municipality.departmentName.trim().toLocaleLowerCase("es-NI") === "managua",
    );
    if (managua) setMunicipalityId(String(managua.id));
    defaultMunicipalitySelected.current = true;
  }, [municipalities]);

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

  const chooseCandidate = async () => {
    if (!candidate || !clientSelection || creatingClient) return;
    setCreatingClient(true);
    setClientError(null);
    try {
      const current = await getSaleClient(request, candidate.id);
      if (current.isBlocked) throw new Error("Esta clienta está bloqueada y no puede usarse en un envío.");
      const next = {
        name: updates.name ? clientValues.name.trim() : current.name,
        phoneNumber: updates.phoneNumber ? clientValues.phoneNumber.trim() : current.phone ?? "",
        instagramUser: updates.instagramUser ? clientValues.instagramUser.trim() : current.instagram ?? "",
        messengerUser: updates.messengerUser ? clientValues.messengerUser.trim() : current.messenger ?? "",
        address: updates.address ? clientValues.address.trim() : current.address ?? "",
        isFriend: Boolean(current.isFriend), comments: current.comments ?? null,
      };
      if (Object.values(updates).some(Boolean)) await updateSaleClient(request, current.id, next);
      clientSelection.onSelect({ ...current, name: next.name, phone: next.phoneNumber, instagram: next.instagramUser, messenger: next.messengerUser, address: next.address });
      setClientValues({ name: "", phoneNumber: "", address: "", instagramUser: "", messengerUser: "" });
      setMatches(null);
      setCandidate(null);
      setUpdates({});
    } catch (caught) { setClientError(caught instanceof Error ? caught.message : "No se pudo seleccionar la clienta."); }
    finally { setCreatingClient(false); }
  };

  const hasUnsavedClient = Boolean(clientSelection && !clientSelection.client && Object.values(clientValues).some((value) => value.trim()));
  const canSubmit = !hasUnsavedClient && !loading && !error && agencies.length > 0 && municipalities.length > 0 && Number(agencyId) > 0 && Number(municipalityId) > 0 && code.trim().length > 0 && Number(shippingAmount) >= 0;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canSubmit || creatingClient) return;
    const payload: CreateSaleDeliveryPayload = {
      code: code.trim(),
      deliveryAgencyId: Number(agencyId),
      municipalityId: Number(municipalityId),
      shippingChargedToClient: Number(shippingAmount),
      ...(clientId ? { clientId } : {}),
      ...(address.trim() ? { deliveryAddress: address.trim() } : {}),
      ...(comments.trim() ? { comments: comments.trim() } : {}),
    };
    if (await onSave(payload)) onClose();
  };

  return createPortal(<dialog ref={dialog} aria-labelledby="sale-create-delivery-title" onCancel={(event) => { event.preventDefault(); if (!creatingClient) onClose(); }} className={"m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50 " + (clientSelection ? "max-w-5xl" : "max-w-xl")}>
    <form onSubmit={submit} className="space-y-4 p-5">
      <header className="flex items-start justify-between gap-3"><div><h2 id="sale-create-delivery-title" className="text-lg font-extrabold">Crear envío</h2><p className="mt-1 text-sm text-pw-muted">Elige la agencia y el municipio de entrega.</p></div><button type="button" aria-label="Cerrar" disabled={creatingClient} onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert"><p>{error}</p><button type="button" onClick={onRetryCatalogs} className="mt-2 font-bold underline">Volver a cargar municipios y agencias</button></div> : null}
      {loading ? <p className="rounded-lg bg-pw-canvas p-3 text-sm text-pw-muted" role="status">Cargando municipios y agencias…</p> : null}
      {!loading && !error && (!agencies.length || !municipalities.length) ? <p className="rounded-lg bg-pw-canvas p-3 text-sm text-pw-muted">No hay agencias habilitadas o municipios disponibles para crear el envío.</p> : null}
      <div className={clientSelection ? "grid items-start gap-4 md:grid-cols-2" : ""}>
      {clientSelection ? <section aria-labelledby="delivery-client-title" className="space-y-3 rounded-xl border border-pw-line p-3">
        <h3 id="delivery-client-title" className="text-sm font-extrabold">Clienta <span className="font-medium text-pw-muted">(opcional)</span></h3>
        {clientSelection.client ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-pw-brand-soft p-3"><strong>{clientSelection.client.name}</strong><button type="button" onClick={() => clientSelection.onSelect(null)} className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-bold">Cambiar clienta</button></div> : null}
        {!clientSelection.client ? <><div className="grid gap-3 sm:grid-cols-2">
          {([ ["name", "Nombre"], ["phoneNumber", "Teléfono"], ["instagramUser", "Usuario de Instagram"], ["messengerUser", "Usuario de Messenger"], ["address", "Dirección"] ] as const).map(([key, label]) => <label key={key} htmlFor={`delivery-client-${key}`} className={"grid gap-1 text-xs font-bold text-pw-muted " + (key === "address" ? "sm:col-span-2" : "")}>{label}{key === "name" || key === "phoneNumber" ? " *" : " (opcional)"}{key === "address" ? <textarea id={`delivery-client-${key}`} rows={2} disabled={creatingClient} value={clientValues[key]} onChange={(event) => (setMatches(null), setCandidate(null), setUpdates({}), setClientValues((current) => ({ ...current, [key]: event.target.value })))} className="rounded-lg border border-pw-line px-3 py-2 text-sm text-pw-ink" /> : <input id={`delivery-client-${key}`} disabled={creatingClient} value={clientValues[key]} onChange={(event) => (setMatches(null), setCandidate(null), setUpdates({}), setClientValues((current) => ({ ...current, [key]: event.target.value })))} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm text-pw-ink" />}</label>)}
        </div>{hasUnsavedClient ? <p className="text-xs text-pw-muted">Crea la clienta o borra sus datos antes de guardar el envío.</p> : null}{clientError ? <p role="alert" className="text-sm text-red-800">{clientError}</p> : null}<div className="flex flex-wrap items-center gap-2"><button type="button" disabled={creatingClient || !clientValues.name.trim() || !clientValues.phoneNumber.trim()} onClick={() => void searchClients(1, true)} className="min-h-11 rounded-lg border border-pw-brand px-4 text-sm font-bold text-pw-brand-deep disabled:opacity-50">{creatingClient ? "Creando clienta…" : "Crear clienta"}</button><button type="button" disabled={creatingClient} onClick={() => void searchClients(1)} className="min-h-11 rounded-lg border border-pw-brand px-4 text-sm font-bold text-pw-brand-deep disabled:opacity-50">Buscar clienta</button></div></> : null}
      </section> : null}
      <section aria-labelledby="delivery-details-title" className="space-y-3 rounded-xl border border-pw-line p-3">
        <h3 id="delivery-details-title" className="text-sm font-extrabold">Datos del envío</h3>
        <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Código del envío<input required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ej. ENV-0001" className="min-h-11 rounded-lg border border-pw-line px-3 text-sm text-pw-ink" /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Costo de envío (C$)<input required type="number" min="0" step="0.01" value={shippingAmount} onChange={(event) => setShippingAmount(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm text-pw-ink" /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Agencia<SelectControl id="sale-create-delivery-agency" aria-label="Agencia de envío" value={agencyId} options={[{ value: "", label: agencies.length ? "Seleccionar agencia" : "Sin agencias habilitadas" }, ...agencies.map((agency) => ({ value: String(agency.id), label: agency.name }))]} onChange={(event) => setAgencyId(event.target.value)} searchable searchPlaceholder="Buscar agencia…" disabled={loading || !!error || agencies.length === 0} required /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Municipio<SelectControl id="sale-create-delivery-municipality" aria-label="Municipio de entrega" value={municipalityId} options={[{ value: "", label: municipalities.length ? "Seleccionar municipio" : "Sin municipios" }, ...municipalities.map((municipality) => ({ value: String(municipality.id), label: `${municipality.name} · ${municipality.departmentName}` }))]} onChange={(event) => setMunicipalityId(event.target.value)} searchable searchPlaceholder="Buscar municipio…" disabled={loading || !!error || municipalities.length === 0} required /></label>
        {!clientSelection ? <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-2">Dirección de entrega (opcional)<textarea rows={2} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Si se deja vacía, se usa la dirección de la clienta." className="rounded-lg border border-pw-line px-3 py-2 text-sm text-pw-ink" /></label> : null}
        <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-2">Comentario (opcional)<textarea rows={2} maxLength={500} value={comments} onChange={(event) => setComments(event.target.value)} className="rounded-lg border border-pw-line px-3 py-2 text-sm text-pw-ink" /></label>
        </div>
      </section>
      </div>
      <footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy || creatingClient} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy || creatingClient} disabled={!canSubmit || creatingClient} className="min-h-10 text-sm">{initialDelivery ? "Guardar envío" : "Crear envío"}</LoadingButton></footer>
    </form>
    {matches ? <ClientMatchesDialog matches={matches} page={matchPage} pages={matchPages} candidate={candidate} updates={updates} values={clientValues} busy={creatingClient} error={clientError} contactConflict={contactConflict} onClose={() => { setMatches(null); setCandidate(null); }} onPage={(page) => void searchClients(page)} onChoose={(match) => { setCandidate(match); setUpdates({}); }} onUpdate={(key, checked) => setUpdates((old) => ({ ...old, [key]: checked }))} onConfirm={() => void chooseCandidate()} onCreate={async () => { setCreatingClient(true); setClientError(null); try { await createClient(); } catch (caught) { setClientError(caught instanceof Error ? caught.message : "No se pudo crear la clienta."); } finally { setCreatingClient(false); } }} /> : null}
  </dialog>, document.body);
}


type ClientValues = { name: string; phoneNumber: string; instagramUser: string; messengerUser: string; address: string };
function ClientMatchesDialog({ matches, page, pages, candidate, updates, values, busy, error, contactConflict, onClose, onPage, onChoose, onUpdate, onConfirm, onCreate }: {
  matches: SaleClient[]; page: number; pages: number; candidate: SaleClient | null; updates: Record<string, boolean>; values: ClientValues; busy: boolean; error: string | null; contactConflict: boolean;
  onClose: () => void; onPage: (page: number) => void; onChoose: (client: SaleClient) => void; onUpdate: (key: string, checked: boolean) => void; onConfirm: () => void; onCreate: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialogRef.current; element?.showModal(); return () => element?.close(); }, []);
  return createPortal(<dialog ref={dialogRef} aria-labelledby="client-matches-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-pw-line bg-white p-5 text-pw-ink shadow-2xl backdrop:bg-black/50">
    <header className="flex items-center justify-between gap-3"><h2 id="client-matches-title" className="text-lg font-extrabold">Coincidencias de clientas</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar coincidencias" className="min-h-10 rounded-lg border border-pw-line px-3">×</button></header>
    <div className="mt-4 space-y-3">{error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {!matches.length ? <p className="text-sm text-pw-muted">No se encontraron coincidencias.</p> : matches.map((match) => <div key={match.id} className={"rounded-lg border p-3 text-sm " + (match.isBlocked ? "border-red-300 bg-red-50" : "border-pw-line")}><div className="flex items-center justify-between gap-3"><strong>{match.name}</strong><span className={match.isBlocked ? "font-bold text-red-800" : "text-pw-muted"}>{match.isBlocked ? "Bloqueada" : "Activa"}</span></div><p className="mt-1 text-pw-muted">Teléfono: {match.phone || "Sin dato"} · Instagram: {match.instagram || "Sin dato"} · Messenger: {match.messenger || "Sin dato"}</p><p className="mt-1 text-pw-muted">Dirección: {match.address || "Sin dato"}</p>{match.isBlocked && match.blockedReason ? <p className="mt-1 text-red-800">Motivo: {match.blockedReason}</p> : null}<button type="button" disabled={busy || match.isBlocked} onClick={() => onChoose(match)} className="mt-2 min-h-10 rounded-lg border border-pw-brand px-3 font-bold text-pw-brand-deep disabled:opacity-50">Seleccionar</button></div>)}
      {pages > 1 ? <div className="flex items-center justify-between text-sm"><button type="button" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page >= pages || busy} onClick={() => onPage(page + 1)}>Siguiente</button></div> : null}
      {candidate ? <div className="space-y-2 rounded-lg border border-pw-line p-3"><p className="font-bold">Comparar datos de {candidate.name}</p>{([ ["name", "Nombre", candidate.name], ["phoneNumber", "Teléfono", candidate.phone], ["instagramUser", "Instagram", candidate.instagram], ["messengerUser", "Messenger", candidate.messenger], ["address", "Dirección", candidate.address] ] as const).filter(([key, , current]) => values[key].trim() && values[key].trim() !== (current ?? "").trim()).map(([key, label, current]) => <label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(updates[key])} onChange={(event) => onUpdate(key, event.target.checked)} /><span><strong>{label}</strong>: {current || "Sin dato"} → {values[key].trim()}<span className="block text-pw-muted">Marcar para actualizar</span></span></label>)}<button type="button" disabled={busy} onClick={onConfirm} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-bold text-white disabled:opacity-50">Usar esta clienta</button></div> : null}
      {contactConflict ? <p className="text-sm text-pw-muted">Ya existe una clienta con el teléfono o usuario indicado. Selecciónala o cambia ese dato.</p> : <button type="button" disabled={busy || !values.name.trim() || !values.phoneNumber.trim()} onClick={onCreate} className="min-h-11 rounded-lg border border-pw-brand px-4 text-sm font-bold text-pw-brand-deep disabled:opacity-50">Crear clienta nueva</button>}
    </div>
  </dialog>, document.body);
}
