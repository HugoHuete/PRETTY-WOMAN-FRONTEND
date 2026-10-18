import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/auth-provider";
import { LoadingButton } from "../../shared/ui/loading-button";
import { createSaleClient, getSaleClient } from "./sales-api";
import type { CreateSaleClientPayload, SaleClient } from "./sales-types";

export function SaleClientCreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (client: SaleClient) => void }) {
  const { request } = useAuth();
  const [values, setValues] = useState<CreateSaleClientPayload>({ name: "", phoneNumber: "", address: "", instagramUser: "", messengerUser: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const portalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const savingRef = useRef(saving);
  closeRef.current = onClose;
  savingRef.current = saving;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => document.getElementById("quick-client-name")?.focus(), 0);
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== portalRef.current)
      .map((element) => ({ element, wasInert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!savingRef.current) closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialogElement = document.getElementById("quick-client-dialog");
      const focusable: HTMLElement[] = dialogElement
        ? Array.from(dialogElement.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.offsetParent !== null)
        : [];
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    setError(null);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      background.forEach(({ element, wasInert }) => { element.inert = wasInert; });
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const id = await createSaleClient(request, {
        ...values,
        instagramUser: values.instagramUser || undefined,
        messengerUser: values.messengerUser || undefined,
        address: values.address || undefined,
      });
      try {
        const client = await getSaleClient(request, id);
        onCreated({ id: client.id, name: client.name, phone: client.phone });
      } catch {
        // La creación ya fue confirmada; si falla solo la lectura canónica, conserva el ID exacto devuelto.
        onCreated({ id, name: values.name.trim(), phone: values.phoneNumber?.trim() });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la clienta.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof CreateSaleClientPayload, label: string, required = false) => (
    <label className="grid gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor={`quick-client-${key}`}>
      {label}
      <input
        id={`quick-client-${key}`}
        required={required}
        value={values[key] ?? ""}
        onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
        className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink"
      />
    </label>
  );

  return createPortal(
    <div
      ref={portalRef}
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section id="quick-client-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-client-title" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-pw-line bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-pw-line px-5 py-4">
          <h2 id="quick-client-title" className="text-lg font-extrabold">Crear clienta</h2>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-lg border border-pw-line text-xl">×</button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void submit(event);
          }}
          className="space-y-4 p-5"
        >
          <p className="text-sm text-pw-muted">La clienta quedará asociada a esta venta al guardarla.</p>
          {field("name", "Nombre", true)}
          {field("phoneNumber", "Teléfono", true)}
          {field("address", "Dirección")}
          {field("instagramUser", "Usuario de Instagram")}
          {field("messengerUser", "Usuario de Messenger")}
          {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
          <footer className="flex justify-end gap-3 border-t border-pw-line pt-4">
            <button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-lg border border-pw-line px-4 font-bold">Cancelar</button>
            <LoadingButton type="submit" isLoading={saving}>{saving ? "Guardando…" : "Guardar clienta"}</LoadingButton>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
