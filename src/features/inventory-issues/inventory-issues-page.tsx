import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { DataTable, type DataTableColumn } from "../../shared/ui/data-table";
import { SelectControl } from "../../shared/ui/select-control";
import { FilterBar } from "../../shared/ui/filter-bar";
import { Pagination } from "../../shared/ui/pagination";
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from "../../shared/ui/screen-state";
import { StatusBadge } from "../../shared/ui/status-badge";
import { InventoryIssueApiError, loadInventoryIssues } from "./inventory-issue-api";
import { InventoryIssueCreateDialog } from "./inventory-issue-create-dialog";
import {
  defaultInventoryIssueFilters,
  inventoryIssueStatusOptions,
  inventoryIssueStatusTone,
  inventoryIssueTypeOptions,
  type InventoryIssue,
  type InventoryIssueFilters,
} from "./inventory-issue-types";

function filtersFromSearchParams(params: URLSearchParams): InventoryIssueFilters {
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  const type = inventoryIssueTypeOptions.some((option) => option.value === params.get("type")) ? params.get("type") as InventoryIssueFilters["type"] : "";
  const status = inventoryIssueStatusOptions.some((option) => option.value === params.get("status")) ? params.get("status") as InventoryIssueFilters["status"] : "";
  return {
    ...defaultInventoryIssueFilters,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20,
    productCode: params.get("productCode") ?? "",
    type,
    status,
  };
}

function searchParamsFromFilters(filters: InventoryIssueFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  if (filters.productCode.trim()) params.set("productCode", filters.productCode.trim());
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  return params;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
}

function issueColumns(currentSearch: string): DataTableColumn<InventoryIssue>[] {
  return [
    {
      key: "issue",
      header: "Incidencia",
      render: (issue) => <span className="grid gap-1"><strong className="text-pw-ink">INC-{issue.id}</strong></span>,
    },
    {
      key: "product",
      header: "Producto",
      render: (issue) => <span className="grid min-w-0 gap-1"><strong className="block max-w-[18rem] truncate text-pw-ink" title={issue.productName ?? undefined}>{issue.productName ?? "Producto sin nombre"}</strong><span className="text-xs text-pw-muted">Código {issue.productCode ?? "—"}</span></span>,
    },
    {
      key: "variant",
      header: "Variante",
      render: (issue) => issue.variantName ?? "Sin variante",
    },
    {
      key: "size",
      header: "Talla",
      render: (issue) => issue.sizeName ?? "Sin talla",
    },
    { key: "type", header: "Tipo", render: (issue) => issue.typeName },
    { key: "quantity", header: "Cantidad", render: (issue) => <strong>{issue.quantity}</strong> },
    { key: "date", header: "Fecha", render: (issue) => formatDate(issue.reportedAt) },
    { key: "status", header: "Estado", render: (issue) => <StatusBadge tone={inventoryIssueStatusTone(issue.status)}>{issue.statusName}</StatusBadge> },
    {
      key: "action",
      header: "Acción",
      render: (issue) => <Link className="inline-flex min-h-10 items-center rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" to={`/inventory/issues/${issue.id}${currentSearch}`} aria-label={`Ver detalle de INC-${issue.id}`}>Ver detalle</Link>,
    },
  ];
}

export function InventoryIssuesPage() {
  const { request, session } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadInventoryIssues>> | null>(null);
  const [error, setError] = useState<InventoryIssueApiError | Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryVersion, setRetryVersion] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const isAdmin = Boolean(session?.user.roles.includes("Admin"));

  useEffect(() => {
    setHeading({ title: "Incidencias", breadcrumbs: "Inventario" });
    return () => setHeading(null);
  }, [setHeading]);
  useEffect(() => {
    setAction(isAdmin ? <button className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={() => setIsCreateOpen(true)}>Nueva incidencia</button> : null);
    return () => setAction(null);
  }, [isAdmin, setAction]);
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void loadInventoryIssues(request, filters)
      .then((next) => { if (active) setResult(next); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught : new Error("No se pudieron cargar las incidencias.")); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [filters, request, retryVersion]);

  const hasActiveFilters = Boolean(filters.productCode.trim() || filters.type || filters.status);
  const updateFilter = (key: "productCode" | "type" | "status", value: string) => {
    const next = { ...filters, [key]: value, page: 1 } as InventoryIssueFilters;
    setSearchParams(searchParamsFromFilters(next));
  };
  const clearFilters = () => setSearchParams(searchParamsFromFilters(defaultInventoryIssueFilters));
  const handleInput = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => updateFilter(event.target.name as "productCode" | "type" | "status", event.target.value);
  const currentSearch = searchParams.toString() ? `?${searchParams.toString()}` : "";

  if (isLoading) return <LoadingState />;
  if (error instanceof InventoryIssueApiError && error.status === 403) return <PermissionDeniedState />;
  if (error) return <ErrorState title="No pudimos cargar las incidencias" description={error.message} onRetry={() => setRetryVersion((version) => version + 1)} />;
  if (!result || result.totalCount === 0) {
    return <><EmptyState title={hasActiveFilters ? "No hay incidencias que coincidan" : "Aún no hay incidencias"} description={hasActiveFilters ? "Prueba con otros filtros o restablece los valores." : "Las incidencias registradas aparecerán aquí."} action={hasActiveFilters ? <button className="min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={clearFilters}>Limpiar filtros</button> : undefined} />{isCreateOpen && isAdmin ? <InventoryIssueCreateDialog request={request} onClose={() => setIsCreateOpen(false)} onCreated={() => { setIsCreateOpen(false); setRetryVersion((version) => version + 1); }} /> : null}</>;
  }

  return <><div className="space-y-5">
    <FilterBar aria-label="Filtros de incidencias" onSubmit={(event) => event.preventDefault()}>
      <label className="grid min-w-52 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="issue-product-code">Código de producto<input className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="issue-product-code" name="productCode" placeholder="Ej. 1042" type="search" value={filters.productCode} onChange={handleInput} /></label>
      <label className="grid min-w-48 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="issue-type">Tipo<SelectControl aria-label="Tipo" id="issue-type" name="type" value={filters.type} options={[{ value: "", label: "Todos los tipos" }, ...inventoryIssueTypeOptions]} onChange={handleInput} /></label>
      <label className="grid min-w-48 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="issue-status">Estado<SelectControl aria-label="Estado" id="issue-status" name="status" value={filters.status} options={[{ value: "", label: "Todos los estados" }, ...inventoryIssueStatusOptions]} onChange={handleInput} /></label>
      {hasActiveFilters ? <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={clearFilters}>Limpiar filtros</button> : null}
    </FilterBar>
    <p aria-live="polite" className="text-sm text-pw-muted"><strong className="text-pw-ink">{result.totalCount} {result.totalCount === 1 ? "incidencia" : "incidencias"}</strong> encontradas</p>
    <DataTable caption="Incidencias de inventario" columns={issueColumns(currentSearch)} rows={result.items} rowKey={(issue) => String(issue.id)} />
    <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(page) => setSearchParams(searchParamsFromFilters({ ...filters, page }))} />
  </div>{isCreateOpen && isAdmin ? <InventoryIssueCreateDialog request={request} onClose={() => setIsCreateOpen(false)} onCreated={() => { setIsCreateOpen(false); setRetryVersion((version) => version + 1); }} /> : null}</>;;
}
