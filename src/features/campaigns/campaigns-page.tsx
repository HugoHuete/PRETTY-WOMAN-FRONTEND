import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type RefObject } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { FilterBar } from "../../shared/ui/filter-bar";
import { LoadingButton } from "../../shared/ui/loading-button";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { Pagination } from "../../shared/ui/pagination";
import { SelectControl } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import { useToast } from "../../shared/ui/toast-context";
import { formatProductPrice, type ProductDTO } from "../products/product-types";
import { buildCampaignCsvTemplate, buildCampaignPayload, parseCampaignCsv, type CampaignCsvDelimiter, type CampaignImportRow, type CampaignLineInput, type DiscountType } from "./campaigns-api";

type AuthRequest = (path: string, init?: RequestInit) => Promise<Response>;
type CampaignSummary = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  statusId: number;
  statusName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CampaignProduct = {
  id?: number;
  productId?: number | null;
  productPresentationId?: number | null;
  productName?: string | null;
  productCode?: number | null;
  presentationName?: string | null;
  sizeName?: string | null;
  variant?: string | null;
  discountTypeId: number;
  discountTypeName?: string | null;
  discountValue: number;
};

type CampaignDetail = CampaignSummary & {
  targets: CampaignProduct[];
};

type CampaignCsvPreview = {
  fileName: string;
  text: string;
  rows: CampaignImportRow[];
  errors: string[];
};
type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type FormValues = {
  name: string;
  startDate: string;
  endDate: string;
};

type CampaignLine = {
  key: string;
  groupId?: number;
  productId?: number;
  productPresentationId?: number;
  productCode?: number;
  imageUrl?: string | null;
  label: string;
  detail: string;
  discountTypeId: number;
  discountValue: number;
  estimateVariants?: CampaignEstimateVariant[];
  resolutionError?: string;
};

type CampaignEstimateVariant = {
  key: string;
  label: string;
  currentPrice: number | null;
  salePrice: number | null;
  unitCostNio: number | null;
};

type TargetOption = {
  key: string;
  groupId?: number;
  productId?: number;
  productPresentationId?: number;
  productCode?: number;
  imageUrl?: string | null;
  label: string;
  detail: string;
  displayLabel?: string;
  estimateVariants?: CampaignEstimateVariant[];
};

type CampaignAction = { id: number; type: "cancel" | "reactivate" } | null;

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "1", label: "Programadas" },
  { value: "2", label: "Activas" },
  { value: "3", label: "Finalizadas" },
  { value: "4", label: "Canceladas" },
];

const discountTypeOptions = [
  { value: "1", label: "Monto fijo" },
  { value: "2", label: "Porcentaje" },
  { value: "3", label: "Precio final" },
];

function valueOf(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-NI", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function statusLabel(statusId: number, statusName?: string | null) {
  const name = valueOf(statusName);
  const localizedName: Record<string, string> = { active: "Activa", scheduled: "Programada", finished: "Finalizada", completed: "Finalizada", cancelled: "Cancelada", canceled: "Cancelada" };
  return localizedName[name.toLocaleLowerCase()] || name || ({ 1: "Programada", 2: "Activa", 3: "Finalizada", 4: "Cancelada" }[statusId] ?? "Sin estado");
}

function statusTone(statusId: number): "success" | "warning" | "danger" | "info" | "neutral" {
  return ({ 1: "info", 2: "success", 3: "neutral", 4: "danger" }[statusId] ?? "neutral") as "success" | "warning" | "danger" | "info" | "neutral";
}

function campaignPath(page: number, status: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) params.set("status", status);
  return `/api/v1/discountcampaigns?${params.toString()}`;
}

async function campaignsAcrossPages(request: AuthRequest, status: string) {
  const firstPage = await requestJson<Paginated<CampaignSummary>>(request, campaignPath(1, status));
  const remainingPages = await Promise.all(Array.from(
    { length: Math.max(0, firstPage.totalPages - 1) },
    (_, index) => requestJson<Paginated<CampaignSummary>>(request, campaignPath(index + 2, status)),
  ));
  return [firstPage, ...remainingPages].flatMap((result) => result.items ?? []);
}

async function responseError(response: Response, fallback = "No se pudo completar la solicitud.") {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };
    return problem.detail ?? problem.title ?? fallback;
  } catch {
    return fallback;
  }
}

async function requestJson<T>(request: AuthRequest, path: string, init?: RequestInit) {
  const response = init ? await request(path, init) : await request(path);
  if (!response.ok) throw new Error(await responseError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function detailTarget(item: CampaignProduct): TargetOption {
  const base = valueOf(item.productName) || (item.productId ? `Producto #${item.productId}` : "Destino de campaña");
  const label = item.productPresentationId
    ? `${base} · ${valueOf(item.presentationName) || "Presentación"}`
    : base;
  return {
    key: item.productPresentationId ? `presentation-${item.productPresentationId}` : `product-${item.productId}`,
    groupId: item.productId ?? undefined,
    productId: item.productPresentationId ? undefined : item.productId ?? undefined,
    productPresentationId: item.productPresentationId ?? undefined,
    productCode: item.productCode ?? undefined,
    label,
    detail: item.productPresentationId
      ? `Presentación ${valueOf(item.presentationName) || "específica"}`
      : "Producto completo",
  };
}

function campaignTargetsOverlap(left: CampaignLine, right: CampaignLine) {
  const sameProduct = Boolean(
    (left.groupId !== undefined && right.groupId !== undefined && left.groupId === right.groupId)
    || (left.productId !== undefined && right.productId !== undefined && left.productId === right.productId)
    || (left.productCode !== undefined && right.productCode !== undefined && left.productCode === right.productCode)
    || (left.productPresentationId !== undefined && right.productPresentationId !== undefined && left.productPresentationId === right.productPresentationId),
  );
  if (!sameProduct) return false;
  if (left.productPresentationId === undefined || right.productPresentationId === undefined) return true;
  return left.productPresentationId === right.productPresentationId;
}

function duplicateCampaignTargetErrors(lines: CampaignLine[]) {
  const duplicateProducts = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < lines.length; otherIndex += 1) {
      if (!campaignTargetsOverlap(lines[index], lines[otherIndex])) continue;
      const productCode = lines[index].productCode ?? lines[otherIndex].productCode;
      duplicateProducts.add(productCode === undefined ? "el mismo producto" : `el producto código ${productCode}`);
    }
  }
  return [...duplicateProducts].map((product) => `${product[0].toLocaleUpperCase()}${product.slice(1)} ya está incluido en la campaña. Quita uno de los destinos antes de guardar.`);
}

