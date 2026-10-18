import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/auth-provider";
import { Pagination } from "../../shared/ui/pagination";
import { ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { getSaleProducts } from "./sales-api";
import { saleVariants, type SaleDraftLine, type SaleVariantOption } from "./sale-product-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });

export function SaleProductPicker({
  lines,
  onAdd,
}: {
  lines: SaleDraftLine[];
  onAdd: (option: SaleVariantOption) => void;
}) {
  const { request } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getSaleProducts>> | null>(null);
  const [announcement, setAnnouncement] = useState("");

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
    const query = code.trim();
    if (!open || !query || !/^\d+$/.test(query)) {
      setCatalog(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setCatalog(null);
    const timeout = window.setTimeout(() => {
      void getSaleProducts(request, { page, pageSize: 8, code: query })
        .then((result) => {
          if (active) setCatalog(result);
        })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : "No se pudo buscar el catálogo.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [code, open, page, request, retry]);

  const options = useMemo(() => saleVariants(catalog?.items ?? []), [catalog]);
  const groups = useMemo(() => {
    const grouped = new Map<string, SaleVariantOption[]>();
    options.forEach((option) => {
      const key = `${option.product.id}:${option.presentationId}`;
      const group = grouped.get(key);
      if (group) group.push(option);
      else grouped.set(key, [option]);
    });
    return Array.from(grouped.values());
  }, [options]);
  const close = () => setOpen(false);
  const openSearch = () => {
    setCode("");
    setPage(1);
    setCatalog(null);
    setError(null);
    setAnnouncement("");
    setOpen(true);
  };
  const addVariant = (option: SaleVariantOption) => {
    onAdd(option);
    setAnnouncement(`${option.product.name}, ${option.presentationName}${option.variant.sizeName ? `, talla ${option.variant.sizeName}` : ""}, añadida a la venta.`);
  };

  return (
    <>
      <button type="button" onClick={openSearch} className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep">Agregar prenda</button>
      {createPortal(
        <dialog
          ref={dialogRef}
          aria-labelledby="sale-product-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/45"
        >
          <div className="flex max-h-[90dvh] flex-col">
            <header className="flex items-center justify-between border-b border-pw-line px-5 py-4">
              <div>
                <h2 id="sale-product-dialog-title" className="text-lg font-extrabold">Buscar prendas</h2>
              </div>
              <button type="button" onClick={close} aria-label="Cerrar búsqueda de prendas" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button>
            </header>

            <div className="space-y-4 overflow-y-auto p-5">
              <label htmlFor="catalog-code" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
                Código de la prenda
                <input
                  id="catalog-code"
                  type="search"
                  inputMode="numeric"
                  autoComplete="off"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setPage(1);
                    setAnnouncement("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  placeholder="Escribe el código"
                  className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink"
                />
              </label>

              {!code.trim() ? <p className="rounded-xl border border-dashed border-pw-line p-5 text-center text-sm text-pw-muted">Escribe un código para consultar las prendas disponibles.</p> : null}
              {code.trim() && !/^\d+$/.test(code.trim()) ? <p role="status" className="text-sm text-pw-muted">El código debe contener solo números.</p> : null}
              {loading ? <LoadingState /> : null}
              {!loading && error ? <ErrorState title="No se pudo buscar el catálogo" description={error} onRetry={() => setRetry((value) => value + 1)} /> : null}
              {!loading && !error && catalog && options.length === 0 ? <p className="rounded-xl border border-dashed border-pw-line p-5 text-center text-sm text-pw-muted">No encontramos prendas disponibles con ese código.</p> : null}
              {!loading && !error && options.length > 0 ? (
                <div className="grid gap-4">
                  {groups.map((group) => {
                    const first = group[0];
                    return (
                      <section key={`${first.product.id}:${first.presentationId}`} className="overflow-hidden rounded-xl border border-pw-line">
                        <header className="px-4 pb-3 pt-4">
                          <p className="text-sm font-extrabold text-pw-brand-deep">Código {first.product.code}</p>
                          <h3 className="mt-1 text-base font-extrabold text-pw-ink">{first.presentationName}</h3>
                          <p className="mt-0.5 text-sm text-pw-muted">{first.product.name}</p>
                        </header>
                        <div>
                          {group.map((option) => {
                            const added = lines.some((line) => line.productVariantId === option.variant.id);
                            const price = option.variant.discountedSalePrice ?? option.variant.salePrice;
                            const size = option.variant.sizeName || "Talla única";
                            return (
                              <div key={option.variant.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-pw-line px-4 py-3">
                                <div className="min-w-0">
                                  <p className="font-bold text-pw-ink">{size}</p>
                                  <p className="mt-0.5 text-sm text-pw-muted">{money.format(price)} · {option.variant.availableQuantity} disponibles</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={added}
                                  onClick={() => addVariant(option)}
                                  className="min-h-11 shrink-0 rounded-lg border border-pw-brand px-3 text-sm font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft disabled:cursor-default disabled:border-pw-line disabled:text-pw-muted"
                                >
                                  {added ? "Agregada" : "Agregar"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : null}
              {catalog && catalog.totalPages > 1 ? <Pagination page={catalog.page} totalPages={catalog.totalPages} onPageChange={setPage} /> : null}
              <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
            </div>

            <footer className="flex justify-end border-t border-pw-line p-4">
              <button type="button" onClick={close} className="min-h-11 rounded-lg border border-pw-line bg-white px-4 text-sm font-bold">Listo</button>
            </footer>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
