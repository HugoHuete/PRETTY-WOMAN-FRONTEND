import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { FilterBar } from "../../shared/ui/filter-bar";
import { Pagination } from "../../shared/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import { useToast } from "../../shared/ui/toast-context";
import {
  buildProductsPath,
  defaultProductFilters,
  formatProductPrice,
  productAvailability,
  productAvailabilityLabel,
  productAvailabilityTone,
  productPresentationLabel,
  productSizeCount,
  productTotals,
  type PaginatedProducts,
  type ProductCategory,
  type ProductDTO,
  type ProductFilters,
  type ProductSize,
} from "./product-types";

type ProductLoadError = { detail: string; forbidden: boolean };

function filtersFromSearchParams(params: URLSearchParams): ProductFilters {
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  return {
    ...defaultProductFilters,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20,
    availability: params.get("availability") ?? "",
    code: params.get("code") ?? "",
    categoryId: params.get("categoryId") ?? "",
    subcategoryId: params.get("subcategoryId") ?? "",
    sizeId: params.get("sizeId") ?? "",
  };
}

async function problemDetail(response: Response, fallback: string) {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };
    return problem.detail ?? problem.title ?? fallback;
  } catch {
    return fallback;
  }
}

function searchParamsFromFilters(filters: ProductFilters) {
  return buildProductsPath(filters).slice("/api/v1/products?".length);
}

async function exportProducts(
  request: ReturnType<typeof useAuth>["request"],
  filters: ProductFilters,
  setIsExporting: (value: boolean) => void,
  showToast: ReturnType<typeof useToast>["showToast"],
) {
  setIsExporting(true);
  try {
    const response = await request("/api/v1/products/export?" + searchParamsFromFilters(filters));
    if (!response.ok) {
      showToast({
        tone: "error",
        title: "No pudimos exportar los productos",
        detail: await problemDetail(response, "Intenta nuevamente en unos segundos."),
      });
      return;
    }

    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "productos.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    showToast({
      tone: "error",
      title: "No pudimos exportar los productos",
      detail: "Intenta nuevamente en unos segundos.",
    });
  } finally {
    setIsExporting(false);
  }
}
export function ProductsPage() {
  const { request } = useAuth();
  const { showToast } = useToast();
  const { setAction, setHeading } = usePageActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const [products, setProducts] = useState<PaginatedProducts | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ProductLoadError | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const productRequestId = useRef(0);

  useEffect(() => {
    setHeading({ title: "Productos", breadcrumbs: "Inventario" });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    setAction(
      <button
        className="inline-flex min-h-11 items-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
        type="button"
        disabled={isExporting}
        onClick={() => void exportProducts(request, filters, setIsExporting, showToast)}
      >
        {isExporting ? "Preparando Excel…" : "Descargar Excel"}
      </button>,
    );
    return () => setAction(null);
  }, [filters, isExporting, request, setAction, showToast]);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      const [categoryResponse, sizeResponse] = await Promise.all([
        request("/api/v1/categories"),
        request("/api/v1/sizes"),
      ]);
      if (!active) return;
      if (categoryResponse.ok) setCategories((await categoryResponse.json()) as ProductCategory[]);
      if (sizeResponse.ok) setSizes((await sizeResponse.json()) as ProductSize[]);
    };
    void loadOptions().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    const requestId = ++productRequestId.current;
    const loadProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await request(buildProductsPath(filters));
        if (!response.ok) {
          if (requestId === productRequestId.current) {
            setError({ detail: await problemDetail(response, "No se pudieron cargar los productos."), forbidden: response.status === 403 });
          }
          return;
        }
        const result = (await response.json()) as PaginatedProducts;
        if (requestId === productRequestId.current) setProducts(result);
      } catch {
        if (requestId === productRequestId.current) setError({ detail: "No se pudieron cargar los productos.", forbidden: false });
      } finally {
        if (requestId === productRequestId.current) setIsLoading(false);
      }
    };
    void loadProducts();
  }, [filters, request, retryVersion]);

  useEffect(() => {
    if (!selectedProduct) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedProduct(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedProduct]);

  const updateFilters = (next: ProductFilters) => setSearchParams(searchParamsFromFilters(next));
  const changeFilter =
    (key: keyof Pick<ProductFilters, "availability" | "code" | "categoryId" | "sizeId">) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => updateFilters({ ...filters, [key]: event.target.value, page: 1 });
  const clearFilters = () => updateFilters(defaultProductFilters);
  const hasActiveFilters = Boolean(filters.availability || filters.code || filters.categoryId || filters.subcategoryId || filters.sizeId);

  return (
    <div className="space-y-5">
      <FilterBar aria-label="Filtros de productos" onSubmit={(event) => event.preventDefault()}>
        <label className="grid min-w-48 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="product-code">
          Código o referencia
          <input className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="product-code" inputMode="numeric" placeholder="Ej. 1042" type="search" value={filters.code} onChange={changeFilter("code")} />
        </label>
        <label className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="product-category">
          Categoría
          <SelectControl aria-label="Categoría" id="product-category" searchable searchPlaceholder="Buscar categoría…" value={filters.categoryId} options={[{ value: "", label: "Todas" }, ...categories.map((category) => ({ value: String(category.id), label: category.name }))]} onChange={changeFilter("categoryId")} />
        </label>
        <label className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="product-size">
          Talla
          <SelectControl aria-label="Talla" id="product-size" searchable searchPlaceholder="Buscar talla…" value={filters.sizeId} options={[{ value: "", label: "Todas" }, ...sizes.map((size) => ({ value: String(size.id), label: size.name }))]} onChange={changeFilter("sizeId")} />
        </label>
        <label className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="product-availability">
          Disponibilidad
          <SelectControl aria-label="Disponibilidad" id="product-availability" value={filters.availability} options={[{ value: "", label: "Todos" }, { value: "1", label: "Disponible" }, { value: "2", label: "Reservado" }, { value: "3", label: "No disponible" }]} onChange={changeFilter("availability")} />
        </label>
        {hasActiveFilters ? <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={clearFilters}>Limpiar filtros</button> : null}
      </FilterBar>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error?.forbidden ? <ErrorState title="Acceso restringido" description="No tienes permiso para ver los productos." /> : null}
      {!isLoading && error && !error.forbidden ? <ErrorState title="No pudimos cargar los productos" description={error.detail} onRetry={() => setRetryVersion((version) => version + 1)} /> : null}
      {!isLoading && !error && products?.totalCount === 0 ? <EmptyState title={hasActiveFilters ? "No hay productos que coincidan" : "Aún no hay productos"} description={hasActiveFilters ? "Prueba con otros filtros o restablece los valores." : "Los productos aparecerán aquí cuando estén registrados en el catálogo."} action={hasActiveFilters ? <button className="min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep" type="button" onClick={clearFilters}>Limpiar filtros</button> : undefined} /> : null}
      {!isLoading && !error && products && products.totalCount > 0 ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite" className="text-sm text-pw-muted"><strong className="text-pw-ink">{products.totalCount} {products.totalCount === 1 ? "producto" : "productos"}</strong> en el catálogo</p>
            <p className="text-xs text-pw-muted">Cada color se gestiona como una presentación</p>
          </div>
          <ProductsTable products={products.items} onSelect={setSelectedProduct} />
          <Pagination page={products.page} totalPages={products.totalPages} onPageChange={(page) => updateFilters({ ...filters, page })} />
        </>
      ) : null}
      {selectedProduct ? <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} /> : null}
    </div>
  );
}

