import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { LoadingButton } from "../../shared/ui/loading-button";
import { useAuth } from "../auth/auth-provider";
import { getSaleClient, updateSaleClient } from "./sales-api";
import type { SaleClient } from "./sales-types";

const fields = [
  ["name", "Nombre", 100],
  ["phone", "Teléfono"],
  ["instagram", "Usuario de Instagram", 50],
  ["messenger", "Usuario de Messenger", 50],
  ["address", "Dirección", 350],
] as const;

export function SaleClientEditButton({ client, onUpdated, disabled }: {
  client: SaleClient;
  onUpdated: (client: SaleClient) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-bold disabled:opacity-50">
      Editar clienta
    </button>
    {open ? <SaleClientEditDialog key={client.id} clientId={client.id} onClose={() => setOpen(false)} onUpdated={onUpdated} /> : null}
  </>;
}

function SaleClientEditDialog({ clientId, onClose, onUpdated }: {
  clientId: number;
  onClose: () => void;
  onUpdated: (client: SaleClient) => void;
}) {
  const { request } = useAuth();
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const initialClient = useRef<SaleClient | null>(null);
  const [values, setValues] = useState<SaleClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    let active = true;
    void getSaleClient(request, clientId).then((client) => {
      if (!active) return;
      initialClient.current = client;
      setValues(client);
    }).catch(() => {
      if (active) setError("No se pudieron cargar los datos de la clienta.");
    });
    return () => { active = false; };
  }, [request, clientId]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const initial = initialClient.current;
    if (!initial || !values || saving || !values.name.trim()) return;
    const changedFields = fields.filter(([key]) => (values[key] ?? "") !== (initial[key] ?? ""));
    if (!changedFields.length) {
      onClose();
      return;
    }

    const phoneNumber = values.phone?.replace(/[\s-]/g, "") ?? "";
    if (changedFields.some(([key]) => key === "phone") && values.phone?.trim() && !/^[0-9]{8}$/.test(phoneNumber)) {
      setError("El número de teléfono debe tener 8 dígitos.");
      return;
    }
    const tooLong = changedFields.find(([key, , maxLength]) =>
      maxLength !== undefined && Array.from(values[key]?.trim() ?? "").length > maxLength,
    );
    if (tooLong) {
      const [, label, maxLength] = tooLong;
      setError(`${label} admite hasta ${maxLength} caracteres.`);
      return;
    }
    const edits = {
      name: values.name.trim(),
      phone: phoneNumber || null,
      instagram: values.instagram?.trim().replace(/^@/, "").toLowerCase() || null,
      messenger: values.messenger?.trim().toLowerCase() || null,
      address: values.address?.trim() || null,
    };
    setError(null);
    setSaving(true);
    try {
      const latest = await getSaleClient(request, clientId);
      const updated = { ...latest, ...Object.fromEntries(changedFields.map(([key]) => [key, edits[key]])) };
      await updateSaleClient(request, clientId, {
        name: updated.name,
        phoneNumber: updated.phone ?? "",
        instagramUser: updated.instagram ?? undefined,
        messengerUser: updated.messenger ?? undefined,
        address: updated.address ?? undefined,
        isFriend: Boolean(updated.isFriend),
        comments: updated.comments ?? null,
      });
      onUpdated(updated);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron guardar los datos de la clienta.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <dialog ref={dialog} aria-labelledby={title} onCancel={(event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!saving) onClose();
    }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-pw-line bg-white p-5 text-pw-ink shadow-2xl backdrop:bg-black/50">
      <h2 id={title} className="text-lg font-extrabold">Editar clienta</h2>
      <form className="mt-4 space-y-4" onSubmit={(event) => void save(event)}>
        {!values && !error ? <p role="status" className="text-sm text-pw-muted">Cargando datos de la clienta…</p> : null}
        {values ? <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
          {fields.map(([key, label, maxLength]) => {
            const inputProps = {
              value: values[key] ?? "",
              maxLength,
              onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setValues({ ...values, [key]: event.target.value });
              },
              className: "min-h-11 rounded-lg border border-pw-line px-3 py-2 text-sm text-pw-ink",
            };
            return <label key={key} className={"grid gap-1 text-xs font-bold text-pw-muted " + (key === "address" ? "sm:col-span-2" : "")}>
              {label}
              {key === "address" ? <textarea rows={2} {...inputProps} /> :
                <input type={key === "phone" ? "tel" : "text"} required={key === "name"} {...inputProps} />}
            </label>;
          })}
        </fieldset> : null}
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <footer className="flex justify-end gap-2 border-t border-pw-line pt-4">
          <button type="button" disabled={saving} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button>
          <LoadingButton type="submit" disabled={!values?.name.trim()} isLoading={saving}>Guardar cambios</LoadingButton>
        </footer>
      </form>
    </dialog>,
    document.body,
  );
}
