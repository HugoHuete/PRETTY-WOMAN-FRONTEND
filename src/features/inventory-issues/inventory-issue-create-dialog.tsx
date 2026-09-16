import { useState, type FormEvent } from "react";
import { createInventoryIssue, searchProductsByCode, type AuthenticatedRequest } from "./inventory-issue-api";
import { SelectControl } from "../../shared/ui/select-control";
import { inventoryIssueTypeOptions } from "./inventory-issue-types";
import type { ProductDTO } from "../products/product-types";

type CreateIssueForm = {
  productCode: string;
  variantId: string;
  typeId: string;
  quantity: string;
  comments: string;
};

const emptyCreateIssueForm: CreateIssueForm = {
  productCode: "",
  variantId: "",
  typeId: "",
  quantity: "1",
  comments: "",
};

export function InventoryIssueCreateDialog({ request, onClose, onCreated }: { request: AuthenticatedRequest; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateIssueForm>(emptyCreateIssueForm);
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const variants = selectedProduct?.presentations.flatMap((presentation) => presentation.sizes.map((size) => ({ id: size.id, label: `${presentation.name ?? "Sin variante"} · Talla ${size.sizeName ?? "sin definir"} · Disponible ${size.availableQuantity}` }))) ?? [];
  const productImage = selectedProduct?.primaryImageUrl ?? selectedProduct?.presentations[0]?.primaryImageUrl ?? null;
  const variantOptions = [{ value: "", label: "Selecciona una variante" }, ...variants.map((variant) => ({ value: String(variant.id), label: variant.label }))];
  const typeOptions = [{ value: "", label: "Selecciona un tipo" }, ...inventoryIssueTypeOptions.map((option) => ({ value: String(option.id), label: option.label }))];

  const updateForm = (key: keyof CreateIssueForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "productCode") {
      setSelectedProduct(null);
    }
    setError("");
  };

  const handleSearch = async () => {
    if (!form.productCode.trim()) {
      setError("Ingresa el código del producto.");
      return;
    }
    setIsSearching(true);
    setError("");
    setSelectedProduct(null);
    try {
      const matches = await searchProductsByCode(request, form.productCode);
      if (matches.length === 0) {
        setError("No encontramos un producto con ese código.");
      } else {
        setSelectedProduct(matches[0]);
        setForm((current) => ({ ...current, variantId: "" }));
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "No se pudo buscar el producto.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return setError("Busca un producto.");
    if (!form.variantId) return setError("Selecciona una variante y talla.");
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return setError("La cantidad debe ser mayor que cero.");
    if (!form.typeId) return setError("Selecciona el tipo de incidencia.");

    const payload = {
      productId: Number(form.variantId),
      productInventoryIssueTypeId: Number(form.typeId),
      quantity,
      issueDate: new Date().toISOString(),
      ...(form.comments.trim() ? { comments: form.comments.trim() } : {}),
    };
    setIsSaving(true);
    setError("");
    try {
      await createInventoryIssue(request, payload);
      onCreated();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la incidencia.");
    } finally {
      setIsSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation">
    <form aria-labelledby="create-issue-title" aria-modal="true" className="min-w-0 max-h-[92dvh] w-full max-w-2xl overflow-x-hidden overflow-y-auto rounded-2xl border border-pw-line bg-white p-5 shadow-2xl sm:p-6" role="dialog" onSubmit={handleSubmit}>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.08em] text-pw-brand-deep">Inventario</p><h2 className="mt-1 text-xl font-extrabold text-pw-ink" id="create-issue-title">Nueva incidencia</h2></div>
        <button aria-label="Cerrar nueva incidencia" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-2xl text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={onClose}>×</button>
      </div>
      <div className="mt-5 grid gap-4">
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-end">
          <label className="grid gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="create-product-code">Código del producto<input className="min-h-11 w-full min-w-0 rounded-lg border border-pw-line px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="create-product-code" inputMode="numeric" type="search" value={form.productCode} onChange={(event) => updateForm("productCode", event.target.value)} /></label>
          <button className="min-h-11 w-full shrink-0 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={isSearching} type="button" onClick={() => void handleSearch()}>{isSearching ? "Buscando…" : "Buscar"}</button>
        </div>
        {selectedProduct ? <div className="flex min-w-0 items-center gap-3 rounded-xl border border-pw-line bg-pw-canvas p-3">
          {productImage ? <img className="h-12 w-12 shrink-0 rounded-lg bg-pw-brand-soft object-cover" src={productImage} alt={"Imagen de " + selectedProduct.name} /> : <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-pw-brand-soft text-pw-brand-deep">✦</span>}
          <div className="min-w-0"><p className="truncate text-sm font-extrabold text-pw-ink" title={selectedProduct.name}>{selectedProduct.name}</p><p className="mt-1 truncate text-xs text-pw-muted">Código {selectedProduct.code} · Proveedor {selectedProduct.supplierProductCode || "Sin código"}</p></div>
        </div> : null}
        {selectedProduct ? <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="create-issue-variant">Variante y talla<SelectControl aria-label="Variante y talla" id="create-issue-variant" value={form.variantId} options={variantOptions} portal onChange={(event) => updateForm("variantId", event.target.value)} /></label> : null}
        <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-end">
          <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="create-issue-type">Tipo de incidencia<SelectControl aria-label="Tipo de incidencia" id="create-issue-type" value={form.typeId} options={typeOptions} portal onChange={(event) => updateForm("typeId", event.target.value)} /></label>
          <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="create-issue-quantity">Cantidad<input className="min-h-11 w-full min-w-0 rounded-lg border border-pw-line px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="create-issue-quantity" min="1" type="number" value={form.quantity} onChange={(event) => updateForm("quantity", event.target.value)} /></label>
        </div>
        <label className="grid gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="create-issue-comments">Comentarios<textarea className="min-h-24 w-full min-w-0 rounded-lg border border-pw-line px-3 py-2 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="create-issue-comments" value={form.comments} onChange={(event) => updateForm("comments", event.target.value)} /></label>
        {error ? <p aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p> : null}
      </div>
      <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={onClose}>Cancelar</button>
        <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Creando…" : "Crear incidencia"}</button>
      </div>
    </form>
  </div>;
}
