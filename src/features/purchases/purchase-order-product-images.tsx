import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OrderProductDTO } from "./purchase-order-types";

export function OrderProductImages({ product }: { product: OrderProductDTO }) {
  const images = useMemo(() => {
    const entries = [
      { url: product.primaryImageUrl, label: "Imagen principal" },
      ...product.presentations.map((presentation) => ({ url: presentation.primaryImageUrl, label: presentation.name?.trim() || "Presentación" })),
    ];
    return entries.filter((entry, index): entry is { url: string; label: string } =>
      Boolean(entry.url) && entries.findIndex((other) => other.url === entry.url) === index,
    );
  }, [product]);
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (index !== null && element && !element.open) element.showModal();
  }, [index]);
  if (!images.length) return null;
  const close = () => setIndex(null);
  return <>
    <button type="button" aria-label={`Ver imágenes de ${product.name}`} onClick={() => setIndex(0)} className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand">
      <img src={images[0].url} alt="" className="h-full w-full object-contain" />
    </button>
    {index !== null ? createPortal(<dialog ref={dialog} aria-label={`Imágenes de ${product.name}`} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50">
      <header className="flex items-start justify-between gap-3 border-b border-pw-line px-5 py-4"><div className="min-w-0"><h2 className="text-lg font-extrabold">Imágenes del producto</h2><p className="mt-1 break-words text-sm text-pw-muted">{product.name}</p></div><button type="button" aria-label="Cerrar imágenes" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
      <div className="p-5"><img src={images[index].url} alt={`${images[index].label} de ${product.name}`} className="mx-auto max-h-[55dvh] w-full object-contain" /><div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-pw-muted">{images[index].label}{images.length > 1 ? ` · ${index + 1} de ${images.length}` : ""}</p>{images.length > 1 ? <div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold disabled:opacity-50">Anterior</button><button type="button" disabled={index === images.length - 1} onClick={() => setIndex(index + 1)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold disabled:opacity-50">Siguiente</button></div> : null}</div></div>
    </dialog>, document.body) : null}
  </>;
}
