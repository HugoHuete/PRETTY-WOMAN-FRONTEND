import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { LoadingButton } from "../../shared/ui/loading-button";
import { SelectControl } from "../../shared/ui/select-control";
import { useAuth } from "../auth/auth-provider";
import { SaleClientFields } from "./sale-client-fields";
import { getSaleClient } from "./sales-api";
import type { PatchSaleDeliveryPayload, SaleClient, SaleDelivery, SaleDeliveryAgency, SaleMunicipality } from "./sales-types";

export type DeliveryEditCatalogs = {
  agencies: SaleDeliveryAgency[];
  municipalities: SaleMunicipality[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function SaleDeliveryEditDialog({ delivery, catalogs, busy, saveError, onClientUpdated, onClose, onSave }: {
  delivery: SaleDelivery;
  catalogs: DeliveryEditCatalogs;
  busy: boolean;
  saveError?: string | null;
  onClientUpdated?: (client: SaleClient) => void;
  onClose: () => void;
  onSave: (payload: PatchSaleDeliveryPayload) => Promise<boolean>;
}) {
  const { request } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const refreshedOriginalClientId = useRef<number | null>(null);
  const [code, setCode] = useState(delivery.code);
  const [addressDraft, setAddressDraft] = useState<string | null>(null);
  const [originalClientAddress, setOriginalClientAddress] = useState<string | null>();
  const [addressLookupFailed, setAddressLookupFailed] = useState(false);
  const [addressLookupAttempt, setAddressLookupAttempt] = useState(0);
  const [addressChoice, setAddressChoice] = useState<"current" | "recipient" | "none" | null>(null);
  const [shipping, setShipping] = useState(String(delivery.shippingChargedToClient));
  const [agencyId, setAgencyId] = useState(String(delivery.deliveryAgencyId));
  const [municipalityId, setMunicipalityId] = useState(String(delivery.municipalityId));
  const [client, setClient] = useState<SaleClient | null>(() => delivery.clientId
    ? { id: delivery.clientId, name: `Clienta #${delivery.clientId}` }
    : null);
  const [changingClient, setChangingClient] = useState(false);
  const [clientBusy, setClientBusy] = useState(false);
  const [clientDirty, setClientDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const originalClientId = delivery.clientId;
  useEffect(() => {
    if (!originalClientId) return;
    let active = true;
    void getSaleClient(request, originalClientId).then((result) => {
      if (!active || refreshedOriginalClientId.current === originalClientId) return;
      setOriginalClientAddress(result.address?.trim() || null);
      setAddressLookupFailed(false);
      setClient((current) => current?.id === originalClientId && current.name === `Clienta #${originalClientId}` ? result : current);
    }).catch(() => {
      if (!active || refreshedOriginalClientId.current === originalClientId) return;
      setOriginalClientAddress(null);
      setAddressLookupFailed(true);
    });
    return () => { active = false; };
  }, [request, originalClientId, addressLookupAttempt]);

  const agencies = catalogs.agencies.filter((agency) => agency.enabled);
  const catalogDisabled = catalogs.loading || Boolean(catalogs.error);
  const blocked = busy || clientBusy;
  const recipientChanged = Boolean(client && client.id !== originalClientId);
  const savedAddress = delivery.deliveryAddress?.trim() || null;
  const address = addressDraft ?? savedAddress ?? "";
  const currentAddress = address.trim() || null;
  const recipientAddress = client?.address?.trim() || null;
  const originalAddressUnavailable = savedAddress === null && addressLookupFailed;
  const useRecipientAddress = recipientChanged && addressChoice === "recipient" && !originalAddressUnavailable;
  const confirmedAddress = useRecipientAddress ? recipientAddress : currentAddress;
  const originalAddressPending = Boolean(originalClientId) && savedAddress === null && originalClientAddress === undefined;
  const waitingForAddress = recipientChanged && originalAddressPending && addressChoice !== "current";
  const canLeaveWithoutAddress = !originalAddressPending && !originalAddressUnavailable &&
    !currentAddress && !recipientAddress;
  const addressConfirmed = !recipientChanged || (
    (addressChoice === "current" && currentAddress !== null) ||
    (useRecipientAddress && recipientAddress !== null) ||
    (addressChoice === "none" && canLeaveWithoutAddress)
  );
  const canSave = addressConfirmed && !waitingForAddress && !blocked && !clientDirty && Boolean(code.trim()) && shipping !== "" && Number(shipping) >= 0;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canSave) return;
    const payload: PatchSaleDeliveryPayload = {};
    if (code.trim() !== delivery.code) payload.code = code.trim();
    if (confirmedAddress !== savedAddress) {
      payload.deliveryAddress = confirmedAddress;
    }
    if (Number(shipping) !== delivery.shippingChargedToClient) payload.shippingChargedToClient = Number(shipping);
    if (Number(agencyId) !== delivery.deliveryAgencyId) payload.deliveryAgencyId = Number(agencyId);
    if (Number(municipalityId) !== delivery.municipalityId) payload.municipalityId = Number(municipalityId);
    if (client && client.id !== originalClientId) payload.clientId = client.id;
    if (!Object.keys(payload).length) { onClose(); return; }
    setAttempted(true);
    if (await onSave(payload)) onClose();
  };

  return createPortal(
    <dialog ref={dialog} aria-labelledby="sale-edit-delivery-title" onCancel={(event) => {
      event.preventDefault();
      if (!blocked) onClose();
    }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50">
      <form onSubmit={(event) => void submit(event)} className="space-y-4 p-5">
        <header className="flex justify-between gap-3">
          <h2 id="sale-edit-delivery-title" className="text-lg font-extrabold">Editar envío</h2>
          <button type="button" aria-label="Cerrar" disabled={blocked} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-pw-line text-xl">×</button>
        </header>
        {catalogs.loading ? <p role="status" className="text-sm text-pw-muted">Cargando municipios y agencias…</p> : null}
        {catalogs.error ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p>{catalogs.error}</p>
          <button type="button" onClick={catalogs.onRetry} className="mt-2 font-bold underline">Volver a cargar municipios y agencias</button>
        </div> : null}
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-pw-muted">Código del envío
            <input required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-pw-muted">Monto de envío (C$)
            <input required type="number" min="0" step="0.01" value={shipping} onChange={(event) => setShipping(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" />
          </label>
          <div className="grid gap-1 text-xs font-bold text-pw-muted">
            <label htmlFor="sale-edit-delivery-agency-trigger">Agencia</label>
            <SelectControl id="sale-edit-delivery-agency" triggerId="sale-edit-delivery-agency-trigger" aria-label="Agencia de envío" value={agencyId} disabled={busy || catalogDisabled} onChange={(event) => setAgencyId(event.target.value)} searchable options={[
              ...(!agencies.some((agency) => agency.id === delivery.deliveryAgencyId)
                ? [{ value: String(delivery.deliveryAgencyId), label: delivery.deliveryAgencyName ?? "Agencia actual" }] : []),
              ...agencies.map((agency) => ({ value: String(agency.id), label: agency.name })),
            ]} />
          </div>
          <div className="grid gap-1 text-xs font-bold text-pw-muted">
            <label htmlFor="sale-edit-delivery-municipality-trigger">Municipio</label>
            <SelectControl id="sale-edit-delivery-municipality" triggerId="sale-edit-delivery-municipality-trigger" aria-label="Municipio de entrega" value={municipalityId} disabled={busy || catalogDisabled} onChange={(event) => setMunicipalityId(event.target.value)} searchable options={[
              ...(!catalogs.municipalities.some((municipality) => municipality.id === delivery.municipalityId)
                ? [{ value: String(delivery.municipalityId), label: delivery.municipalityName ?? "Municipio actual" }] : []),
              ...catalogs.municipalities.map((municipality) => ({ value: String(municipality.id), label: `${municipality.name} · ${municipality.departmentName}` })),
            ]} />
          </div>
          <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-2">Dirección de entrega
            <textarea rows={3} value={useRecipientAddress ? recipientAddress ?? "" : address} readOnly={useRecipientAddress} onChange={(event) => setAddressDraft(event.target.value)} className="rounded-lg border border-pw-line px-3 py-2 text-sm" />
          </label>
          {!savedAddress && originalClientAddress && originalClientAddress !== currentAddress && !useRecipientAddress ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-pw-muted sm:col-span-2">
              <span>Dirección del perfil original</span>
              <span className="break-words font-semibold">{originalClientAddress}</span>
              <button type="button" disabled={blocked} onClick={() => setAddressDraft(originalClientAddress)} className="min-h-10 rounded-lg border border-pw-line px-3 font-bold">Usar dirección del perfil</button>
            </div>
          ) : null}
        </fieldset>
        {changingClient && client ? <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>Clienta actual: <strong>{client.name}</strong></p>
          <button type="button" disabled={blocked} onClick={() => setChangingClient(false)} className="min-h-10 rounded-lg border border-pw-line px-3 font-bold">Conservar clienta</button>
        </div> : null}
        <SaleClientFields
          key={changingClient ? "search" : "current"}
          client={changingClient ? null : client}
          disabled={busy}
          onSelect={(selected) => {
            if (!selected) {
              setChangingClient(true);
              return;
            }
            if (selected.id === originalClientId) {
              refreshedOriginalClientId.current = selected.id;
              setOriginalClientAddress(selected.address?.trim() || null);
              setAddressLookupFailed(false);
            }
            if (selected.id !== client?.id || selected.address !== client.address) setAddressChoice(null);
            setClient(selected);
            setChangingClient(false);
            onClientUpdated?.(selected);
          }}
          onBusyChange={setClientBusy}
          onDirtyChange={setClientDirty}
        />
        {recipientChanged ? <fieldset disabled={blocked} className="space-y-2 rounded-xl border border-pw-line p-3 text-sm">
          <legend className="px-1 font-bold">Confirma la dirección para {client?.name}</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="delivery-address-choice" checked={addressChoice === "current"} onChange={() => setAddressChoice("current")} />
            <span>{currentAddress ? <>
              {currentAddress === savedAddress ? "Conservar la dirección del envío" : "Usar la dirección escrita"}: <strong>{currentAddress}</strong>
            </> : "Escribir otra dirección"}</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="delivery-address-choice" disabled={!recipientAddress || originalAddressUnavailable} checked={useRecipientAddress} onChange={() => setAddressChoice("recipient")} />
            <span>Usar la dirección de la nueva clienta: <strong>{recipientAddress || "Sin dirección registrada"}</strong></span>
          </label>
          {canLeaveWithoutAddress ? <label className="flex items-start gap-2">
            <input type="radio" name="delivery-address-choice" checked={addressChoice === "none"} onChange={() => setAddressChoice("none")} />
            <span>Dejar el envío sin dirección</span>
          </label> : null}
        </fieldset> : null}
        {originalAddressUnavailable ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p>No se pudo consultar la dirección de la clienta original. Para cambiar de clienta, reintenta la consulta o escribe una dirección de entrega.</p>
          <button type="button" disabled={blocked || originalClientAddress === undefined} onClick={() => {
            setOriginalClientAddress(undefined);
            setAddressLookupAttempt((attempt) => attempt + 1);
          }} className="mt-2 font-bold underline disabled:opacity-50">Reintentar consulta de dirección</button>
        </div> : null}
        {waitingForAddress ? <p role="status" className="text-sm text-pw-muted">Cargando la dirección de la clienta…</p> : null}
        {attempted && saveError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{saveError}</p> : null}
        <footer className="flex justify-end gap-2 border-t border-pw-line pt-4">
          <button type="button" disabled={blocked} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button>
          <LoadingButton type="submit" isLoading={blocked} disabled={!canSave} className="min-h-10 text-sm">Guardar cambios</LoadingButton>
        </footer>
      </form>
    </dialog>,
    document.body,
  );
}
