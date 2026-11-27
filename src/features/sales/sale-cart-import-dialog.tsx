import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { LoadingButton } from "../../shared/ui/loading-button";

const cartIdPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function sharedCartId(value: string) {
  const input = value.trim();
  if (cartIdPattern.test(input)) return input;

  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const id = url.pathname.match(/^\/(?:compartir\/)?selecciones\/([^/]+)\/?$/)?.[1];
    return id && cartIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function SaleCartImportDialog({ onClose, onImport }: {
  onClose: () => void;
  onImport: (id: string, signal: AbortSignal) => Promise<void>;
}) {
  const pendingImport = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { pendingImport.current?.abort(); dialog?.close(); };
  }, []);

  const cancel = () => {
    pendingImport.current?.abort();
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (pendingImport.current) return;
    const id = sharedCartId(value);
    if (!id) {
      setError("Pega un enlace de carrito compartido o un ID válido.");
      return;
    }

    const controller = new AbortController();
    pendingImport.current = controller;
    setError(null);
    setBusy(true);
    try {
      await onImport(id, controller.signal);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "No se pudo importar el carrito.");
      pendingImport.current = null;
      setBusy(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="sale-cart-import-title"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-pw-line bg-white p-5 text-pw-ink shadow-2xl backdrop:bg-black/50"
    >
      <h2 id="sale-cart-import-title" className="text-lg font-extrabold">Importar carrito</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="grid gap-1.5 text-sm font-bold" htmlFor="sale-cart-reference">
          Enlace o ID del carrito
          <input
            id="sale-cart-reference"
            type="text"
            value={value}
            onChange={(event) => { setValue(event.target.value); setError(null); }}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "sale-cart-import-error" : undefined}
            className="min-h-11 w-full rounded-lg border border-pw-line px-3 font-normal focus-visible:outline-2 focus-visible:outline-pw-brand"
          />
        </label>
        {error ? <p id="sale-cart-import-error" role="alert" className="text-sm text-red-700">{error}</p> : null}
        <footer className="flex flex-wrap justify-end gap-2 border-t border-pw-line pt-4">
          <button type="button" onClick={cancel} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button>
          <LoadingButton type="submit" isLoading={busy} disabled={!value.trim()}>{busy ? "Importando…" : "Importar"}</LoadingButton>
        </footer>
      </form>
    </dialog>,
    document.body,
  );
}
