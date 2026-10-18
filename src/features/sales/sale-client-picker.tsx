import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/auth-provider";
import type { ClientRecord } from "../clients/clients-page";
import { Pagination } from "../../shared/ui/pagination";
import { SelectControl } from "../../shared/ui/select-control";
import { getSaleClients } from "./sales-api";
import type { ClientSearch, SaleClient } from "./sales-types";

const searchFields = [
  { value: "name", label: "Nombre", placeholder: "Nombre de la clienta" },
  { value: "phoneNumber", label: "Teléfono", placeholder: "Número de teléfono" },
  { value: "instagramUser", label: "Instagram", placeholder: "Usuario de Instagram" },
  { value: "messengerUser", label: "Messenger", placeholder: "Usuario de Messenger" },
] as const;

type SearchField = (typeof searchFields)[number]["value"];

export function SaleClientPicker({
  selectedClient,
  onSelect,
  onCreateClient,
}: {
  selectedClient: SaleClient | null;
  onSelect: (client: SaleClient | null) => void;
  onCreateClient: () => void;
}) {
  const { request } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<SearchField>("name");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ClientRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  useEffect(() => {
    const query = term.trim();
    if (!open || query.length < 2) {
      setItems([]);
      setTotalPages(1);
      setError(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setError(null);
    setLoading(true);
    setItems([]);
    const timeout = window.setTimeout(() => {
      const filters: ClientSearch = {
        page,
        pageSize: 8,
        name: "",
        phoneNumber: "",
        instagramUser: "",
        messengerUser: "",
      };
      filters[field] = query;
      void getSaleClients(request, filters)
        .then((result) => {
          if (!active) return;
          setItems(result.items);
          setTotalPages(result.totalPages);
        })
        .catch((caught: unknown) => {
          if (active) {
            setError(caught instanceof Error ? caught.message : "No se pudo buscar a la clienta.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [field, open, page, request, retry, term]);

  const close = () => setOpen(false);
  const openSearch = () => {
    setTerm("");
    setField("name");
    setPage(1);
    setError(null);
    setOpen(true);
  };
  const chooseClient = (client: ClientRecord) => {
    onSelect({
      id: client.id,
      name: client.name,
      phone: client.phone,
      instagram: client.instagram,
      messenger: client.messenger,
    });
    close();
  };

  return (
    <>
      {selectedClient ? (
        <div className="rounded-xl border border-pw-brand/35 bg-pw-brand-soft px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <p className="truncate font-extrabold text-pw-ink">{selectedClient.name}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" aria-label="Cambiar clienta" onClick={openSearch} className="min-h-8 rounded-lg border border-pw-line bg-white px-2.5 text-xs font-bold">Cambiar</button>
              <button type="button" aria-label="Quitar clienta" onClick={() => onSelect(null)} className="min-h-8 rounded-lg border border-pw-line bg-white px-2.5 text-xs font-bold">Quitar</button>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-pw-muted">
            <span>{selectedClient.phone || "Sin teléfono"}</span>
            {selectedClient.instagram ? <span>Instagram: {selectedClient.instagram}</span> : null}
            {selectedClient.messenger ? <span>Messenger: {selectedClient.messenger}</span> : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={openSearch} className="min-h-11 rounded-lg border border-pw-brand px-4 text-sm font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft">Buscar clienta</button>
        </div>
      )}

      {createPortal(
        <dialog
          ref={dialogRef}
          aria-labelledby="sale-client-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          className="pw-centered-dialog overflow-hidden rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/45"
        >
          <div className="flex max-h-[90dvh] flex-col">
            <header className="flex items-center justify-between border-b border-pw-line px-5 py-4">
              <div>
                <h2 id="sale-client-dialog-title" className="text-lg font-extrabold">Buscar clienta</h2>
              </div>
              <button type="button" onClick={close} aria-label="Cerrar búsqueda de clienta" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button>
            </header>

            <div className="space-y-4 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
                <label htmlFor="sale-client-search-field" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
                  Buscar por
                  <SelectControl
                    id="sale-client-search-field"
                    aria-label="Buscar por"
                    value={field}
                    onChange={(event) => {
                      setField(event.target.value as SearchField);
                      setPage(1);
                    }}
                    options={searchFields.map(({ value, label }) => ({ value, label }))}
                    portal
                    portalContainer={dialogRef.current}
                  />
                </label>
                <label htmlFor="sale-client-search" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
                  {searchFields.find((option) => option.value === field)?.label}
                  <input
                    id="sale-client-search"
                    type="search"
                    autoComplete="off"
                    value={term}
                    onChange={(event) => {
                      setTerm(event.target.value);
                      setPage(1);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                    placeholder={searchFields.find((option) => option.value === field)?.placeholder}
                    className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink"
                  />
                </label>
              </div>

              {!term.trim() ? <p className="rounded-xl border border-dashed border-pw-line p-5 text-center text-sm text-pw-muted">Escribe al menos 2 caracteres para buscar.</p> : null}
              {term.trim().length === 1 ? <p className="text-sm text-pw-muted">Escribe un carácter más para iniciar la búsqueda.</p> : null}
              {loading ? <p role="status" className="py-3 text-sm text-pw-muted">Buscando clientas…</p> : null}
              {error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p>{error}</p>
                  <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 min-h-9 font-bold underline">Reintentar búsqueda</button>
                </div>
              ) : null}
              {!loading && !error && term.trim().length >= 2 && items.length === 0 ? <p className="rounded-xl border border-dashed border-pw-line p-5 text-center text-sm text-pw-muted">No encontramos clientas con ese dato.</p> : null}
              {!loading && !error && items.length > 0 ? (
                <ul className="divide-y divide-pw-line rounded-xl border border-pw-line bg-white">
                  {items.map((client) => (
                    <li key={client.id}>
                      <button type="button" onClick={() => chooseClient(client)} className="min-h-16 w-full px-4 py-3 text-left hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-pw-brand">
                        <span className="block font-bold text-pw-ink">{client.name}</span>
                        <span className="mt-0.5 block text-sm text-pw-muted">
                          {[client.phone, client.instagram ? `Instagram: ${client.instagram}` : null, client.messenger ? `Messenger: ${client.messenger}` : null].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!loading && !error && totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-pw-line p-4 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => { onSelect(null); close(); }} className="min-h-11 rounded-lg px-3 text-sm font-bold text-pw-muted underline underline-offset-2">Continuar sin clienta</button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={close} className="min-h-11 rounded-lg border border-pw-line bg-white px-4 text-sm font-bold">Cancelar</button>
              <button type="button" onClick={() => { close(); onCreateClient(); }} className="min-h-11 rounded-lg border border-pw-brand px-4 text-sm font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft">Crear clienta nueva</button>
              </div>
            </footer>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
