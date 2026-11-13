import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { SelectControl } from "../../shared/ui/select-control";
import { LoadingButton } from "../../shared/ui/loading-button";
import type { CreateSaleDeliveryPayload, SaleDeliveryAgency, SaleMunicipality } from "./sales-types";

export function SaleDeliveryCreateDialog({
  municipalities,
  agencies,
  loading,
  error,
  busy,
  clientId,
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
  initialDelivery?: CreateSaleDeliveryPayload;
  onRetryCatalogs: () => void;
  onClose: () => void;
  onSave: (payload: CreateSaleDeliveryPayload) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const defaultMunicipalitySelected = useRef(Boolean(initialDelivery?.municipalityId));
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

  const canSubmit = !loading && !error && agencies.length > 0 && municipalities.length > 0 && Number(agencyId) > 0 && Number(municipalityId) > 0 && code.trim().length > 0 && Number(shippingAmount) >= 0;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canSubmit) return;
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

  return createPortal(<dialog ref={dialog} aria-labelledby="sale-create-delivery-title" onCancel={(event) => { event.preventDefault(); onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50">
    <form onSubmit={submit} className="space-y-4 p-5">
      <header className="flex items-start justify-between gap-3"><div><h2 id="sale-create-delivery-title" className="text-lg font-extrabold">Crear envío</h2><p className="mt-1 text-sm text-pw-muted">Elige la agencia y el municipio de entrega.</p></div><button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert"><p>{error}</p><button type="button" onClick={onRetryCatalogs} className="mt-2 font-bold underline">Volver a cargar municipios y agencias</button></div> : null}
      {loading ? <p className="rounded-lg bg-pw-canvas p-3 text-sm text-pw-muted" role="status">Cargando municipios y agencias…</p> : null}
      {!loading && !error && (!agencies.length || !municipalities.length) ? <p className="rounded-lg bg-pw-canvas p-3 text-sm text-pw-muted">No hay agencias habilitadas o municipios disponibles para crear el envío.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Código del envío<input required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ej. ENV-0001" className="min-h-11 rounded-lg border border-pw-line px-3 text-sm text-pw-ink" /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Costo de envío (C$)<input required type="number" min="0" step="0.01" value={shippingAmount} onChange={(event) => setShippingAmount(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm text-pw-ink" /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Agencia<SelectControl id="sale-create-delivery-agency" aria-label="Agencia de envío" value={agencyId} options={[{ value: "", label: agencies.length ? "Seleccionar agencia" : "Sin agencias habilitadas" }, ...agencies.map((agency) => ({ value: String(agency.id), label: agency.name }))]} onChange={(event) => setAgencyId(event.target.value)} searchable searchPlaceholder="Buscar agencia…" disabled={loading || !!error || agencies.length === 0} required /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted">Municipio<SelectControl id="sale-create-delivery-municipality" aria-label="Municipio de entrega" value={municipalityId} options={[{ value: "", label: municipalities.length ? "Seleccionar municipio" : "Sin municipios" }, ...municipalities.map((municipality) => ({ value: String(municipality.id), label: `${municipality.name} · ${municipality.departmentName}` }))]} onChange={(event) => setMunicipalityId(event.target.value)} searchable searchPlaceholder="Buscar municipio…" disabled={loading || !!error || municipalities.length === 0} required /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-2">Dirección de entrega (opcional)<textarea rows={2} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Si se deja vacía, se usa la dirección de la clienta." className="rounded-lg border border-pw-line px-3 py-2 text-sm text-pw-ink" /></label>
        <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-2">Comentario (opcional)<textarea rows={2} maxLength={500} value={comments} onChange={(event) => setComments(event.target.value)} className="rounded-lg border border-pw-line px-3 py-2 text-sm text-pw-ink" /></label>
      </div>
      <footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} disabled={!canSubmit} className="min-h-10 text-sm">{initialDelivery ? "Guardar envío" : "Crear envío"}</LoadingButton></footer>
    </form>
  </dialog>, document.body);
}
