import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { DataTable, type DataTableColumn } from "../../shared/ui/data-table";
import { FilterBar } from "../../shared/ui/filter-bar";
import { Pagination } from "../../shared/ui/pagination";
import { ErrorState, LoadingState, PermissionDeniedState } from "../../shared/ui/screen-state";
import { SelectControl, type SelectOption } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import { useToast } from "../../shared/ui/toast-context";
import { FinanceApiError } from "./finance-api";
import { LoanFormDialog } from "./loan-form-dialog";
import { loadLoanOwners, loadLoans } from "./loans-api";
import { defaultLoanFilters, loanMaxPageSize, loanPageSize, type Loan, type LoanFilters, type LoanOwner, type PaginatedLoans } from "./loans-types";

function positiveInteger(value: string | null, fallback: number, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function filtersFromParams(params: URLSearchParams): LoanFilters {
  const ownerId = Number(params.get("loanOwnerId"));
  const activeParam = params.get("isActive");
  return {
    page: positiveInteger(params.get("page"), defaultLoanFilters.page),
    pageSize: positiveInteger(params.get("pageSize"), loanPageSize, loanMaxPageSize),
    loanOwnerId: Number.isInteger(ownerId) && ownerId > 0 ? ownerId : null,
    isActive: activeParam === "true" ? true : activeParam === "false" ? false : activeParam === "" ? null : defaultLoanFilters.isActive,
  };
}

function paramsFromFilters(filters: LoanFilters) {
  const params = new URLSearchParams();
  if (filters.page !== 1) params.set("page", String(filters.page));
  if (filters.pageSize !== loanPageSize) params.set("pageSize", String(Math.min(filters.pageSize, loanMaxPageSize)));
  if (filters.loanOwnerId !== null) params.set("loanOwnerId", String(filters.loanOwnerId));
  params.set("isActive", filters.isActive === null ? "" : String(filters.isActive));
  return params;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("es-NI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatCurrency(value: number, currency: "NIO" | "USD") {
  const formatted = new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency === "NIO" ? `C$ ${formatted}` : `US$ ${formatted}`;
}

function loanColumns(): DataTableColumn<Loan>[] {
  return [
    { key: "owner", header: "Responsable", render: (loan) => <Link className="font-bold text-pw-brand-deep underline-offset-4 hover:underline" to={`/finances/loans/${loan.id}`}>{loan.loanOwnerName}</Link> },
    { key: "date", header: "Fecha", render: (loan) => <time dateTime={loan.loanDate}>{formatDate(loan.loanDate)}</time> },
    { key: "initial-amount", header: "Monto inicial (C$)", render: (loan) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(loan.initialAmount, "NIO")}</span> },
    { key: "initial-usd", header: "Equivalente (USD)", render: (loan) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(loan.initialAmountUsd, "USD")}</span> },
    { key: "balance", header: "Saldo pendiente", render: (loan) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(loan.balance, "NIO")}</span> },
    { key: "interest", header: "Intereses pagados", render: (loan) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(loan.interestPaidAmount, "NIO")}</span> },
    { key: "status", header: "Estado", render: (loan) => <StatusBadge tone={loan.isActive ? "success" : "neutral"}>{loan.isActive ? "Activo" : "Cerrado"}</StatusBadge> },
    { key: "detail", header: "Detalle", render: (loan) => <Link className="inline-flex min-h-10 items-center rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" to={`/finances/loans/${loan.id}`}>Ver</Link> },
  ];
}

