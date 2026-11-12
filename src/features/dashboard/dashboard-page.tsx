import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/auth-provider';
import { DataTable, type DataTableColumn } from '../../shared/ui/data-table';
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/screen-state';

type Month = { month: number; incomeNio: number; grossProfitNio: number; expensesNio: number; utilityNio: number };
type MonthlySummary = { years: { year: number; months: Month[] }[] };
type Row = Month & { year: number };
type Result<T> = { data: T; error?: never } | { data?: never; error: true } | null;

const money = (value: number) => `C$ ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const monthName = (month: number) => new Intl.DateTimeFormat('es-NI', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, month - 1, 1)));
const columns: DataTableColumn<Row>[] = [
  { key: 'year', header: 'Año', render: (row) => row.year },
  { key: 'month', header: 'Mes', render: (row) => monthName(row.month) },
  ...([
    ['incomeNio', 'Ingresos netos'], ['grossProfitNio', 'Ganancia bruta'],
    ['expensesNio', 'Gastos totales'], ['utilityNio', 'Utilidad'],
  ] as const).map(([key, header]) => ({ key, header, render: (row: Row) => <span className="whitespace-nowrap tabular-nums">{money(row[key])}</span> })),
];

function FinancialOverview() {
  const { request } = useAuth();
  const [balance, setBalance] = useState<Result<{ balanceNio: number }>>(null);
  const [summary, setSummary] = useState<Result<MonthlySummary>>(null);
  const [balanceRetry, setBalanceRetry] = useState(0);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [currentYear] = useState(() => new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Managua' }).format(new Date()));
  const [fromYear, setFromYear] = useState(currentYear);
  const [toYear, setToYear] = useState(currentYear);
  const [range, setRange] = useState(() => ({ fromYear: currentYear, toYear: currentYear }));
  const [filterError, setFilterError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const query = new URLSearchParams(range).toString();

  function applyVisibleRange() {
    if (!/^\d{4}$/.test(fromYear) || !/^\d{4}$/.test(toYear) || Number(fromYear) < 1 || Number(toYear) < 1) {
      setFilterError('Ingresa años válidos de cuatro dígitos.');
      return null;
    }
    if (Number(fromYear) > Number(toYear)) {
      setFilterError('El año de inicio debe ser anterior o igual al año de fin.');
      return null;
    }
    setFilterError('');
    if (fromYear !== range.fromYear || toYear !== range.toYear) {
      setSummary(null);
      setRange({ fromYear, toYear });
    }
    return { fromYear, toYear };
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyVisibleRange();
  }

  async function exportSummary() {
    const exportRange = applyVisibleRange();
    if (!exportRange) return;
    const exportQuery = new URLSearchParams(exportRange).toString();
    setExporting(true);
    setExportError('');
    try {
      const response = await request(`/api/v1/finances/monthly-summary/export?${exportQuery}`);
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `resumen-financiero-${exportRange.fromYear}-${exportRange.toYear}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('No se pudo descargar el Excel. Intenta nuevamente.');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    let active = true;
    void request('/api/v1/finances/current-balance').then((response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ balanceNio: number }>;
    }).then((data) => { if (active) setBalance({ data }); }).catch(() => { if (active) setBalance({ error: true }); });
    return () => { active = false; };
  }, [request, balanceRetry]);

  useEffect(() => {
    let active = true;
    void request(`/api/v1/finances/monthly-summary?${query}`).then((response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<MonthlySummary>;
    }).then((data) => { if (active) setSummary({ data }); }).catch(() => { if (active) setSummary({ error: true }); });
    return () => { active = false; };
  }, [request, summaryRetry, query]);

  const rows = (summary?.data?.years ?? []).flatMap(({ year, months }) => months.map((month) => ({ ...month, year }))).sort((a, b) => b.year - a.year || b.month - a.month);
  return <div className="space-y-8">
    <section aria-labelledby="balance-heading">
      <h2 className="mb-3 text-lg font-extrabold text-pw-ink" id="balance-heading">Balance actual</h2>
      {!balance ? <LoadingState /> : balance.error ? <ErrorState title="No se pudo cargar el balance" onRetry={() => { setBalance(null); setBalanceRetry((v) => v + 1); }} /> : <div className="rounded-xl border border-pw-line bg-white p-5 sm:p-6"><p className="text-sm text-pw-muted">Saldo financiero disponible</p><p className="mt-2 text-3xl font-extrabold tabular-nums text-pw-ink">{money(balance.data.balanceNio)}</p></div>}
    </section>
    <section aria-labelledby="monthly-heading">
      <h2 className="text-lg font-extrabold text-pw-ink" id="monthly-heading">Resumen financiero mensual</h2>
      <p className="mb-4 mt-1 text-sm text-pw-muted">Ingresos, ganancia, gastos y utilidad por mes en córdobas.</p>
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-pw-line bg-white p-4" onSubmit={applyFilters} noValidate>
        <label className="grid gap-1 text-sm font-bold text-pw-ink">Año de inicio<input className="min-h-11 w-32 rounded-lg border border-pw-line px-3 font-normal focus-visible:outline-3 focus-visible:outline-pw-brand-deep" inputMode="numeric" maxLength={4} value={fromYear} onChange={(event) => setFromYear(event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-bold text-pw-ink">Año de fin<input className="min-h-11 w-32 rounded-lg border border-pw-line px-3 font-normal focus-visible:outline-3 focus-visible:outline-pw-brand-deep" inputMode="numeric" maxLength={4} value={toYear} onChange={(event) => setToYear(event.target.value)} /></label>
        <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep" type="submit">Aplicar</button>
        <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep disabled:opacity-60" type="button" disabled={exporting} onClick={() => void exportSummary()}>{exporting ? 'Preparando Excel…' : 'Descargar Excel'}</button>
        {filterError ? <p className="w-full text-sm text-red-700" role="alert">{filterError}</p> : null}
        {exportError ? <p className="w-full text-sm text-red-700" role="alert">{exportError}</p> : null}
      </form>
      {!summary ? <LoadingState /> : summary.error ? <ErrorState title="No se pudo cargar el resumen mensual" onRetry={() => { setSummary(null); setSummaryRetry((v) => v + 1); }} /> : rows.length === 0 ? <EmptyState title="Aún no hay información financiera mensual" /> : <DataTable caption="Resumen financiero mensual" columns={columns} rows={rows} rowKey={(row) => `${row.year}-${row.month}`} />}
    </section>
  </div>;
}

export function DashboardPage() {
  const { session } = useAuth();
  if (!session?.user.roles.includes('Admin')) return <EmptyState title="Tu resumen estará aquí" description="Pronto podrás consultar la información de la operación." />;
  return <FinancialOverview />;
}
