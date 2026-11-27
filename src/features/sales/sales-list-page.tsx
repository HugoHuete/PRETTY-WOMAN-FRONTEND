import { DateFilter } from "../../shared/ui/date-filter";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigationType, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { FilterBar } from "../../shared/ui/filter-bar";
import { Pagination } from "../../shared/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import { ShipmentClientDialog } from "../shipments/shipment-client-dialog";
import { ApiRequestError, getSales } from "./sales-api";
import { advancedSalesFilterKeys, buildSalesSearchParams, readSalesFilters } from "./sales-filter-state";
import { paymentStatuses, saleChannels, saleStatuses, type SaleRecord, type SalesFilters } from "./sales-types";

type AdvancedFilters = Pick<SalesFilters, (typeof advancedSalesFilterKeys)[number]>;
const advancedFilterDelay = 650;
function normalizeAdvancedValue(key: keyof AdvancedFilters, value: string) {
  return key === "productCode" && value ? String(Number(value)) : value.trim();
}

const currency = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const saleTone = (id: number) => ({ 1: "warning", 2: "info", 3: "info", 4: "info", 5: "success", 6: "danger" }[id] ?? "neutral") as "success" | "warning" | "danger" | "info" | "neutral";
const paymentTone = (id: number) => ({ 1: "danger", 2: "warning", 3: "success", 4: "neutral" }[id] ?? "neutral") as "success" | "warning" | "danger" | "info" | "neutral";
function catalogName(id: number, fallback: string | null, options: readonly { id: number; name: string }[]) { return options.find((option) => option.id === id)?.name ?? fallback ?? "—"; }
function saleDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }

export function SalesListPage() {
  const { request, session } = useAuth();
  const isAdmin = session?.user.roles.includes("Admin") ?? false;
  const [clientId, setClientId] = useState<number | null>(null);
  const { setAction, setHeading } = usePageActions();
  const [params, setParams] = useSearchParams();
  const { key: locationKey } = useLocation();
  const navigationType = useNavigationType();
  const [dateResetKey, setDateResetKey] = useState(0);
  const filters = useMemo(() => readSalesFilters(params), [params]);
  const activeAdvancedFilters = advancedSalesFilterKeys.filter((key) => filters[key]).length;
  const [showAdvanced, setShowAdvanced] = useState(activeAdvancedFilters > 0);
  const [advancedDraft, setAdvancedDraft] = useState<{ values: AdvancedFilters; pending: boolean } | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getSales>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => { setHeading({ title: "Ventas", breadcrumbs: null }); return () => setHeading(null); }, [setHeading]);
  useEffect(() => {
    setAction(
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/sales/post-sale" className="inline-flex min-h-11 items-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2">
          Cambios y devoluciones
        </Link>
        <Link to="/sales/new" className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2">
          Nueva venta
        </Link>
      </div>,
    );
    return () => setAction(null);
  }, [setAction]);
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
  useEffect(() => {
    if (navigationType === "POP") setAdvancedDraft(null);
  }, [locationKey, navigationType]);

  useEffect(() => {
    if (!advancedDraft?.pending) return;
    const timer = window.setTimeout(() => {
      const next = { ...filters };
      for (const key of advancedSalesFilterKeys) next[key] = normalizeAdvancedValue(key, advancedDraft.values[key]);
      setAdvancedDraft({ ...advancedDraft, pending: false });
      if (advancedSalesFilterKeys.some((key) => next[key] !== filters[key])) {
        setParams(buildSalesSearchParams({ ...next, page: 1 }), { replace: true });
      }
    }, advancedFilterDelay);
    return () => window.clearTimeout(timer);
  }, [advancedDraft, filters, setParams]);

  const advancedValues = advancedDraft && (advancedDraft.pending ||
    advancedSalesFilterKeys.every((key) => normalizeAdvancedValue(key, advancedDraft.values[key]) === filters[key]))
    ? advancedDraft.values
    : filters;

  const updateAdvanced = (key: keyof AdvancedFilters, value: string) => {
    if (key === "productCode" && (!/^\d{0,10}$/.test(value) || Number(value) > 2147483647)) return;
    setAdvancedDraft({ values: { ...advancedValues, [key]: value }, pending: true });
  };
  const advancedLabel = showAdvanced ? "Menos filtros" : "Más filtros";
  return <div className="space-y-5">
    <FilterBar
      className="sm:grid sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
      aria-label="Filtros de ventas"
      onSubmit={(event) => event.preventDefault()}
    >
      {dateInput("Desde", "startDate", filters.startDate)}{dateInput("Hasta", "endDate", filters.endDate)}
      {select("sale-status", "Estado de venta", filters.saleStatusId, saleStatuses, "saleStatusId")}
      {select("payment-status", "Estado de pago", filters.salePaymentStatusId, paymentStatuses, "salePaymentStatusId")}
      {select("sale-channel", "Canal", filters.saleChannelId, saleChannels, "saleChannelId")}
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-label={activeAdvancedFilters ? `${advancedLabel} (${activeAdvancedFilters})` : advancedLabel} title={advancedLabel} aria-expanded={showAdvanced} aria-controls="sales-advanced-filters" onClick={() => setShowAdvanced((value) => !value)} className="relative grid size-11 place-items-center rounded-lg border border-pw-line bg-white text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-pw-brand aria-expanded:border-pw-brand aria-expanded:bg-pw-brand-soft aria-expanded:text-pw-brand-deep">
          <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16l-6 7v5l-4 2v-7z" />
          </svg>
          {activeAdvancedFilters > 0 ? (
            <span aria-hidden="true" className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-pw-brand-deep text-[10px] font-bold text-white">{activeAdvancedFilters}</span>
          ) : null}
        </button>
        <button type="button" aria-label="Limpiar filtros" title="Limpiar filtros" onClick={() => {
          setDateResetKey((key) => key + 1);
          setAdvancedDraft(null);
          update({ startDate: "", endDate: "", saleStatusId: "", salePaymentStatusId: "", saleChannelId: "", productCode: "", clientName: "", clientPhone: "", clientInstagramUser: "", clientMessengerUser: "" });
        }} className="grid size-11 place-items-center rounded-lg border border-pw-line bg-white text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-pw-brand">
          <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11a8 8 0 1 1 1.9 6.2M4 5v6h6" />
          </svg>
        </button>
      </div>
      <div id="sales-advanced-filters" hidden={!showAdvanced} className="col-span-full border-t border-pw-line pt-3">
        {showAdvanced ? <AdvancedSalesFilters filters={advancedValues} onChange={updateAdvanced} /> : null}
      </div>
    </FilterBar>
    {loading ? <LoadingState /> : null}
    {!loading && error?.forbidden ? <EmptyState title="Acceso restringido" description="No tienes permiso para consultar las ventas." action={<Link to="/">Volver al inicio</Link>} /> : null}
    {!loading && error && !error.forbidden ? <ErrorState title="No pudimos cargar las ventas" description={error.message} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {!loading && !error && result?.totalCount === 0 ? <EmptyState title={activeAdvancedFilters ? "No hay ventas que coincidan" : "No hay ventas en este periodo"} description={activeAdvancedFilters ? "Ajusta los filtros o amplía el rango de fechas." : "Prueba con otras fechas o registra una venta nueva."} action={<Link to="/sales/new" className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 font-extrabold text-white">Registrar venta</Link>} /> : null}
    {!loading && !error && result && result.totalCount > 0 ? <>
      <div className="overflow-x-auto rounded-xl border border-pw-line bg-white"><table aria-label="Ventas registradas" className="w-full min-w-[900px] text-left text-sm"><thead className="bg-pw-brand-soft text-xs uppercase text-pw-ink"><tr>{["Referencia", "Fecha", "Clienta", "Canal", "Estado", "Pago", "Total"].map((head) => <th key={head} scope="col" className={"border-b border-pw-brand/35 px-4 py-3.5 font-extrabold " + (head === "Total" ? "text-center" : "")}>{head}</th>)}</tr></thead><tbody className="divide-y divide-pw-line">{result.items.map((sale: SaleRecord) => <tr key={sale.id} className="hover:bg-pw-canvas/70"><td className="px-4 py-3 font-extrabold text-pw-brand-deep"><Link aria-label={`Ver venta #${sale.id}`} to={`/sales/${sale.id}`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-pw-brand">#{sale.id}</Link></td><td className="whitespace-nowrap px-4 py-3">{saleDate(sale.saleDate)}</td><td className="px-4 py-3">{sale.clientId !== null ? <button type="button" aria-haspopup="dialog" onClick={() => setClientId(sale.clientId)} className="min-h-10 text-left font-semibold text-pw-brand-deep underline decoration-pw-brand/50 underline-offset-4 hover:decoration-pw-brand focus-visible:outline-2 focus-visible:outline-pw-brand">{sale.clientName || "Ver clienta"}</button> : sale.clientName || "-"}</td><td className="px-4 py-3">{catalogName(sale.saleChannelId, sale.saleChannelName, saleChannels)}</td><td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><StatusBadge tone={saleTone(sale.saleStatusId)}>{catalogName(sale.saleStatusId, sale.saleStatusName, saleStatuses)}</StatusBadge>{sale.hasPendingSelection ? <StatusBadge tone="warning">Selección pendiente</StatusBadge> : null}</div></td><td className="px-4 py-3"><StatusBadge tone={paymentTone(sale.salePaymentStatusId)}>{catalogName(sale.salePaymentStatusId, sale.salePaymentStatusName, paymentStatuses)}</StatusBadge></td><td className="whitespace-nowrap px-4 py-3 text-center font-extrabold">{currency.format(sale.total)}</td></tr>)}</tbody></table></div>
      <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(page) => update({ page })} />
    </> : null}
    {clientId !== null ? <ShipmentClientDialog key={clientId} clientId={clientId} isAdmin={isAdmin} request={request} onClose={() => setClientId(null)} /> : null}
  </div>;
}

function AdvancedSalesFilters({ filters, onChange }: {
  filters: AdvancedFilters;
  onChange: (key: keyof AdvancedFilters, value: string) => void;
}) {
  const inputClass = "min-h-11 w-full rounded-lg border border-pw-line bg-white px-3 text-sm font-medium text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand";
  return <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted">
      Código de producto
      <input name="productCode" inputMode="numeric" maxLength={10} value={filters.productCode} onChange={(event) => onChange("productCode", event.target.value)} className={inputClass} />
    </label>
    <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted">
      Nombre de clienta
      <input name="clientName" maxLength={150} value={filters.clientName} onChange={(event) => onChange("clientName", event.target.value)} className={inputClass} />
    </label>
    <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted">
      Teléfono
      <input name="clientPhone" type="tel" maxLength={32} value={filters.clientPhone} onChange={(event) => onChange("clientPhone", event.target.value)} className={inputClass} />
    </label>
    <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted">
      Usuario de Instagram
      <input name="clientInstagramUser" maxLength={150} value={filters.clientInstagramUser} onChange={(event) => onChange("clientInstagramUser", event.target.value)} className={inputClass} />
    </label>
    <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted">
      Usuario de Messenger
      <input name="clientMessengerUser" maxLength={150} value={filters.clientMessengerUser} onChange={(event) => onChange("clientMessengerUser", event.target.value)} className={inputClass} />
    </label>
  </div>;
}