export function LoansPage() {
  const { request } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const filterKey = paramsFromFilters(filters).toString();
  const [listState, setListState] = useState<{ key: string; result?: PaginatedLoans; error?: Error } | null>(null);
  const [ownersState, setOwnersState] = useState<{ version: number; owners?: LoanOwner[]; error?: Error } | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const result = listState?.key === filterKey ? listState.result ?? null : null;
  const listError = listState?.key === filterKey ? listState.error ?? null : null;
  const owners = ownersState?.version === retryVersion ? ownersState.owners ?? null : null;
  const ownersError = ownersState?.version === retryVersion ? ownersState.error ?? null : null;
  const error = listError ?? ownersError;
  const isLoading = listState?.key !== filterKey || ownersState?.version !== retryVersion;
  const hasEnabledOwners = (owners ?? []).some((owner) => owner.enabled);

  useEffect(() => {
    setHeading({ title: "Préstamos recibidos", breadcrumbs: "Finanzas" });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    let active = true;
    void loadLoans(request, filters)
      .then((next) => { if (active) setListState({ key: filterKey, result: next }); })
      .catch((caught: unknown) => { if (active) setListState({ key: filterKey, error: caught instanceof Error ? caught : new Error("No se pudieron cargar los préstamos.") }); });
    return () => { active = false; };
  }, [filters, filterKey, request, refreshVersion]);

  useEffect(() => {
    let active = true;
    void loadLoanOwners(request)
      .then((next) => { if (active) setOwnersState({ version: retryVersion, owners: next }); })
      .catch((caught: unknown) => { if (active) setOwnersState({ version: retryVersion, error: caught instanceof Error ? caught : new Error("No se pudieron cargar los responsables.") }); });
    return () => { active = false; };
  }, [request, retryVersion]);

  useEffect(() => {
    if (isLoading || error || !owners) {
      setAction(null);
      return () => setAction(null);
    }
    setAction(hasEnabledOwners ? <button className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={() => setIsCreateOpen(true)}>Nuevo préstamo</button> : null);
    return () => setAction(null);
  }, [error, hasEnabledOwners, isLoading, owners, setAction]);

  const updateFilter = (key: "loanOwnerId" | "isActive", value: string) => {
    const normalized = key === "loanOwnerId" ? (value ? Number(value) : null) : value === "true" ? true : value === "false" ? false : null;
    setSearchParams(paramsFromFilters({ ...filters, [key]: normalized, page: 1 }));
  };
  const handleFilterChange = (event: ChangeEvent<HTMLSelectElement>) => updateFilter(event.target.name as "loanOwnerId" | "isActive", event.target.value);
  const clearFilters = () => setSearchParams(paramsFromFilters(defaultLoanFilters));
  const hasActiveFilters = filters.loanOwnerId !== null || filters.isActive !== true;
  const ownerOptions: SelectOption[] = [{ value: "", label: "Todos los responsables" }, ...(owners ?? []).map((owner) => ({ value: String(owner.id), label: owner.name }))];
  const statusOptions: SelectOption[] = [
    { value: "true", label: "Activos" },
    { value: "false", label: "Cerrados" },
    { value: "", label: "Todos" },
  ];

  if (isLoading) return <LoadingState />;
  if (error instanceof FinanceApiError && error.status === 403) return <PermissionDeniedState />;
  if (error) return <ErrorState title="No pudimos cargar los préstamos" description={error.message} onRetry={() => { setListState(null); setOwnersState(null); setRetryVersion((version) => version + 1); setRefreshVersion((version) => version + 1); }} />;
  if (!result || !owners) return <ErrorState title="No pudimos cargar los préstamos" description="Intenta cargar la información de nuevo." onRetry={() => setRetryVersion((version) => version + 1)} />;

  return <div className="space-y-5">
    <LoanFormDialog
      open={isCreateOpen}
      request={request}
      owners={owners}
      onClose={() => setIsCreateOpen(false)}
      onSaved={() => {
        setIsCreateOpen(false);
        setListState(null);
        setRefreshVersion((version) => version + 1);
        showToast({ tone: "success", title: "Préstamo creado correctamente.", durationMs: 4000 });
      }}
    />
    {owners.length === 0 || !hasEnabledOwners ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">No hay responsables habilitados para crear un préstamo.</p> : null}
    <FilterBar aria-label="Filtros de préstamos recibidos" onSubmit={(event) => event.preventDefault()}>
      <label className="grid min-w-48 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="loan-filter-owner">Responsable<SelectControl aria-label="Responsable" id="loan-filter-owner" name="loanOwnerId" value={filters.loanOwnerId === null ? "" : String(filters.loanOwnerId)} options={ownerOptions} onChange={handleFilterChange} /></label>
      <label className="grid min-w-40 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="loan-filter-status">Estado<SelectControl aria-label="Estado" id="loan-filter-status" name="isActive" value={filters.isActive === null ? "" : String(filters.isActive)} options={statusOptions} onChange={handleFilterChange} /></label>
      {hasActiveFilters ? <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" onClick={clearFilters} type="button">Limpiar filtros</button> : null}
    </FilterBar>
    {result.totalCount === 0 ? <section className="grid min-h-48 place-items-center rounded-xl border border-dashed border-pw-line bg-white p-8 text-center" role="status"><div><h2 className="text-lg font-extrabold text-pw-ink">{hasActiveFilters ? "No hay préstamos que coincidan" : "Aún no hay préstamos recibidos"}</h2><p className="mt-2 max-w-md text-sm text-pw-muted">{hasActiveFilters ? "Prueba con otros filtros o restablece los valores." : "Los préstamos que recibe el negocio aparecerán aquí."}</p>{hasEnabledOwners ? <button className="mt-4 min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep" onClick={() => setIsCreateOpen(true)} type="button">Nuevo préstamo</button> : null}</div></section> : <>
      <p aria-live="polite" className="text-sm text-pw-muted"><strong className="text-pw-ink">{result.totalCount} {result.totalCount === 1 ? "préstamo" : "préstamos"}</strong> encontrados</p>
      <DataTable caption="Préstamos recibidos" columns={loanColumns()} rows={result.items} rowKey={(loan) => String(loan.id)} />
      <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(page) => setSearchParams(paramsFromFilters({ ...filters, page }))} />
    </>}
  </div>;
}
