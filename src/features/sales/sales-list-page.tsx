import { DateFilter } from "../../shared/ui/date-filter";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { FilterBar } from "../../shared/ui/filter-bar";
import { Pagination } from "../../shared/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import { ApiRequestError, getSales } from "./sales-api";
import { buildSalesSearchParams, readSalesFilters } from "./sales-filter-state";
import { paymentStatuses, saleChannels, saleStatuses, type SaleRecord } from "./sales-types";

const currency = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const saleTone = (id: number) => ({ 1: "warning", 2: "info", 3: "info", 4: "info", 5: "success", 6: "danger" }[id] ?? "neutral") as "success" | "warning" | "danger" | "info" | "neutral";
const paymentTone = (id: number) => ({ 1: "danger", 2: "warning", 3: "success", 4: "neutral" }[id] ?? "neutral") as "success" | "warning" | "danger" | "info" | "neutral";
function catalogName(id: number, fallback: string | null, options: readonly { id: number; name: string }[]) { return options.find((option) => option.id === id)?.name ?? fallback ?? "—"; }
function saleDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }

export function SalesListPage() {
  const { request } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const [params, setParams] = useSearchParams();
  const [dateResetKey, setDateResetKey] = useState(0);
  const filters = useMemo(() => readSalesFilters(params), [params]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getSales>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => { setHeading({ title: "Ventas", breadcrumbs: null }); return () => setHeading(null); }, [setHeading]);
  useEffect(() => { setAction(<Link to="/sales/new" className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2">Nueva venta</Link>); return () => setAction(null); }, [setAction]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void getSales(request, filters).then((page) => { if (active) setResult(page); }).catch((caught: unknown) => {
      if (!active) return;
      setError({ message: caught instanceof Error ? caught.message : "No se pudieron cargar las ventas.", forbidden: caught instanceof ApiRequestError && caught.status === 403 });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, request, retry]);

  const update = (patch: Partial<typeof filters>) => setParams(buildSalesSearchParams({ ...filters, ...patch, page: patch.page ?? 1 }));
  const dateInput = (label: string, key: "startDate" | "endDate", value: string) => <label htmlFor={key} className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted">{label}<DateFilter resetKey={dateResetKey} id={key} value={value} onChange={(next) => { if (key === "endDate" && next && filters.startDate && next < filters.startDate) { setDateResetKey((current) => current + 1); update({ endDate: filters.startDate }); } else update(key === "startDate" ? { startDate: next } : { endDate: next }); }} /></label>;
  const select = (id: string, label: string, value: string, values: readonly { id: number; name: string }[], key: "saleStatusId" | "salePaymentStatusId" | "saleChannelId") => <label htmlFor={id} className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted">{label}<SelectControl id={id} aria-label={label} value={value} options={[{ value: "", label: "Todos" }, ...values.map((option) => ({ value: String(option.id), label: option.name }))]} onChange={(event) => update({ [key]: event.target.value })} /></label>;
  return <div className="space-y-5">
    <FilterBar className="sm:grid sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]" aria-label="Filtros de ventas" onSubmit={(event) => event.preventDefault()}>
      {dateInput("Desde", "startDate", filters.startDate)}{dateInput("Hasta", "endDate", filters.endDate)}
      {select("sale-status", "Estado de venta", filters.saleStatusId, saleStatuses, "saleStatusId")}
      {select("payment-status", "Estado de pago", filters.salePaymentStatusId, paymentStatuses, "salePaymentStatusId")}
      {select("sale-channel", "Canal", filters.saleChannelId, saleChannels, "saleChannelId")}
      <button type="button" onClick={() => { setDateResetKey((key) => key + 1); update({ startDate: "", endDate: "", saleStatusId: "", salePaymentStatusId: "", saleChannelId: "" }); }} className="min-h-11 rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-pw-brand">Limpiar filtros</button>
    </FilterBar>
    {loading ? <LoadingState /> : null}
    {!loading && error?.forbidden ? <EmptyState title="Acceso restringido" description="No tienes permiso para consultar las ventas." action={<Link to="/">Volver al inicio</Link>} /> : null}
    {!loading && error && !error.forbidden ? <ErrorState title="No pudimos cargar las ventas" description={error.message} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {!loading && !error && result?.totalCount === 0 ? <EmptyState title="No hay ventas en este periodo" description="Prueba con otras fechas o registra una venta nueva." action={<Link to="/sales/new" className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 font-extrabold text-white">Registrar venta</Link>} /> : null}
    {!loading && !error && result && result.totalCount > 0 ? <>
      <div className="overflow-x-auto rounded-xl border border-pw-line bg-white"><table aria-label="Ventas registradas" className="w-full min-w-[900px] text-left text-sm"><thead className="bg-pw-brand-soft text-xs uppercase text-pw-ink"><tr>{["Referencia", "Fecha", "Clienta", "Canal", "Estado", "Pago", "Total"].map((head) => <th key={head} scope="col" className={"border-b border-pw-brand/35 px-4 py-3.5 font-extrabold " + (head === "Total" ? "text-center" : "")}>{head}</th>)}</tr></thead><tbody className="divide-y divide-pw-line">{result.items.map((sale: SaleRecord) => <tr key={sale.id} className="hover:bg-pw-canvas/70"><td className="px-4 py-3 font-extrabold text-pw-brand-deep"><Link aria-label={`Ver venta #${sale.id}`} to={`/sales/${sale.id}`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-pw-brand">#{sale.id}</Link></td><td className="whitespace-nowrap px-4 py-3">{saleDate(sale.saleDate)}</td><td className="px-4 py-3">{sale.clientName || "Venta sin clienta"}</td><td className="px-4 py-3">{catalogName(sale.saleChannelId, sale.saleChannelName, saleChannels)}</td><td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><StatusBadge tone={saleTone(sale.saleStatusId)}>{catalogName(sale.saleStatusId, sale.saleStatusName, saleStatuses)}</StatusBadge>{sale.hasPendingSelection ? <StatusBadge tone="warning">Selección pendiente</StatusBadge> : null}</div></td><td className="px-4 py-3"><StatusBadge tone={paymentTone(sale.salePaymentStatusId)}>{catalogName(sale.salePaymentStatusId, sale.salePaymentStatusName, paymentStatuses)}</StatusBadge></td><td className="whitespace-nowrap px-4 py-3 text-center font-extrabold">{currency.format(sale.total)}</td></tr>)}</tbody></table></div>
      <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(page) => update({ page })} />
    </> : null}
  </div>;
}
