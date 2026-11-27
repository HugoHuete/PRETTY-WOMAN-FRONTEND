import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function SaleProductImage({ src, name, className, fit = "cover" }: {
  src: string;
  name: string;
  className: string;
  fit?: "cover" | "contain";
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={`Ampliar imagen de ${name}`}
        aria-haspopup="dialog"
        title="Ampliar imagen"
        onClick={() => setOpen(true)}
        className={`block cursor-zoom-in overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand ${className}`}
      >
        <img src={src} alt="" loading="lazy" className={`size-full ${fit === "contain" ? "object-contain" : "object-cover"}`} />
      </button>
      {open ? createPortal(
        <dialog
          ref={dialogRef}
          aria-label={`Imagen de ${name}`}
          onCancel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) setOpen(false);
          }}
          className="m-auto max-w-[calc(100%-2rem)] rounded-xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/70"
        >
          <div className="flex flex-col gap-2 p-3">
            <header className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-bold">{name}</span>
              <button
                type="button"
                aria-label="Cerrar imagen"
                onClick={() => setOpen(false)}
                className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-pw-brand"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5">
                  <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <img src={src} alt={name} className="max-h-[min(75dvh,calc(100dvh-6rem))] max-w-[min(48rem,calc(100vw-3.5rem))] self-center rounded-lg object-contain" />
          </div>
        </dialog>,
        document.body,
      ) : null}
    </>
  );
}