function lineFromTarget(target: TargetOption, current?: CampaignProduct): CampaignLine {
  return {
    ...target,
    discountTypeId: (current?.discountTypeId as DiscountType | undefined) ?? 1,
    discountValue: current?.discountValue ?? 0,
  };
}

function estimatesForProduct(product: ProductDTO, presentationId?: number): CampaignEstimateVariant[] {
  return product.presentations
    .filter((presentation) => presentationId === undefined || presentation.id === presentationId)
    .flatMap((presentation) => presentation.sizes.map((variant) => ({
      key: `${presentation.id}-${variant.id}`,
      label: [presentation.name, variant.sizeName].filter(Boolean).join(" · ") || "Sin variante",
      currentPrice: numericPrice(variant.discountedSalePrice) ?? numericPrice(variant.salePrice),
      salePrice: numericPrice(variant.salePrice),
      unitCostNio: numericPrice(variant.unitCostNio),
    })));
}

function numericPrice(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function productImage(product: ProductDTO, presentationId?: number) {
  const presentation = presentationId === undefined
    ? undefined
    : product.presentations.find((item) => item.id === presentationId);
  return presentation?.primaryImageUrl
    ?? product.primaryImageUrl
    ?? product.presentations.find((item) => item.primaryImageUrl)?.primaryImageUrl
    ?? null;
}

function discountedPrice(salePrice: number, discountTypeId: number, discountValue: number) {
  if (discountTypeId === 2) return Math.max(0, salePrice * (1 - discountValue / 100));
  if (discountTypeId === 3) return discountValue;
  return Math.max(0, salePrice - discountValue);
}

async function productsByCodes(request: AuthRequest, codes: number[]) {
  const results = await Promise.all([...new Set(codes)].map(async (code) => {
    try {
      const result = await requestJson<Paginated<ProductDTO>>(request, `/api/v1/products?page=1&pageSize=1&code=${encodeURIComponent(code)}`);
      return [code, result.items?.[0] ?? null] as const;
    } catch {
      return [code, null] as const;
    }
  }));
  return new Map(results);
}

async function productsByIds(request: AuthRequest, ids: number[]) {
  const results = await Promise.all([...new Set(ids)].map(async (id) => {
    try {
      const product = await requestJson<ProductDTO>(request, `/api/v1/products/${id}`);
      return [id, product] as const;
    } catch {
      return [id, null] as const;
    }
  }));
  return new Map(results);
}

function CampaignDirectory({ request }: { request: AuthRequest }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState<Paginated<CampaignSummary> | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CampaignSummary[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [action, setAction] = useState<CampaignAction>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const status = searchParams.get("status") ?? "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void requestJson<Paginated<CampaignSummary>>(request, campaignPath(page, status), undefined)
      .then((next) => { if (active) setResult(next); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las campañas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, request, retry, status]);

  useEffect(() => {
    let active = true;
    const query = search.trim();
    if (!query) {
      setSearchResults(null);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    setSearchResults(null);
    setSearchLoading(true);
    setSearchError(null);
    const timeout = window.setTimeout(() => {
      void campaignsAcrossPages(request, status)
        .then((items) => { if (active) setSearchResults(items); })
        .catch((reason: unknown) => {
          if (active) setSearchError(reason instanceof Error ? reason.message : "No se pudieron buscar las campañas.");
        })
        .finally(() => { if (active) setSearchLoading(false); });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [request, retry, search, status]);

  const visibleCampaigns = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const items = query ? searchResults ?? [] : result?.items ?? [];
    const matching = query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
    return query ? matching.slice((page - 1) * 20, page * 20) : matching;
  }, [page, result?.items, search, searchResults]);
  const matchingCount = search.trim()
    ? (searchResults ?? []).filter((item) => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).length
    : result?.totalCount ?? 0;
  const visibleError = error ?? searchError;
  const waitingForSearch = Boolean(search.trim() && (searchLoading || searchResults === null) && !searchError);
  const visiblePages = search.trim() ? Math.max(1, Math.ceil(matchingCount / 20)) : result?.totalPages ?? 1;

  const mutateStatus = async () => {
    if (!action) return;
    try {
      await requestJson<void>(request, `/api/v1/discountcampaigns/${action.id}/${action.type}`, { method: "PATCH" });
      showToast({ tone: "success", title: action.type === "cancel" ? "Campaña cancelada" : "Campaña reactivada", detail: "El estado se actualizó correctamente." });
      setAction(null);
      setRetry((value) => value + 1);
    } catch (reason: unknown) {
      showToast({ tone: "error", title: "No se pudo actualizar la campaña", detail: reason instanceof Error ? reason.message : undefined });
    }
  };

  const activeFilter = Boolean(search.trim() || status);
  return <div className="space-y-5">
    <FilterBar aria-label="Filtros de campañas" onSubmit={(event) => event.preventDefault()}>
      <label className="grid min-w-52 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="campaign-search">
        Buscar campañas
        <input aria-label="Buscar campañas" className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="campaign-search" placeholder="Nombre de campaña" type="search" value={search} onChange={(event) => { setSearch(event.target.value); if (page !== 1) setSearchParams({ page: "1", pageSize: "20", ...(status ? { status } : {}) }); }} />
      </label>
      <label className="grid min-w-52 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="campaign-status">
        Estado
        <SelectControl aria-label="Estado de campaña" id="campaign-status" value={status} options={statusOptions} onChange={(event) => setSearchParams({ page: "1", pageSize: "20", ...(event.target.value ? { status: event.target.value } : {}) })} />
      </label>
      {activeFilter ? <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas" type="button" onClick={() => { setSearch(""); setSearchParams({ page: "1", pageSize: "20" }); }}>Limpiar filtros</button> : null}
    </FilterBar>

    {loading ? <LoadingState /> : null}
    {!loading && visibleError ? <ErrorState title="No pudimos cargar las campañas" description={visibleError} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {!loading && !visibleError && waitingForSearch ? <p aria-live="polite" className="rounded-xl border border-pw-line bg-white p-6 text-center text-sm text-pw-muted">Buscando campañas…</p> : null}
    {!loading && !visibleError && !waitingForSearch && !matchingCount && !search.trim() && !result?.totalCount ? <EmptyState title={activeFilter ? "No hay campañas que coincidan" : "Aún no hay campañas"} description={activeFilter ? "Prueba con otro nombre o estado." : "Crea una campaña para aplicar descuentos a tu catálogo."} action={<button className="min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep" type="button" onClick={() => navigate("/discounts/campaigns/new")}>Crear campaña</button>} /> : null}
    {!loading && !visibleError && !waitingForSearch && (search.trim() ? !matchingCount : Boolean(result?.totalCount)) && !visibleCampaigns.length ? <EmptyState title="No hay campañas que coincidan" description="Prueba con otro nombre o limpia los filtros." /> : null}
    {!loading && !visibleError && !waitingForSearch && visibleCampaigns.length ? <>
      <div className="flex items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-pw-muted"><strong className="text-pw-ink">{matchingCount} {matchingCount === 1 ? "campaña" : "campañas"}</strong> {search.trim() ? "coinciden" : "registradas"}</p></div>
      <div className="w-full overflow-x-auto rounded-xl border border-pw-line bg-white"><table aria-label="Campañas de descuento" className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm"><caption className="sr-only">Directorio de campañas con vigencia, estado y acciones.</caption><colgroup><col className="w-[28%]" /><col className="w-[16%]" /><col className="w-[16%]" /><col className="w-[16%]" /><col className="w-[24%]" /></colgroup><thead className="bg-pw-brand-soft text-xs uppercase text-pw-ink"><tr>{["Campaña", "Inicio", "Fin", "Estado", "Acciones"].map((header) => <th key={header} className="border-b border-pw-brand/35 px-4 py-3.5 font-extrabold" scope="col">{header}</th>)}</tr></thead><tbody className="divide-y divide-pw-line">{visibleCampaigns.map((item) => <tr key={item.id} className="align-middle hover:bg-pw-canvas"><td className="px-4 py-3"><Link aria-label={item.name} className="font-extrabold text-pw-brand-deep underline-offset-2 hover:underline" to={`/discounts/campaigns/${item.id}`}>{item.name}</Link><span className="mt-1 block text-xs text-pw-muted">Actualizada {formatDate(item.updatedAt ?? item.createdAt)}</span></td><td className="px-4 py-3 text-pw-muted">{formatDate(item.startDate)}</td><td className="px-4 py-3 text-pw-muted">{formatDate(item.endDate)}</td><td className="px-4 py-3"><StatusBadge tone={statusTone(item.statusId)}>{statusLabel(item.statusId, item.statusName)}</StatusBadge></td><td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><Link aria-label={`Editar ${item.name}`} className="inline-flex min-h-10 items-center rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-ink hover:bg-pw-canvas" to={`/discounts/campaigns/${item.id}/edit`}>Editar</Link>{item.statusId === 4 ? <button aria-label="Reactivar campaña" className="inline-flex min-h-10 items-center rounded-lg border border-green-200 px-3 text-xs font-extrabold text-green-800 hover:bg-green-50" type="button" onClick={() => setAction({ id: item.id, type: "reactivate" })}>Reactivar</button> : <button aria-label="Cancelar campaña" className="inline-flex min-h-10 items-center rounded-lg border border-red-200 px-3 text-xs font-extrabold text-red-700 hover:bg-red-50" type="button" onClick={() => setAction({ id: item.id, type: "cancel" })}>Cancelar</button>}</div></td></tr>)}</tbody></table></div>
      <Pagination page={page} totalPages={visiblePages} onPageChange={(nextPage) => setSearchParams({ page: String(nextPage), pageSize: "20", ...(status ? { status } : {}) })} />
    </> : null}
    <ConfirmDialog open={Boolean(action)} title={action?.type === "cancel" ? "Cancelar campaña" : "Reactivar campaña"} description={action?.type === "cancel" ? "El descuento dejará de aplicarse, pero la campaña se conservará en el historial." : "La campaña volverá a estar disponible según sus fechas de vigencia."} confirmLabel={action?.type === "cancel" ? "Cancelar campaña" : "Reactivar campaña"} onConfirm={() => void mutateStatus()} onClose={() => setAction(null)} />
  </div>;
}

function ProductPickerDialog({
  open,
  loading,
  error,
  searched,
  products,
  selectedKeys,
  search,
  onSearch,
  onSubmit,
  onToggleMany,
  onClose,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  searched: boolean;
  products: ProductDTO[];
  selectedKeys: Set<string>;
  search: string;
  onSearch: (value: string) => void;
  onSubmit: () => void;
  onToggleMany: (targets: TargetOption[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-pw-ink/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div aria-modal="true" aria-labelledby="campaign-product-picker-title" className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-pw-line bg-white shadow-2xl" role="dialog">
      <header className="flex items-start justify-between gap-4 border-b border-pw-line px-5 py-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-pw-brand-deep">Catálogo</p>
          <h2 className="mt-1 text-xl font-extrabold text-pw-ink" id="campaign-product-picker-title">Agregar productos</h2>
        </div>
        <button aria-label="Cerrar selector de productos" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-xl text-pw-ink hover:bg-pw-brand-soft" type="button" onClick={onClose}>×</button>
      </header>
      <div className="border-b border-pw-line bg-pw-canvas/45 px-5 py-4">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end" role="search">
          <label className="grid flex-1 gap-1.5 text-sm font-extrabold text-pw-ink" htmlFor="campaign-product-search">Código de producto
            <input aria-label="Código de producto" autoFocus className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="campaign-product-search" inputMode="numeric" placeholder="Ej. 1044" type="search" value={search} onChange={(event) => onSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSubmit(); } }} />
          </label>
          <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep" type="button" onClick={onSubmit}>Buscar</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading ? <LoadingState /> : null}
        {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
        {!loading && !error && !searched ? <p className="rounded-lg border border-dashed border-pw-line px-4 py-8 text-center text-sm text-pw-muted">Ingresa el código de un producto para ver sus presentaciones.</p> : null}
        {!loading && !error && searched && !products.length ? <p className="rounded-lg border border-dashed border-pw-line px-4 py-8 text-center text-sm text-pw-muted">No encontramos un producto con ese código.</p> : null}
        {!loading && !error && searched && products.length ? <div className="space-y-3">
          {products.map((product) => {
            const fullTarget: TargetOption = { key: "product-" + product.id, groupId: product.id, productId: product.id, productCode: product.code, imageUrl: productImage(product), label: product.name, detail: "Producto completo", estimateVariants: estimatesForProduct(product) };
            const catalogImage = productImage(product);
            return <div key={product.id} className="rounded-xl border border-pw-line bg-white p-4">
              <div className="flex flex-col gap-4 rounded-lg bg-pw-canvas/45 p-3 sm:flex-row sm:items-start">
                <label className="flex min-w-0 flex-1 items-start gap-3">
                  <input aria-label={"Producto completo: " + product.name} checked={selectedKeys.has(fullTarget.key)} className="mt-1 size-4 shrink-0 accent-pw-brand" type="checkbox" onChange={() => onToggleMany([fullTarget])} />
                  {catalogImage ? <img alt={"Imagen de " + product.name} className="size-16 shrink-0 rounded-lg border border-pw-line bg-white object-cover" src={catalogImage} /> : <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg border border-pw-line bg-white text-lg text-pw-brand-deep">✦</span>}
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold uppercase tracking-[0.08em] text-pw-muted">Producto completo</span>
                    <span className="mt-1 block line-clamp-2 text-sm font-semibold text-pw-ink" title={product.name}>{product.name}</span>
                  </span>
                </label>
                <div className="shrink-0 rounded-lg border border-pw-brand/40 bg-pw-brand-soft px-4 py-2 text-center">
                  <span className="block text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-pw-brand-deep">Código</span>
                  <strong className="mt-1 block text-xl font-extrabold leading-none text-pw-brand-deep">{product.code}</strong>
                </div>
              </div>
              <div className="mt-3 space-y-3 border-t border-pw-line pt-3">
                {product.presentations.map((presentation) => {
const presentationTarget: TargetOption = {
                    key: "presentation-" + presentation.id,
                    groupId: product.id,
                    productPresentationId: presentation.id,
                    productCode: product.code,
                    imageUrl: productImage(product, presentation.id),
                    label: product.name + " · " + (presentation.name ?? "Sin presentación"),
                    detail: "Presentación " + (presentation.name ?? "Sin presentación") + " · " + presentation.sizes.length + (presentation.sizes.length === 1 ? " variante" : " variantes"),
                    displayLabel: presentation.name ?? "Sin presentación",
                    estimateVariants: estimatesForProduct(product, presentation.id),
                  };
                  const presentationSelected = selectedKeys.has(presentationTarget.key);
                  return <div key={presentation.id} className="rounded-lg bg-pw-canvas/55 p-3">
                    <label className="flex min-h-10 items-center gap-3 text-sm font-extrabold text-pw-ink">
                      <input aria-label={"Presentación: " + (presentation.name ?? "Sin presentación")} checked={presentationSelected} className="size-4 accent-pw-brand" disabled={!presentation.sizes.length} type="checkbox" onChange={() => onToggleMany([presentationTarget])} />
                      <span>Presentación · {presentation.name ?? "Sin presentación"}</span>
                      <span className="text-xs font-semibold text-pw-muted">{presentation.sizes.length} {presentation.sizes.length === 1 ? "variante" : "variantes"}</span>
                    </label>
                    <p className="mt-2 border-t border-pw-line/70 px-2 pt-2 text-xs text-pw-muted">Tallas: {presentation.sizes.map((size) => size.sizeName ?? "Sin talla").join(", ") || "Sin tallas"}</p>
                  </div>;                })}
              </div>
            </div>;
          })}
        </div> : null}
      </div>
      <footer className="flex flex-col-reverse gap-3 border-t border-pw-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-pw-muted" aria-live="polite">{selectedKeys.size} seleccionados</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas" type="button" onClick={onClose}>Cerrar</button>
          <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep" type="button" onClick={onConfirm}>Agregar seleccionados</button>
        </div>
      </footer>
    </div>
  </div>;
}
type CampaignCsvImportDialogProps = {
  csvDelimiter: CampaignCsvDelimiter;
  isDragging: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  preview: CampaignCsvPreview | null;
  onApply: () => void;
  onCancel: () => void;
  onDelimiterChange: (delimiter: CampaignCsvDelimiter) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
  onBrowse: () => void;
};

function CampaignCsvImportDialog({
  csvDelimiter,
  isDragging,
  inputRef,
  returnFocusRef,
  preview,
  onApply,
  onCancel,
  onDelimiterChange,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFileChange,
  onDownloadTemplate,
  onBrowse,
}: CampaignCsvImportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const restoreTarget = returnFocusRef.current;
    firstFocusableRef.current?.focus();
    const dialog = dialogRef.current;
    const getFocusableElements = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = getFocusableElements();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      (restoreTarget ?? previousActiveElement)?.focus();
    };
  }, [returnFocusRef]);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-pw-ink/40 p-4" role="presentation">
    <div ref={dialogRef} className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-pw-line bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="campaign-csv-title">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-pw-brand-deep">Campañas</p>
          <h2 id="campaign-csv-title" className="text-xl font-extrabold text-pw-ink">Importar descuentos desde CSV</h2>
        </div>
        <button ref={firstFocusableRef} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-lg text-pw-muted hover:bg-pw-brand-soft hover:text-pw-ink" type="button" aria-label="Cerrar importación CSV" onClick={onCancel}>×</button>
      </header>

      <fieldset className="mt-5 grid gap-3">
        <legend className="text-sm font-semibold text-pw-ink">Separador del CSV</legend>
        <div className="flex flex-wrap gap-3">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-pw-line px-3 text-sm text-pw-ink hover:bg-pw-brand-soft">
            <input type="radio" name="campaign-csv-delimiter" checked={csvDelimiter === ","} onChange={() => onDelimiterChange(",")} />
            Coma (,)
          </label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-pw-line px-3 text-sm text-pw-ink hover:bg-pw-brand-soft">
            <input type="radio" name="campaign-csv-delimiter" checked={csvDelimiter === ";"} onChange={() => onDelimiterChange(";")} />
            Punto y coma (;)
          </label>
        </div>
      </fieldset>

      <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" aria-label="Archivo CSV de descuentos" onChange={onFileChange} />
      <div
        className={"mt-5 grid min-h-36 cursor-pointer place-items-center rounded-xl border-2 border-dashed p-6 text-center transition " + (isDragging ? "border-pw-brand bg-pw-brand-soft" : "border-pw-line bg-pw-canvas hover:border-pw-brand hover:bg-pw-brand-soft")}
        role="button"
        tabIndex={0}
        aria-label="Zona para soltar el archivo CSV de descuentos"
        onClick={onBrowse}
        onDragOver={(event) => { event.preventDefault(); onDragEnter(); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) onDragLeave(); }}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onBrowse();
          }
        }}
      >
        <div>
          <strong className="block text-base text-pw-ink">Arrastra tu archivo CSV aquí</strong>
          <span className="mt-1 block text-sm text-pw-muted">o selecciona un archivo desde tu equipo</span>
          <span className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted">Seleccionar archivo</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-pw-muted">Usa el mismo separador al guardar tu archivo.</p>
        <button className="min-h-10 shrink-0 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep" type="button" onClick={onDownloadTemplate}>Descargar plantilla</button>
      </div>

      {preview ? <div className="mt-5 rounded-lg border border-pw-line bg-pw-canvas p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-pw-ink">Vista previa de importación</h3>
            <p className="mt-1 text-sm text-pw-muted">{preview.fileName}</p>
          </div>
          <span className="text-sm font-semibold text-pw-ink" role="status">{preview.rows.length} fila{preview.rows.length === 1 ? "" : "s"} válida{preview.rows.length === 1 ? "" : "s"}</span>
        </div>
        {preview.errors.length ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
          <p className="font-semibold">Corrige estas filas para continuar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{preview.errors.map((error, index) => <li key={index + "-" + error}>{error}</li>)}</ul>
        </div> : <p className="mt-3 text-sm text-pw-muted">El archivo está listo para agregar sus productos a la campaña.</p>}
      </div> : null}

      <footer className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-ink" type="button" onClick={onCancel}>Cancelar</button>
        <button className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!preview || preview.errors.length > 0 || !preview.rows.length} onClick={onApply}>Aplicar importación</button>
      </footer>
    </div>
  </div>;
}

function CampaignEstimateCell({ line }: { line: CampaignLine }) {
  if (!line.estimateVariants?.length) {
    return <span className="text-xs text-pw-muted">Costo y precio no disponibles</span>;
  }

  return <div className="min-w-[440px]">
    <div className="grid grid-cols-[minmax(5.5rem,1.2fr)_repeat(4,minmax(4.25rem,1fr))] gap-2 px-2 pb-1 text-[0.65rem] font-semibold text-pw-muted">
      <span>Variante</span>
      <span>Costo</span>
      <span>Precio actual</span>
      <span>Precio campaña</span>
      <span>Ganancia / pérdida</span>
    </div>
    <div className="space-y-1">
    {line.estimateVariants.map((variant) => {
      const price = variant.salePrice === null ? null : discountedPrice(variant.salePrice, line.discountTypeId, line.discountValue);
      const margin = price === null || variant.unitCostNio === null ? null : price - variant.unitCostNio;
      const isProfit = margin !== null && margin >= 0;
      return <div key={variant.key} className="grid grid-cols-[minmax(5.5rem,1.2fr)_repeat(4,minmax(4.25rem,1fr))] items-center gap-2 rounded-md bg-pw-canvas/70 px-2 py-1.5 text-xs">
        <strong className="truncate text-pw-ink" title={variant.label}>{variant.label}</strong>
        <span className="font-semibold text-pw-ink">{variant.unitCostNio === null ? "No disponible" : formatProductPrice(variant.unitCostNio)}</span>
        <span className="font-semibold text-pw-ink">{variant.currentPrice === null ? "No disponible" : formatProductPrice(variant.currentPrice)}</span>
        <span className="font-semibold text-pw-ink">{price === null ? "No disponible" : formatProductPrice(price)}</span>
        <span className={"font-extrabold " + (margin === null ? "text-pw-muted" : isProfit ? "text-green-700" : "text-red-700")}>{margin === null ? "No disponible" : formatProductPrice(Math.abs(margin))}</span>
      </div>;
    })}
    </div>
  </div>;
}

function CampaignDetailView({ request, campaignId }: { request: AuthRequest; campaignId: number }) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [targets, setTargets] = useState<CampaignLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void requestJson<CampaignDetail>(request, `/api/v1/discountcampaigns/${campaignId}`)
      .then(async (campaign) => {
        const campaignTargets = campaign.targets ?? [];
        const products = await productsByIds(request, campaignTargets
          .map((target) => target.productId)
          .filter((id): id is number => Number.isFinite(id)));
        if (!active) return;
        setDetail(campaign);
        setTargets(campaignTargets.map((target) => {
          const product = target.productId ? products.get(target.productId) : null;
          return lineFromTarget({
            ...detailTarget(target),
            imageUrl: product ? productImage(product, target.productPresentationId ?? undefined) : null,
            estimateVariants: product ? estimatesForProduct(product, target.productPresentationId ?? undefined) : [],
          }, target);
        }));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la información de la campaña.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [campaignId, request, retry]);

  if (loading || (!error && detail !== null && detail.id !== campaignId)) return <LoadingState />;
  if (error || !detail) return <ErrorState title="No pudimos cargar la campaña" description={error ?? "No encontramos la campaña solicitada."} onRetry={() => { setLoading(true); setError(null); setRetry((value) => value + 1); }} />;

  return <div className="space-y-5">
    <section className="rounded-xl border border-pw-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-extrabold text-pw-ink">{detail.name}</h2>
        <StatusBadge tone={statusTone(detail.statusId)}>{statusLabel(detail.statusId, detail.statusName)}</StatusBadge>
      </div>
      <dl className="mt-5 grid gap-4 border-t border-pw-line pt-4 sm:grid-cols-2">
        <div><dt className="text-xs font-extrabold uppercase text-pw-muted">Fecha inicial</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{formatDate(detail.startDate)}</dd></div>
        <div><dt className="text-xs font-extrabold uppercase text-pw-muted">Fecha final</dt><dd className="mt-1 text-sm font-semibold text-pw-ink">{formatDate(detail.endDate)}</dd></div>
      </dl>
    </section>
    <section className="rounded-xl border border-pw-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-extrabold text-pw-ink">Productos y descuentos</h2>
      {targets.length ? <div className="mt-4 overflow-x-auto rounded-lg border border-pw-line">
        <table aria-label="Productos de la campaña" className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-pw-brand-soft text-xs uppercase text-pw-ink"><tr><th className="px-3 py-3" scope="col">Destino</th><th className="px-3 py-3" scope="col">Tipo de descuento</th><th className="px-3 py-3" scope="col">Valor</th><th className="px-3 py-3" scope="col">Estimación por variante</th></tr></thead>
          <tbody className="divide-y divide-pw-line">{targets.map((target) => {
            const discountType = discountTypeOptions.find((option) => option.value === String(target.discountTypeId))?.label ?? "Descuento";
            const discountValue = target.discountTypeId === 2 ? `${target.discountValue}%` : formatProductPrice(target.discountValue);
            const targetLabel = target.productPresentationId
              ? `Presentación · ${valueOf(target.label.split(" · ").at(-1)) || "Sin nombre"}`
              : "Producto completo";
            return <tr key={target.key}>
              <td className="px-3 py-3"><div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-pw-line bg-pw-canvas">{target.imageUrl ? <img alt={`Producto código ${target.productCode ?? ""}`} className="size-full object-cover" src={target.imageUrl} /> : null}</span>
                <span className="min-w-0"><strong className="block text-pw-brand-deep">Código {target.productCode ?? "—"}</strong><span className="block text-xs text-pw-muted">{targetLabel}</span></span>
              </div></td>
              <td className="px-3 py-3 font-semibold text-pw-ink">{discountType}</td>
              <td className="px-3 py-3 font-extrabold tabular-nums text-pw-ink">{discountValue}</td>
              <td className="px-3 py-3"><CampaignEstimateCell line={target} /></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <p className="mt-4 rounded-lg border border-dashed border-pw-line px-4 py-6 text-center text-sm text-pw-muted">Esta campaña todavía no tiene productos asociados.</p>}
    </section>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas" to="/discounts/campaigns">Regresar a campañas</Link>
    </div>
  </div>;
}

function CampaignForm({ request, campaignId }: { request: AuthRequest; campaignId: number | null }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = campaignId !== null;
  const [values, setValues] = useState<FormValues>({ name: "", startDate: "", endDate: "" });
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [lines, setLines] = useState<CampaignLine[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csvRows, setCsvRows] = useState<CampaignImportRow[]>([]);
  const [csvEstimateLines, setCsvEstimateLines] = useState<CampaignLine[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvImport, setCsvImport] = useState<CampaignCsvPreview | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState<CampaignCsvDelimiter>(";");
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [isResolvingCsv, setIsResolvingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const csvTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(isEdit);
      setError(null);
      try {
        const detail = isEdit ? await requestJson<CampaignDetail>(request, "/api/v1/discountcampaigns/" + campaignId) : null;
        if (!active) return;
        if (detail) {
          setValues({ name: valueOf(detail.name), startDate: dateInputValue(detail.startDate), endDate: dateInputValue(detail.endDate) });
          const targets = detail.targets ?? [];
          const products = await productsByCodes(request, targets.map((item) => item.productCode).filter((code): code is number => Number.isFinite(code)));
          if (!active) return;
          setLines(targets.map((item) => {
            const product = item.productCode ? products.get(item.productCode) : null;
            const target = detailTarget(item);
            return lineFromTarget({
              ...target,
              productCode: item.productCode ?? product?.code,
              imageUrl: product ? productImage(product, item.productPresentationId ?? undefined) : null,
              estimateVariants: product ? estimatesForProduct(product, item.productPresentationId ?? undefined) : [],
            }, item);
          }));
        }
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la información de la campaña.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [campaignId, isEdit, request]);

  const openSelector = () => {
    setShowSelector(true);
    setProductSearch("");
    setProducts([]);
    setSearched(false);
    setCatalogError(null);
  };

  const closeSelector = () => {
    setShowSelector(false);
    setProductSearch("");
  };

  const searchProducts = () => {
    const code = productSearch.trim();
    if (!code) {
      setCatalogError("Escribe el código del producto.");
      setProducts([]);
      setSearched(false);
      return;
    }
    if (!/^\d+$/.test(code)) {
      setCatalogError("El código del producto debe contener solo números.");
      setProducts([]);
      setSearched(false);
      return;
    }
    setProductsLoading(true);
    setCatalogError(null);
    setSearched(true);
    setProducts([]);
    void requestJson<Paginated<ProductDTO>>(request, "/api/v1/products?page=1&pageSize=1&availability=1&code=" + encodeURIComponent(code))
      .then((result) => setProducts(result.items ?? []))
      .catch((reason: unknown) => setCatalogError(reason instanceof Error ? reason.message : "No se pudo buscar el producto."))
      .finally(() => setProductsLoading(false));
  };

  const selectedKeys = useMemo(() => new Set(lines.map((line) => line.key)), [lines]);
  const updateValue = (event: ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  const toggleTargets = (targets: TargetOption[]) => {
    if (!targets.length) return;
    setLines((current) => {
      const targetKeys = new Set(targets.map((target) => target.key));
      const allSelected = targets.every((target) => current.some((line) => line.key === target.key));
      const groupId = targets[0].groupId;
      const isWholeProduct = Boolean(targets[0].productId && !targets[0].productPresentationId);
      const base = current.filter((line) => {
        if (targetKeys.has(line.key)) return false;
        if (!allSelected && isWholeProduct && line.groupId === groupId) return false;
        if (!allSelected && !isWholeProduct && line.groupId === groupId && line.productId && !line.productPresentationId) return false;
        return true;
      });
      return allSelected ? base : [...base, ...targets.map((target) => lineFromTarget(target))];
    });
  };
  const updateLine = (key: string, field: "discountTypeId" | "discountValue", value: string) => setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: field === "discountTypeId" ? Number(value) : Number(value) } : line));
  const updateCsvLine = (key: string, field: "discountTypeId" | "discountValue", value: string) => {
    const index = csvEstimateLines.findIndex((line) => line.key === key);
    if (index < 0) return;
    const numericValue = Number(value);
    setCsvRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: numericValue } : row));
    setCsvEstimateLines((current) => current.map((line) => line.key === key ? { ...line, [field]: numericValue } : line));
  };
  const removeCsvLine = (key: string) => {
    const index = csvEstimateLines.findIndex((line) => line.key === key);
    if (index < 0) return;
    const remainingRows = csvRows.filter((_, rowIndex) => rowIndex !== index);
    setCsvRows(remainingRows);
    setCsvEstimateLines((current) => current.filter((line) => line.key !== key));
    if (!remainingRows.length) setCsvFileName(null);
  };

  const closeCsvImporter = () => {
    setCsvImport(null);
    setIsCsvModalOpen(false);
    setIsDraggingCsv(false);
  };

  const openCsvImporter = () => {
    setCsvImport(null);
    setCsvDelimiter(";");
    setIsCsvModalOpen(true);
  };

  const parseCsvFile = async (file: File) => {
    const text = await file.text();
    setCsvImport({ ...parseCampaignCsv(text, csvDelimiter), fileName: file.name, text });
  };

  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) await parseCsvFile(file);
  };

  const handleCsvDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingCsv(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await parseCsvFile(file);
  };

  const updateCsvDelimiter = (delimiter: CampaignCsvDelimiter) => {
    setCsvDelimiter(delimiter);
    if (csvImport) {
      setCsvImport({ ...parseCampaignCsv(csvImport.text, delimiter), fileName: csvImport.fileName, text: csvImport.text });
    }
  };

  const applyCsvImport = () => {
    if (!csvImport || csvImport.errors.length) return;
    const rows = csvImport.rows;
    setIsResolvingCsv(true);
    setValidation([]);
    setCsvRows(rows);
    setCsvFileName(csvImport.fileName);
    void productsByCodes(request, rows.map((row) => row.productCode)).then((products) => {
      setCsvEstimateLines(rows.map((row, index) => {
        const product = products.get(row.productCode);
        const presentation = product?.presentations.find((item) => item.id === row.productPresentationId);
        const resolutionError = !product
          ? `No encontramos el producto código ${row.productCode}.`
          : row.productPresentationId !== null && !presentation
            ? `No encontramos la presentación ${row.productPresentationId} para el producto código ${row.productCode}.`
            : undefined;
        return {
          key: `csv-${index}-${row.productCode}-${row.productPresentationId ?? "all"}`,
          groupId: product?.id,
          productId: row.productPresentationId === null ? product?.id : undefined,
          productPresentationId: row.productPresentationId ?? undefined,
          productCode: row.productCode,
          imageUrl: product ? productImage(product, row.productPresentationId ?? undefined) : null,
          label: product?.name ?? `Producto · Código ${row.productCode}`,
          detail: row.productPresentationId === null
            ? "Producto completo"
            : `Presentación ${presentation?.name ?? row.productPresentationId}`,
          discountTypeId: row.discountTypeId,
          discountValue: row.discountValue,
          estimateVariants: product ? estimatesForProduct(product, row.productPresentationId ?? undefined) : [],
          resolutionError,
        };
      }));
    }).finally(() => setIsResolvingCsv(false));
    closeCsvImporter();
  };

  const downloadCsvTemplate = () => {
    const template = buildCampaignCsvTemplate(csvDelimiter);
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-campana.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValidation: string[] = [];
    const campaignLines = [...lines, ...csvEstimateLines];
    if (!values.name.trim()) nextValidation.push("Escribe el nombre de la campaña.");
    if (!values.startDate) nextValidation.push("Selecciona la fecha inicial.");
    if (!values.endDate) nextValidation.push("Selecciona la fecha final.");
    if (values.startDate && values.endDate && values.endDate < values.startDate) nextValidation.push("La fecha final debe ser posterior a la fecha inicial.");
    if (!lines.length && !csvRows.length) nextValidation.push("Agrega productos o selecciona un CSV.");
    if (campaignLines.some((line) => !Number.isFinite(line.discountValue) || line.discountValue <= 0)) nextValidation.push("Cada descuento debe tener un valor mayor que cero.");
    if (campaignLines.some((line) => line.discountTypeId === 2 && line.discountValue > 100)) nextValidation.push("El descuento porcentual no puede superar el 100%.");
    if (isResolvingCsv || (csvRows.length > 0 && csvEstimateLines.length !== csvRows.length)) nextValidation.push("Espera a que termine la consulta de los productos del CSV.");
    nextValidation.push(...csvEstimateLines.flatMap((line) => line.resolutionError ? [line.resolutionError] : []));
    nextValidation.push(...duplicateCampaignTargetErrors(campaignLines));
    if (nextValidation.length) { setValidation(nextValidation); return; }

    setValidation([]);
    setIsSubmitting(true);
    const payload = buildCampaignPayload(values, campaignLines as CampaignLineInput[]);
    try {
      await requestJson<void>(request, isEdit ? `/api/v1/DiscountCampaigns/${campaignId}` : "/api/v1/DiscountCampaigns", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      showToast({ tone: "success", title: isEdit ? "Cambios guardados" : "Campaña creada", detail: "La información se guardó correctamente." });
      navigate("/discounts/campaigns");
    } catch (reason: unknown) {
      setValidation([reason instanceof Error ? reason.message : "No se pudo guardar la campaña."]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="No pudimos cargar la campaña" description={error} onRetry={() => window.location.reload()} />;

  return <form className="space-y-5" onSubmit={submit}>
    {validation.length ? <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert"><strong>Revisa la información</strong><ul className="mt-2 list-disc space-y-1 pl-5">{validation.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
    <section className="rounded-xl border border-pw-line bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px] lg:grid-cols-[minmax(0,560px)_180px_180px]"><label className="grid max-w-full gap-1.5 text-sm font-extrabold" htmlFor="campaign-name">Nombre de la campaña<input className="min-h-11 rounded-lg border border-pw-line px-3 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="campaign-name" name="name" required value={values.name} onChange={updateValue} /></label><label className="grid gap-1.5 text-sm font-extrabold" htmlFor="campaign-start">Fecha inicial<input className="min-h-11 rounded-lg border border-pw-line px-3 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="campaign-start" name="startDate" required type="date" value={values.startDate} onChange={updateValue} /></label><label className="grid gap-1.5 text-sm font-extrabold" htmlFor="campaign-end">Fecha final<input className="min-h-11 rounded-lg border border-pw-line px-3 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="campaign-end" name="endDate" required type="date" value={values.endDate} onChange={updateValue} /></label></div></section>
    <section className="rounded-xl border border-pw-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-extrabold">Productos y descuentos</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep" type="button" onClick={openSelector}>Agregar productos</button>
            <button ref={csvTriggerRef} className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas" type="button" onClick={openCsvImporter}>Importar CSV</button>
          </div>
        </div>
        {csvFileName ? <p className="text-xs text-pw-muted sm:text-right">Archivo seleccionado: <strong className="text-pw-ink">{csvFileName}</strong>. Sus productos se incluirán al guardar.</p> : null}
      </div>
      {lines.length ? <div className="mt-5 overflow-x-auto rounded-lg border border-pw-line"><table className="w-full min-w-[1120px] text-left text-sm"><caption className="sr-only">Productos seleccionados para la campaña</caption><thead className="bg-pw-brand-soft text-xs uppercase"><tr><th className="px-3 py-3">Destino</th><th className="px-3 py-3">Tipo de descuento</th><th className="w-[96px] whitespace-nowrap px-2 py-3">Valor</th><th className="px-3 py-3">Estimación por variante</th><th className="px-3 py-3">Acción</th></tr></thead><tbody className="divide-y divide-pw-line">{lines.map((line) => <tr key={line.key}><td className="px-3 py-3"><div className="flex min-w-36 items-center gap-2"><span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-pw-line bg-pw-canvas">{line.imageUrl ? <img alt={`Producto código ${line.productCode ?? ""}`} className="size-full object-cover" src={line.imageUrl} /> : <span aria-hidden="true" className="text-pw-brand-deep">✦</span>}</span><span className="min-w-0"><strong className="block text-pw-brand-deep">Código {line.productCode ?? "—"}</strong><span className="block truncate text-xs text-pw-muted">{line.detail}</span></span></div></td><td className="px-3 py-3"><label className="sr-only" htmlFor={"discount-type-" + line.key}>Tipo de descuento para {line.label}</label><SelectControl id={"discount-type-" + line.key} aria-label={"Tipo de descuento para " + line.label} value={String(line.discountTypeId)} options={discountTypeOptions} portal onChange={(event) => updateLine(line.key, "discountTypeId", event.target.value)} /></td><td className="w-[96px] px-2 py-3"><label className="sr-only" htmlFor={"discount-value-" + line.key}>Valor de descuento para {line.label}</label><input aria-label={"Valor de descuento para " + line.label} className="min-h-11 w-[4.5rem] rounded-lg border border-pw-line px-2 text-sm outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id={"discount-value-" + line.key} min="0.01" step="0.01" type="number" value={line.discountValue || ""} onChange={(event) => updateLine(line.key, "discountValue", event.target.value)} /></td><td className="px-3 py-3"><CampaignEstimateCell line={line} /></td><td className="px-3 py-3"><button className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-extrabold text-red-700 hover:bg-red-50" type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Quitar</button></td></tr>)}</tbody></table></div> : csvRows.length ? null : <p className="mt-5 rounded-lg border border-dashed border-pw-line px-4 py-6 text-center text-sm text-pw-muted">Todavía no has agregado productos a la campaña.</p>}
      {csvRows.length ? <div className="mt-5 overflow-x-auto rounded-lg border border-pw-line"><table className="w-full min-w-[1120px] text-left text-sm"><caption className="sr-only">Estimación de descuentos importados desde CSV</caption><thead className="bg-pw-brand-soft text-xs uppercase"><tr><th className="px-3 py-3">Destino importado</th><th className="px-3 py-3">Tipo de descuento</th><th className="w-[96px] whitespace-nowrap px-2 py-3">Valor</th><th className="px-3 py-3">Estimación por variante</th><th className="px-3 py-3">Acción</th></tr></thead><tbody className="divide-y divide-pw-line">{csvEstimateLines.map((line) => <tr key={line.key}><td className="px-3 py-3"><div className="flex min-w-36 items-center gap-2"><span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-pw-line bg-pw-canvas">{line.imageUrl ? <img alt={`Producto código ${line.productCode ?? ""}`} className="size-full object-cover" src={line.imageUrl} /> : <span aria-hidden="true" className="text-pw-brand-deep">✦</span>}</span><span className="min-w-0"><strong className="block text-pw-brand-deep">Código {line.productCode ?? "—"}</strong><span className="block truncate text-xs text-pw-muted">{line.detail}</span></span></div></td><td className="px-3 py-3"><label className="sr-only" htmlFor={"csv-discount-type-" + line.key}>Tipo de descuento para producto código {line.productCode ?? ""}</label><SelectControl id={"csv-discount-type-" + line.key} aria-label={`Tipo de descuento para producto código ${line.productCode ?? ""}`} value={String(line.discountTypeId)} options={discountTypeOptions} portal onChange={(event) => updateCsvLine(line.key, "discountTypeId", event.target.value)} /></td><td className="w-[96px] px-2 py-3"><label className="sr-only" htmlFor={"csv-discount-value-" + line.key}>Valor de descuento para producto código {line.productCode ?? ""}</label><input aria-label={`Valor de descuento para producto código ${line.productCode ?? ""}`} className="min-h-11 w-[4.5rem] rounded-lg border border-pw-line px-2 text-sm outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id={"csv-discount-value-" + line.key} min="0.01" step="0.01" type="number" value={line.discountValue || ""} onChange={(event) => updateCsvLine(line.key, "discountValue", event.target.value)} /></td><td className="px-3 py-3"><CampaignEstimateCell line={line} /></td><td className="px-3 py-3"><button aria-label={`Quitar producto código ${line.productCode ?? ""}`} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-extrabold text-red-700 hover:bg-red-50" type="button" onClick={() => removeCsvLine(line.key)}>Quitar</button></td></tr>)}</tbody></table></div> : null}
    </section>
    {isCsvModalOpen ? <CampaignCsvImportDialog csvDelimiter={csvDelimiter} isDragging={isDraggingCsv} inputRef={csvInputRef} returnFocusRef={csvTriggerRef} preview={csvImport} onApply={applyCsvImport} onCancel={closeCsvImporter} onDelimiterChange={updateCsvDelimiter} onDragEnter={() => setIsDraggingCsv(true)} onDragLeave={() => setIsDraggingCsv(false)} onDrop={handleCsvDrop} onFileChange={handleCsvFileChange} onDownloadTemplate={downloadCsvTemplate} onBrowse={() => csvInputRef.current?.click()} /> : null}
    {showSelector ? <ProductPickerDialog open={showSelector} loading={productsLoading} error={catalogError} searched={searched} products={products} selectedKeys={selectedKeys} search={productSearch} onSearch={setProductSearch} onSubmit={searchProducts} onToggleMany={toggleTargets} onClose={closeSelector} onConfirm={closeSelector} /> : null}    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas" to="/discounts/campaigns">Cancelar</Link><LoadingButton isLoading={isSubmitting || isResolvingCsv} type="submit">{isEdit ? "Guardar cambios" : "Crear campaña"}</LoadingButton></div>
  </form>;
}

export function CampaignsPage() {
  const { request } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const { pathname } = useLocation();
  const isForm = pathname.endsWith("/new") || pathname.endsWith("/edit");
  const isDetail = /^\/discounts\/campaigns\/\d+$/.test(pathname);
  const campaignId = isForm && pathname.endsWith("/edit") || isDetail
    ? Number(pathname.split("/").at(isDetail ? -1 : -2)) || null
    : null;

  useEffect(() => {
    setHeading({ title: isDetail ? "Detalle de campaña" : isForm ? (campaignId ? "Editar campaña" : "Nueva campaña") : "Campañas", breadcrumbs: isForm || isDetail ? <Link className="underline underline-offset-4 hover:text-pw-brand-deep" to="/discounts/campaigns">← Regresar a campañas</Link> : "Administración" });
    setAction(isDetail && campaignId ? <Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep" to={`/discounts/campaigns/${campaignId}/edit`}>Editar campaña</Link> : isForm ? null : <Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep" to="/discounts/campaigns/new"><span aria-hidden="true" className="mr-1 text-lg leading-none">+</span>Nueva campaña</Link>);
    return () => { setHeading(null); setAction(null); };
  }, [campaignId, isDetail, isForm, setAction, setHeading]);

  return isForm
    ? <CampaignForm campaignId={campaignId} request={request} />
    : isDetail && campaignId
      ? <CampaignDetailView campaignId={campaignId} request={request} />
      : <CampaignDirectory request={request} />;
}
