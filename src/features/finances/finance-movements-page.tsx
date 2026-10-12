import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { DataTable, type DataTableColumn } from "../../shared/ui/data-table";
import { FilterBar } from "../../shared/ui/filter-bar";
import { Pagination } from "../../shared/ui/pagination";
import { ErrorState, LoadingState, PermissionDeniedState } from "../../shared/ui/screen-state";
import { SelectControl, type SelectOption } from "../../shared/ui/select-control";
import { useToast } from "../../shared/ui/toast-context";
import { FinanceApiError, loadFinanceMovementTypes, loadFinanceMovements } from "./finance-api";
import { FinanceMovementCreateDialog } from "./finance-movement-create-dialog";
import { FinanceMovementDeleteDialog } from "./finance-movement-delete-dialog";
import { financeMovementFiltersFromSearchParams, searchParamsFromFinanceMovementFilters } from "./finance-filter-state";
import { FinanceMovementDetail } from "./finance-movement-detail";
import {
  defaultFinanceMovementFilters,
  type FinanceMovementFilters,
  type FinancialMovement,
  type FinancialMovementType,
  type PaginatedFinanceMovements,
} from "./finance-types";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
}

function formatAmount(value: number) {
  return `C$ ${new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

function movementColumns(onSelect: (movement: FinancialMovement) => void): DataTableColumn<FinancialMovement>[] {
  return [
    { key: "date", header: "Fecha", render: (movement) => <time dateTime={movement.movementDate}>{formatDate(movement.movementDate)}</time> },
    { key: "description", header: "Descripción", render: (movement) => <span className="block max-w-[22rem] whitespace-normal font-semibold text-pw-ink">{movement.description || "Sin descripción"}</span> },
    { key: "type", header: "Tipo", render: (movement) => movement.financialMovementTypeLabel },
    { key: "origin", header: "Origen", render: (movement) => movement.originLabel },
    { key: "direction", header: "Dirección", render: (movement) => <span className={movement.movementDirectionId === 1 ? "font-bold text-emerald-700" : "font-bold text-pw-ink"}>{movement.movementDirectionLabel}</span> },
    { key: "amount", header: "Monto", render: (movement) => <span className="whitespace-nowrap font-extrabold tabular-nums text-pw-ink">{formatAmount(movement.amount)}</span> },
    { key: "action", header: "Detalle", render: (movement) => <button className="inline-flex min-h-10 items-center rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={() => onSelect(movement)} aria-label={`Ver detalle del movimiento ${movement.id}`}>Ver</button> },
  ];
}

export function FinanceMovementsPage() {
  const { request } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => financeMovementFiltersFromSearchParams(searchParams), [searchParams]);
  const [listState, setListState] = useState<{ key: string; result?: PaginatedFinanceMovements; error?: FinanceApiError | Error } | null>(null);
  const [typeState, setTypeState] = useState<{ key: string; options?: FinancialMovementType[]; error?: FinanceApiError | Error } | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [listRefreshVersion, setListRefreshVersion] = useState(0);
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinancialMovement | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<FinancialMovement | null>(null);
  const listRequestKey = searchParamsFromFinanceMovementFilters(filters).toString();
  const typeRequestKey = String(retryVersion);
  const result = listState?.key === listRequestKey ? listState.result ?? null : null;
  const listError = listState?.key === listRequestKey ? listState.error ?? null : null;
  const typeOptions = typeState?.key === typeRequestKey ? typeState.options ?? null : null;
  const typeError = typeState?.key === typeRequestKey ? typeState.error ?? null : null;
  const error = listError ?? typeError;
  const isListLoading = listState?.key !== listRequestKey;
  const areTypesLoading = typeState?.key !== typeRequestKey;
  const selectedMovement = result?.items.find((movement) => movement.id === selectedMovementId) ?? null;

  useEffect(() => {
    setHeading({ title: "Movimientos financieros", breadcrumbs: "Finanzas" });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    if (isListLoading || areTypesLoading || error || !result) {
      setAction(null);
      return () => setAction(null);
    }
    setAction(<button className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={() => { setEditingMovement(null); setIsCreateDialogOpen(true); }}>Registrar movimiento</button>);
    return () => setAction(null);
  }, [areTypesLoading, error, isListLoading, result, setAction]);

  useEffect(() => {
    let active = true;
    void loadFinanceMovementTypes(request)
      .then((types) => {
        if (active) setTypeState({ key: typeRequestKey, options: types });
      })
      .catch((caught: unknown) => {
        if (active) setTypeState({ key: typeRequestKey, error: caught instanceof Error ? caught : new Error("No se pudieron cargar los tipos de movimiento.") });
      })
      ;
    return () => { active = false; };
  }, [request, typeRequestKey]);

  useEffect(() => {
    let active = true;
    void loadFinanceMovements(request, filters)
      .then((next) => { if (active) setListState({ key: listRequestKey, result: next }); })
      .catch((caught: unknown) => { if (active) setListState({ key: listRequestKey, error: caught instanceof Error ? caught : new Error("No se pudieron cargar los movimientos.") }); });
    return () => { active = false; };
  }, [filters, listRequestKey, request, listRefreshVersion]);

  const hasActiveFilters = Boolean(filters.fromDate || filters.toDate || filters.financialMovementTypeId !== null || filters.movementDirectionId !== null);
  const updateFilter = (key: "fromDate" | "toDate" | "financialMovementTypeId" | "movementDirectionId", value: string) => {
    const normalizedValue = key === "financialMovementTypeId" || key === "movementDirectionId" ? (value ? Number(value) : null) : value;
    const next = { ...filters, [key]: normalizedValue, page: 1 } as FinanceMovementFilters;
    setSelectedMovementId(null);
    setSearchParams(searchParamsFromFinanceMovementFilters(next));
  };
  const clearFilters = () => {
    setSelectedMovementId(null);
    setSearchParams(searchParamsFromFinanceMovementFilters(defaultFinanceMovementFilters));
  };
  const handleInput = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateFilter(event.target.name as "fromDate" | "toDate" | "financialMovementTypeId" | "movementDirectionId", event.target.value);
  };
  const directionOptions: SelectOption[] = [
    { value: "", label: "Todas las direcciones" },
    { value: "1", label: "Ingreso" },
    { value: "2", label: "Egreso" },
  ];

  if (isListLoading || areTypesLoading) return <LoadingState />;
  if (error instanceof FinanceApiError && error.status === 403) return <PermissionDeniedState />;
  if (error) return <ErrorState title="No pudimos cargar los movimientos" description={error.message} onRetry={() => { setListState(null); setTypeState(null); setRetryVersion((version) => version + 1); setListRefreshVersion((version) => version + 1); }} />;
  if (!result) return <ErrorState title="No pudimos cargar los movimientos" description="Intenta cargar la información de nuevo." onRetry={() => setRetryVersion((version) => version + 1)} />;

  return <div className="space-y-5">
    <FinanceMovementCreateDialog
      key={editingMovement?.id ?? "create"}
      isOpen={isCreateDialogOpen}
      onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
      }}
      request={request}
      movementTypes={typeOptions ?? []}
      movement={editingMovement ?? undefined}
      onSaved={() => {
        const wasEditing = editingMovement !== null;
        setSelectedMovementId(null);
        setEditingMovement(null);
        setListState(null);
        setListRefreshVersion((version) => version + 1);
        showToast({ tone: "success", title: wasEditing ? "Movimiento actualizado correctamente." : "Movimiento registrado correctamente.", durationMs: 4000 });
      }}
    />
    <FinanceMovementDeleteDialog
      movement={deletingMovement}
      request={request}
      onClose={() => setDeletingMovement(null)}
      onDeleted={() => {
        setDeletingMovement(null);
        setSelectedMovementId(null);
        setListState(null);
        setListRefreshVersion((version) => version + 1);
        showToast({ tone: "success", title: "Movimiento eliminado correctamente.", durationMs: 4000 });
      }}
    />
    <FilterBar aria-label="Filtros de movimientos financieros" onSubmit={(event) => event.preventDefault()}>
      <FilterFields filters={filters} typeOptions={(typeOptions ?? []).map((type) => ({ value: String(type.id), label: type.label }))} directionOptions={directionOptions} onChange={handleInput} onClear={clearFilters} hasActiveFilters={hasActiveFilters} />
    </FilterBar>
    {result.totalCount === 0 ? <section className="grid min-h-48 place-items-center rounded-xl border border-dashed border-pw-line bg-white p-8 text-center" role="status">
      <div>
        <h2 className="text-lg font-extrabold text-pw-ink">{hasActiveFilters ? "No hay movimientos que coincidan" : "Aún no hay movimientos financieros"}</h2>
        <p className="mt-2 max-w-md text-sm text-pw-muted">{hasActiveFilters ? "Prueba con otros filtros o restablece los valores." : "Los ingresos y egresos registrados aparecerán aquí."}</p>
      </div>
    </section> : <>
      <p aria-live="polite" className="text-sm text-pw-muted"><strong className="text-pw-ink">{result.totalCount} {result.totalCount === 1 ? "movimiento" : "movimientos"}</strong> encontrados</p>
      <div className={selectedMovement ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)]" : "min-w-0 space-y-5"}>
        <div className="min-w-0 space-y-5">
          <DataTable caption="Movimientos financieros" columns={movementColumns((movement) => setSelectedMovementId(movement.id))} rows={result.items} rowKey={(movement) => String(movement.id)} />
          <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(page) => { setSelectedMovementId(null); setSearchParams(searchParamsFromFinanceMovementFilters({ ...filters, page })); }} />
        </div>
        {selectedMovement ? <FinanceMovementDetail
          movement={selectedMovement}
          onClose={() => setSelectedMovementId(null)}
          onEdit={() => { setEditingMovement(selectedMovement); setIsCreateDialogOpen(true); }}
          onDelete={() => setDeletingMovement(selectedMovement)}
        /> : null}
      </div>
    </>}
  </div>;
}

function FilterFields({
  filters,
  typeOptions,
  directionOptions,
  onChange,
  onClear,
  hasActiveFilters,
}: {
  filters: FinanceMovementFilters;
  typeOptions: SelectOption[];
  directionOptions: SelectOption[];
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  return <>
    <label className="grid min-w-40 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="finance-from-date">Desde<input className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="finance-from-date" name="fromDate" type="date" value={filters.fromDate} onChange={onChange} /></label>
    <label className="grid min-w-40 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="finance-to-date">Hasta<input className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30" id="finance-to-date" name="toDate" type="date" value={filters.toDate} onChange={onChange} /></label>
    <label className="grid min-w-48 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="finance-movement-type">Tipo<SelectControl aria-label="Tipo de movimiento" id="finance-movement-type" name="financialMovementTypeId" value={filters.financialMovementTypeId === null ? "" : String(filters.financialMovementTypeId)} options={[{ value: "", label: "Todos los tipos" }, ...typeOptions]} onChange={onChange} /></label>
    <label className="grid min-w-48 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="finance-movement-direction">Dirección<SelectControl aria-label="Dirección" id="finance-movement-direction" name="movementDirectionId" value={filters.movementDirectionId === null ? "" : String(filters.movementDirectionId)} options={directionOptions} onChange={onChange} /></label>
    {hasActiveFilters ? <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={onClear}>Limpiar filtros</button> : null}
  </>;
}
