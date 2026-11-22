import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { SelectControl } from "../../shared/ui/select-control";
import type { RequestFn } from "./product-images-api";

type Color = { id: number; name: string; hexCode: string };

export function PresentationColorEditor({ productId, presentationId, colorId, request, onSaved }: {
  productId: number;
  presentationId: number;
  colorId?: number | null;
  request: RequestFn;
  onSaved: (colorId: number | null) => void;
}) {
  const id = useId();
  const [colors, setColors] = useState<Color[]>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  const colorButton = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useLayoutEffect(() => {
    if (editing && (!wasEditing.current || (colors && document.activeElement === cancelButton.current))) {
      form.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
    if (!editing && wasEditing.current) colorButton.current?.focus();
    wasEditing.current = editing;
  }, [editing, colors]);

  async function open() {
    setEditing(true);
    setSelected(colorId == null ? "" : String(colorId));
    setError("");
    if (colors) return;
    try {
      const response = await request("/api/v1/products/colors");
      if (!response.ok) throw new Error();
      setColors(await response.json() as Color[]);
    } catch {
      setError("No se pudieron cargar los colores.");
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !colors) return;
    const value = selected === "" ? null : Number(selected);
    setBusy(true);
    setError("");
    try {
      const response = await request(`/api/v1/products/${productId}/presentations/${presentationId}/color`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorId: value }),
      });
      if (!response.ok) throw new Error();
      onSaved(value);
      setEditing(false);
    } catch {
      setError("No se pudo guardar el color. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const preview = colors?.find(color => String(color.id) === selected);
  const current = colors?.find(color => color.id === colorId);
  const buttonClass = "min-h-10 rounded-lg border border-pw-line px-3 text-sm font-extrabold text-pw-ink";
  if (!editing) return <button ref={colorButton} type="button" className={buttonClass} onClick={() => void open()}>
    {current ? `Color: ${current.name}` : colorId == null ? "Asignar color" : "Cambiar color"}
  </button>;

  return <form ref={form} className="flex flex-wrap items-end gap-2" onSubmit={save}>
    {colors && <label htmlFor={id} className="grid min-w-44 gap-1 text-sm font-semibold text-pw-ink">
      Color del catálogo
      <SelectControl id={id} aria-label="Color del catálogo" value={selected} searchable searchPlaceholder="Buscar color…" disabled={busy}
        options={[{ value: "", label: "Sin asignar" }, ...colors.map(color => ({ value: String(color.id), label: color.name }))]}
        onChange={event => setSelected(event.target.value)} />
    </label>}
    {preview && <span className="mb-2 size-6 rounded-full border border-pw-line" aria-hidden="true"
      style={{ backgroundColor: preview.hexCode }} />}
    {!colors && !error && <p role="status">Cargando colores…</p>}
    {colors && <button type="submit" className={buttonClass} aria-disabled={busy}>Guardar color</button>}
    <button ref={cancelButton} type="button" className={buttonClass} disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
    {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
  </form>;
}