function ProductsTable({ products, onSelect }: { products: ProductDTO[]; onSelect: (product: ProductDTO) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-pw-line bg-white">
      <table className="min-w-[900px] border-collapse text-left text-sm">
        <caption className="sr-only">Productos agrupados por producto, con sus presentaciones y disponibilidad.</caption>
        <thead className="bg-pw-brand-soft text-[0.8125rem] uppercase tracking-[0.045em] text-pw-ink">
          <tr>
            {['Producto', 'Código', 'Presentaciones', 'Tallas', 'Precio desde', 'Disponible', 'Estado'].map((header) => <th className="border-b border-pw-brand/35 px-4 py-3.5 font-extrabold" scope="col" key={header}>{header}</th>)}
            <th className="border-b border-pw-brand/35 px-4 py-3.5 font-extrabold" scope="col"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pw-line">
          {products.map((product) => {
            const totals = productTotals(product);
            const availability = productAvailability(product);
            return (
              <tr className="hover:bg-pw-brand-soft/40" key={product.id}>
                <td className="px-4 py-3"><div className="flex min-w-52 items-center gap-3"><ProductImage alt="" src={product.primaryImageUrl} /><span className="min-w-0"><strong className="block truncate">{product.name}</strong><span className="block text-xs text-pw-muted">{product.categoryName ?? "Sin categoría"} · {product.subcategoryName ?? "Sin subcategoría"}</span></span></div></td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-pw-muted">{product.code}</td>
                <td className="px-4 py-3"><button className="font-extrabold text-pw-brand-deep underline underline-offset-4" type="button" onClick={() => onSelect(product)}>{productPresentationLabel(product.presentations.length)}</button><span className="mt-1 block max-w-44 truncate text-xs text-pw-muted">{product.presentations.map((presentation) => presentation.name ?? "Sin nombre").join(" · ")}</span></td>
                <td className="whitespace-nowrap px-4 py-3">{productSizeCount(product)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold">{lowestProductPrice(product)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-extrabold text-green-800">{totals.available}</td>
                <td className="px-4 py-3"><StatusBadge tone={productAvailabilityTone(availability)}>{productAvailabilityLabel(availability)}</StatusBadge></td>
                <td className="px-4 py-3"><button aria-label={`Ver presentaciones de ${product.name}`} className="min-h-10 rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={() => onSelect(product)}>Ver detalle</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function lowestProductPrice(product: ProductDTO) {
  const prices = product.presentations.flatMap((presentation) => presentation.sizes.map((size) => size.discountedSalePrice ?? size.salePrice));
  return prices.length ? formatProductPrice(Math.min(...prices)) : "Sin precio";
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  return src ? <img alt={alt} className="h-12 w-10 rounded-lg bg-pw-brand-soft object-cover" src={src} /> : <span aria-hidden="true" className="grid h-12 w-10 place-items-center rounded-lg bg-pw-brand-soft text-lg text-pw-brand-deep">✦</span>;
}

function ProductDetail({ product, onClose }: { product: ProductDTO; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const totals = productTotals(product);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div aria-label={product.name} aria-modal="true" className="max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-pw-line bg-white shadow-2xl" role="dialog">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-pw-line bg-white px-5 py-4 sm:px-6">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.08em] text-pw-brand-deep">Detalle del producto</p><h2 className="mt-1 text-xl font-extrabold text-pw-ink">{product.name}</h2><p className="mt-1 text-sm text-pw-muted">Código {product.code} · {product.categoryName ?? "Sin categoría"}</p></div>
          <button ref={closeRef} aria-label="Cerrar detalle del producto" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-2xl text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={onClose}>×</button>
        </header>
        <section className="grid gap-4 border-b border-pw-line bg-pw-canvas px-5 py-4 sm:grid-cols-3 sm:px-6" aria-label="Resumen de existencias"><Stat label="Presentaciones" value={String(product.presentations.length)} /><Stat label="Disponible" value={String(totals.available)} /><Stat label="Reservado" value={String(totals.reserved)} /></section>
        <div className="space-y-5 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-extrabold text-pw-ink">Presentaciones por color</h3><span className="text-sm text-pw-muted">{productPresentationLabel(product.presentations.length)}</span></div><div className="grid gap-4 md:grid-cols-2">{product.presentations.map((presentation) => <PresentationCard key={presentation.id} presentation={presentation} />)}</div></div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-xs font-bold text-pw-muted">{label}</span><strong className="mt-1 block text-lg text-pw-ink">{value}</strong></div>;
}

function PresentationCard({ presentation }: { presentation: ProductDTO["presentations"][number] }) {
  const totals = presentation.sizes.reduce((result, size) => ({ available: result.available + size.availableQuantity, reserved: result.reserved + size.reservedQuantity }), { available: 0, reserved: 0 });
  return (
    <article className="overflow-hidden rounded-xl border border-pw-line bg-white">
      <header className="flex items-center gap-3 border-b border-pw-line bg-pw-brand-soft/45 px-4 py-3"><ProductImage alt="" src={presentation.primaryImageUrl} /><div><h4 className="font-extrabold text-pw-ink">{presentation.name ?? "Presentación sin nombre"}</h4><p className="mt-1 text-xs text-pw-muted">Disponible: <strong className="text-green-800">{totals.available}</strong> · Reservado: <strong className="text-amber-800">{totals.reserved}</strong></p></div></header>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><caption className="sr-only">Tallas de la presentación {presentation.name ?? "sin nombre"}</caption><thead className="text-xs uppercase tracking-[0.04em] text-pw-muted"><tr><th className="px-4 py-2.5 font-extrabold" scope="col">Talla</th><th className="px-4 py-2.5 font-extrabold" scope="col">Precio</th><th className="px-4 py-2.5 font-extrabold" scope="col">Disponible</th><th className="px-4 py-2.5 font-extrabold" scope="col">Reservado</th></tr></thead><tbody className="divide-y divide-pw-line">{presentation.sizes.map((size) => <tr key={size.id}><td className="px-4 py-2.5 font-extrabold">Talla {size.sizeName ?? "sin definir"}</td><td className="px-4 py-2.5">{formatProductPrice(size.discountedSalePrice ?? size.salePrice)}</td><td className="px-4 py-2.5 font-bold text-green-800">{size.availableQuantity}</td><td className="px-4 py-2.5 font-bold text-amber-800">{size.reservedQuantity}</td></tr>)}</tbody></table></div>
    </article>
  );
}