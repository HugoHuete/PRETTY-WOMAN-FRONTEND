import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { DataTable, type DataTableColumn } from "../../shared/ui/data-table";
import { FilterBar } from "../../shared/ui/filter-bar";
import { SelectControl } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import type { SalePostSaleListItem } from "./sales-types";
import { Pagination } from "../../shared/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { useAuth } from "../auth/auth-provider";
import { getSalePostSale } from "./sales-api";
import { exchangeStatuses, returnStatuses } from "./sale-post-sale-statuses";

const dateFormat = new Intl.DateTimeFormat("es-NI", {
  dateStyle: "short",
  timeZone: "America/Managua",
});

const statusOptions = [
  { value: "", label: "Recepciones pendientes" },
  { value: "all", label: "Todos los estados" },
  { value: "history", label: "Historial" },
  ...Object.entries(exchangeStatuses).map(([id, label]) => ({ value: `exchange-${id}`, label: `Cambio · ${label}` })),
  ...Object.entries(returnStatuses).map(([id, label]) => ({ value: `return-${id}`, label: `Devolución · ${label}` })),
];

function statusTone(item: SalePostSaleListItem) {
  if (item.statusId === 5) return "danger";
  if (item.statusId === 4 || (!item.isExchange && item.statusId === 3)) return "success";
  return item.statusId === 1 ? "info" : "warning";
}

export function SalePostSalePage() {
  const { request } = useAuth();
  const { setHeading } = usePageActions();
  const [params, setParams] = useSearchParams();
  const requestedStatus = params.get("status") ?? (params.get("view") === "history" ? "history" : "");
  const status = statusOptions.some((option) => option.value === requestedStatus) ? requestedStatus : "";
  const [kind, statusId] = status.split("-");
  const search = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);
  const requestedPage = Number(params.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 2_147_483_647
    ? requestedPage
    : 1;
  const [result, setResult] = useState<Awaited<ReturnType<typeof getSalePostSale>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setHeading({
      title: "Cambios y devoluciones",
      breadcrumbs: <Link className="underline underline-offset-4 hover:text-pw-brand-deep" to="/sales">← Ventas</Link>,
    });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    let active = true;
    setResult(null);
    setError(null);
    void getSalePostSale(request, {
      page,
      history: status === "history",
      search,
      includeAll: status === "all",
      isExchange: statusId ? kind === "exchange" : undefined,
      statusId: statusId ? Number(statusId) : undefined,
    })
      .then((value) => { if (active) setResult(value); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Intenta nuevamente.");
      });
    return () => { active = false; };
  }, [request, page, status, kind, statusId, search, retry]);

  const update = useCallback((next: { status?: string; search?: string; page?: number }) => {
    const filters = new URLSearchParams();
    const nextStatus = next.status ?? status;
    if (nextStatus) filters.set("status", nextStatus);
    const term = next.search ?? search;
    if (term) filters.set("search", term);
    if (next.page && next.page > 1) filters.set("page", String(next.page));
    setParams(filters);
  }, [search, setParams, status]);

  useEffect(() => {
    const term = searchInput.trim();
    if (term === search) return;

    const timeout = window.setTimeout(() => update({ search: term }), 250);
    return () => window.clearTimeout(timeout);
  }, [search, searchInput, update]);

  const columns: DataTableColumn<SalePostSaleListItem>[] = [
    { key: "request", header: "Solicitud", render: (item) => <strong className="whitespace-nowrap">{item.isExchange ? "Cambio" : "Devolución"} #{item.id}</strong> },
    { key: "sale", header: "Venta", render: (item) => `#${item.saleId}` },
    { key: "client", header: "Clienta", render: (item) => item.clientName || "Sin clienta" },
    { key: "date", header: "Fecha", render: (item) => dateFormat.format(new Date(item.createdAt)) },
    { key: "status", header: "Estado", render: (item) => <StatusBadge tone={statusTone(item)}>
      {(item.isExchange ? exchangeStatuses : returnStatuses)[item.statusId] ?? "—"}
    </StatusBadge> },
    { key: "action", header: "Acción", render: (item) => <Link
      aria-label={`Ver ${item.isExchange ? "cambio" : "devolución"} #${item.id}`}
      className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-pw-brand"
      to={`/sales/${item.saleId}#post-sale-${item.isExchange ? "exchange" : "return"}-${item.id}`}
      state={{ postSaleSearch: params.toString() }}
    >Ver solicitud</Link> },
  ];

  return <div className="space-y-5">
    <FilterBar aria-label="Filtros de postventa" onSubmit={(event) => event.preventDefault()}>
      <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted sm:min-w-56">
        Clienta o número de venta
        <input name="search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)}
          className="min-h-11 min-w-0 rounded-lg border border-pw-line px-3 text-sm font-normal text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand" />
      </label>
      <label htmlFor="post-sale-status" className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted sm:w-64">
        Estado
        <SelectControl id="post-sale-status" aria-label="Estado" options={statusOptions} value={status}
          onChange={(event) => update({ status: event.target.value })} />
      </label>
      {search || status ? <button type="button" onClick={() => {
        setSearchInput("");
        update({ search: "", status: "" });
      }} className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-brand-soft">Limpiar filtros</button> : null}
    </FilterBar>

    {error ? <ErrorState title="No pudimos cargar los cambios y devoluciones" description={error} onRetry={() => setRetry((value) => value + 1)} />
      : !result ? <LoadingState />
      : !result.items.length ? <EmptyState title={search || status ? "No encontramos solicitudes con estos filtros" : "No hay recepciones pendientes"} />
      : <>
        <DataTable columns={columns} rows={result.items} caption="Cambios y devoluciones" rowKey={(item) => `${item.isExchange}-${item.id}`} />
        {result.totalPages > 1 ? <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(next) => update({ page: next })} /> : null}
      </>}
  </div>;
}
