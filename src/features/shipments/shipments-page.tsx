import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { useToast } from "../../shared/ui/toast-context";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { FilterBar } from "../../shared/ui/filter-bar";
import { Pagination } from "../../shared/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import { getSale, runSaleDeliveryAction } from "../sales/sales-api";
import type { SaleDetail } from "../sales/sales-types";
import { buildShipmentSearchParams, defaultShipmentFilters, readShipmentFilters } from "./shipments-filter-state";
import { getShipmentAgencies, getShipments } from "./shipments-api";
import type { Shipment, ShipmentAction } from "./shipments-types";

const currency = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const statusLabels: Record<number, string> = {
  1: "Pendiente de despacho",
  2: "Entregada",
  3: "Cancelada",
  4: "En tránsito",
  5: "Entrega fallida",
  6: "Entregada · selección pendiente",
};
const statusTones: Record<number, "success" | "warning" | "danger" | "info" | "neutral"> = {
  1: "warning",
  2: "success",
  3: "neutral",
  4: "info",
  5: "danger",
  6: "warning",
};
const actionCopy: Record<ShipmentAction, { title: string; description: string; confirmLabel: string; toast: string }> = {
  send: { title: "¿Despachar este envío?", description: "El envío pasará a estar en tránsito. La venta debe cumplir las condiciones de pago de su agencia.", confirmLabel: "Despachar envío", toast: "El envío fue marcado como despachado." },
  complete: { title: "¿Confirmar la entrega?", description: "La entrega se cerrará y la venta quedará completada.", confirmLabel: "Confirmar entrega", toast: "La entrega quedó completada." },
  "delivered-pending-selection": { title: "¿Registrar la entrega?", description: "La clienta recibió el pedido, pero todavía hay prendas de selección pendientes de resolver.", confirmLabel: "Registrar entrega", toast: "La entrega quedó pendiente de resolver la selección." },
  fail: { title: "¿Registrar una entrega fallida?", description: "El envío dejará de estar en tránsito y sus prendas volverán a quedar reservadas.", confirmLabel: "Registrar falla", toast: "La entrega fue registrada como fallida." },
  cancel: { title: "¿Cancelar este envío?", description: "Solo se puede cancelar antes del despacho. Si hay pagos de envío, el backend validará que se hayan reembolsado.", confirmLabel: "Cancelar envío", toast: "El envío fue cancelado." },
};

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Managua" }).format(parsed);
}

function deliveryStatusName(shipment: Shipment) {
  return statusLabels[shipment.deliveryStatusId] ?? shipment.deliveryStatusName ?? "Estado desconocido";
}

function paidAmount(amounts: number[]) {
  return Math.round((amounts.reduce((total, amount) => total + amount, 0) + Number.EPSILON) * 100) / 100;
}

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function amountCovered(actual: number, expected: number) {
  return Math.round((actual + Number.EPSILON) * 100) >= Math.round((expected + Number.EPSILON) * 100);
}

function signedAmount(directionId: number, amount: number) {
  return directionId === 2 ? -amount : amount;
}

function openSelectionHolds(sale: SaleDetail) {
  return sale.selectionHolds.some((hold) => hold.productHoldStatusId === 1 || hold.productHoldStatusId === 4);
}

export function ShipmentsPage() {
  const { request, session } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readShipmentFilters(params), [params]);
  const hasActiveFilters = Boolean(
    filters.clientSearch
    || filters.deliveryAgencyId
    || filters.deliveryStatusId
    || filters.date !== defaultShipmentFilters().date
  );
  const [searchInput, setSearchInput] = useState(filters.clientSearch);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getShipments>> | null>(null);
  const [agencies, setAgencies] = useState<Awaited<ReturnType<typeof getShipmentAgencies>>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saleDetail, setSaleDetail] = useState<SaleDetail | null>(null);
  const [saleDetailError, setSaleDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencyLoading, setAgencyLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [pendingAction, setPendingAction] = useState<ShipmentAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isAdmin = session?.user.roles.includes("Admin") ?? false;

  useEffect(() => {
    setHeading({ title: "Envíos", breadcrumbs: null });
    setAction(isAdmin ? <Link
      aria-label="Conciliar agencia"
      className="pw-topbar-create-action inline-flex min-h-10 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pw-brand-deep"
      to="/shipments/reconciliation"
    >
      <span aria-hidden="true" className="mr-1 text-lg leading-none">↔</span>
      Conciliar agencia
    </Link> : null);
    return () => {
      setHeading(null);
      setAction(null);
    };
  }, [isAdmin, setAction, setHeading]);

  useEffect(() => {
    setSearchInput(filters.clientSearch);
  }, [filters.clientSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput.trim() !== filters.clientSearch) {
        setParams(buildShipmentSearchParams({ ...filters, page: 1, clientSearch: searchInput.trim() }));
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [filters, searchInput, setParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getShipments(request, filters)
      .then((page) => {
        if (!active) return;
        setResult(page);
        if (!page.items.some((item) => item.id === selectedId)) {
          setSelectedId(page.items[0]?.id ?? null);
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError({
          message: caught instanceof Error ? caught.message : "No se pudieron cargar los envíos.",
          forbidden: caught instanceof Error && "status" in caught && caught.status === 403,
        });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, request, retry]);

  useEffect(() => {
    let active = true;
    setAgencyLoading(true);
    void getShipmentAgencies(request)
      .then((items) => { if (active) setAgencies(items); })
      .catch(() => { if (active) setAgencies([]); })
      .finally(() => { if (active) setAgencyLoading(false); });
    return () => { active = false; };
  }, [request]);

  const selected = result?.items.find((item) => item.id === selectedId) ?? result?.items[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setSaleDetail(null);
      setSaleDetailError(null);
      return undefined;
    }
    let active = true;
    setSaleDetail(null);
    setSaleDetailError(null);
    void getSale(request, selected.saleId)
      .then((sale) => { if (active) setSaleDetail(sale); })
      .catch((caught: unknown) => {
        if (active) setSaleDetailError(caught instanceof Error ? caught.message : "No se pudieron consultar los pagos de la venta.");
      });
    return () => { active = false; };
  }, [request, retry, selected?.id, selected?.saleId]);

  const update = (patch: Partial<typeof filters>) => {
    setParams(buildShipmentSearchParams({ ...filters, ...patch, page: patch.page ?? 1 }));
  };
  const clearFilters = () => {
    setSearchInput("");
    setParams(buildShipmentSearchParams({ ...filters, page: 1, clientSearch: "", date: defaultShipmentFilters().date, deliveryAgencyId: "", deliveryStatusId: "" }));
  };
  const updateDate = (value: string) => setParams(buildShipmentSearchParams({ ...filters, page: 1, date: value }));
  const productPaid = saleDetail ? paidAmount(saleDetail.paymentMovements.map((movement) => signedAmount(movement.movementDirectionId, movement.productAmount))) : 0;
  const selectedDelivery = saleDetail?.deliveries.find((delivery) => delivery.id === selected?.id) ?? null;
  const shippingPaid = selectedDelivery && saleDetail
    ? paidAmount(saleDetail.paymentMovements.filter((movement) => movement.saleDeliveryId === selectedDelivery.id).map((movement) => signedAmount(movement.movementDirectionId, movement.shippingAmount)))
    : 0;
  const canSend = Boolean(selectedDelivery && saleDetail && (
    selectedDelivery.deliveryAgencyCanCollectCashOnDelivery
    || (amountCovered(productPaid, saleDetail.total) && amountCovered(shippingPaid, selectedDelivery.shippingChargedToClient))
  ));
  const hasOpenSelection = saleDetail ? openSelectionHolds(saleDetail) : false;
  const canComplete = Boolean(selectedDelivery && saleDetail
    && amountCovered(productPaid, saleDetail.total)
    && amountCovered(shippingPaid, selectedDelivery.shippingChargedToClient));
  const isCodDelivery = selectedDelivery?.deliveryAgencyCanCollectCashOnDelivery ?? false;
  const requiresCodReconciliation = Boolean(isCodDelivery && selected && selected.amountToCollect > 0);
  const productBalance = saleDetail ? Math.max(0, roundMoney(saleDetail.total - productPaid)) : 0;
  const shippingBalance = selectedDelivery ? Math.max(0, roundMoney(selectedDelivery.shippingChargedToClient - shippingPaid)) : 0;

  const startAction = (action: ShipmentAction) => {
    setActionError(null);
    setPendingAction(action);
  };

  const dateInput = (id: string, label: string, value: string, onChange: (value: string) => void) => <label htmlFor={id} className="grid min-w-40 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted">
    {label}
    <input
      id={id}
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand"
    />
  </label>;

  const confirmAction = async () => {
    if (!selected || !pendingAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await runSaleDeliveryAction(request, selected.saleId, selected.id, pendingAction);
      setPendingAction(null);
      setRetry((value) => value + 1);
      showToast({ tone: "success", title: actionCopy[pendingAction].toast });
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "No se pudo actualizar el envío.";
      setActionError(message);
      showToast({ tone: "error", title: "No pudimos actualizar el envío", detail: message });
    } finally {
      setActionBusy(false);
    }
  };

  const searchControl = <label htmlFor="shipment-client-search" className="grid min-w-64 flex-[2] gap-1.5 text-xs font-extrabold text-pw-muted">
    Buscar clienta
    <input
      id="shipment-client-search"
      type="search"
      value={searchInput}
      onChange={(event) => setSearchInput(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
      placeholder="Nombre, teléfono, Instagram o Messenger"
      autoComplete="off"
      className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand"
    />
  </label>;
  const agencyControl = <label htmlFor="shipment-agency" className="grid min-w-48 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted">
    Agencia
    <SelectControl
      id="shipment-agency"
      aria-label="Agencia"
      value={filters.deliveryAgencyId}
      disabled={agencyLoading}
      options={[{ value: "", label: "Todas las agencias" }, ...agencies.map((agency) => ({ value: String(agency.id), label: agency.name }))]}
      onChange={(event) => update({ deliveryAgencyId: event.target.value })}
    />
  </label>;
  const statusControl = <label htmlFor="shipment-status" className="grid min-w-52 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted">
    Estado
    <SelectControl
      id="shipment-status"
      aria-label="Estado"
      value={filters.deliveryStatusId}
      options={[
        { value: "", label: "Todos los estados" },
        { value: "1", label: statusLabels[1] },
        { value: "4", label: statusLabels[4] },
        { value: "6", label: statusLabels[6] },
        { value: "2", label: statusLabels[2] },
        { value: "5", label: statusLabels[5] },
        { value: "3", label: statusLabels[3] },
      ]}
      onChange={(event) => update({ deliveryStatusId: event.target.value })}
    />
  </label>;

  return <div className="space-y-5">
    <FilterBar aria-label="Filtros de envíos" onSubmit={(event) => event.preventDefault()}>
      {searchControl}
      {dateInput("shipment-date", "Fecha", filters.date, updateDate)}
      {agencyControl}{statusControl}
      {hasActiveFilters ? <button type="button" onClick={clearFilters} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm font-bold text-pw-ink hover:bg-pw-canvas">Limpiar filtros</button> : null}
    </FilterBar>

    {loading ? <LoadingState /> : null}
    {!loading && error?.forbidden ? <EmptyState title="Acceso restringido" description="No tienes permiso para consultar los envíos." action={<Link to="/" className="underline underline-offset-4">Volver al inicio</Link>} /> : null}
    {!loading && error && !error.forbidden ? <ErrorState title="No pudimos cargar los envíos" description={error.message} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {!loading && !error && result?.totalCount === 0 ? <EmptyState title="No hay envíos que coincidan" description={hasActiveFilters ? "Prueba con otra clienta, fecha, agencia o estado." : "No hay envíos registrados para esta fecha."} action={hasActiveFilters ? <button type="button" onClick={clearFilters} className="min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white">Limpiar filtros</button> : undefined} /> : null}

    {!loading && !error && result && result.totalCount > 0 ? <>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.65fr)]">
        <section className="min-w-0 space-y-3" aria-label="Resultados de envíos">
          <div className="overflow-x-auto rounded-xl border border-pw-line bg-white">
            <table aria-label="Envíos registrados" className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-pw-brand-soft text-xs uppercase text-pw-ink">
                <tr>{["Código envío", "Venta", "Clienta", "Destino", "Agencia", "Estado"].map((heading) => <th key={heading} scope="col" className="border-b border-pw-brand/35 px-3 py-3 font-extrabold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-pw-line">
                {result.items.map((shipment) => <tr key={shipment.id} className={shipment.id === selected?.id ? "bg-pw-brand-soft/60" : "hover:bg-pw-canvas/70"}>
                  <td className="px-3 py-3"><button type="button" aria-pressed={shipment.id === selected?.id} onClick={() => setSelectedId(shipment.id)} className="rounded-sm text-left font-extrabold text-pw-brand-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-pw-brand focus-visible:outline-offset-2">{shipment.code}</button><small className="mt-1 block text-xs text-pw-muted">{date(shipment.createdAt)}</small></td>
                  <td className="px-3 py-3"><Link to={`/sales/${shipment.saleId}`} className="font-bold text-pw-ink underline decoration-pw-brand/50 underline-offset-4 hover:decoration-pw-brand focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-pw-brand focus-visible:outline-offset-2">Venta #{shipment.saleId}</Link></td>
                  <td className="px-3 py-3">{shipment.clientName || "Clienta no disponible"}</td>
                  <td className="px-3 py-3"><span className="font-bold">{shipment.municipalityName || "—"}</span></td>
                  <td className="px-3 py-3">{shipment.deliveryAgencyName || "—"}</td>
                  <td className="px-3 py-3"><StatusBadge tone={statusTones[shipment.deliveryStatusId] ?? "neutral"}>{deliveryStatusName(shipment)}</StatusBadge></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(page) => update({ page })} />
        </section>

        {selected ? <aside aria-label={`Detalle del envío ${selected.code}`} className="space-y-4 rounded-xl border border-pw-line bg-white p-4 sm:p-5 xl:sticky xl:top-5">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-pw-muted">Detalle de envío</p><h2 className="mt-1 break-all text-xl font-extrabold text-pw-ink">{selected.code}</h2><Link to={`/sales/${selected.saleId}`} className="mt-1 inline-flex min-h-8 items-center text-sm font-bold text-pw-brand-deep underline-offset-4 hover:underline">Ver venta #{selected.saleId}</Link></div>
            <StatusBadge tone={statusTones[selected.deliveryStatusId] ?? "neutral"}>{deliveryStatusName(selected)}</StatusBadge>
          </header>
          <section className="border-t border-pw-line pt-4">
            <div><h3 className="font-extrabold">{selected.clientName || "Clienta no disponible"}</h3><p className="mt-1 text-sm text-pw-muted">{selected.clientPhone || "Sin teléfono registrado"}</p></div>
            {(selected.clientInstagramUser || selected.clientMessengerUser) ? <p className="mt-2 text-sm text-pw-muted">{[selected.clientInstagramUser, selected.clientMessengerUser].filter(Boolean).join(" · ")}</p> : null}
          </section>
          <section className="border-t border-pw-line pt-4"><h3 className="font-extrabold">Destino</h3><p className="mt-1 text-sm font-bold">{selected.municipalityName || "Municipio no disponible"}</p><p className="mt-1 break-words text-sm text-pw-muted">{selected.deliveryAddress || "Usar dirección registrada en la clienta"}</p></section>
          <dl className="grid grid-cols-2 gap-3 border-t border-pw-line pt-4 text-sm"><div><dt className="text-xs font-bold text-pw-muted">Agencia</dt><dd className="mt-1 font-bold">{selected.deliveryAgencyName || "—"}</dd></div><div><dt className="text-xs font-bold text-pw-muted">Fecha</dt><dd className="mt-1 font-bold">{date(selected.createdAt)}</dd></div><div><dt className="text-xs font-bold text-pw-muted">Envío cobrado</dt><dd className="mt-1 text-lg font-extrabold tabular-nums text-pw-brand-deep">{currency.format(selected.shippingChargedToClient)}</dd></div><div><dt className="text-xs font-bold text-pw-muted">Saldo contra entrega</dt><dd className="mt-1 text-lg font-extrabold tabular-nums text-pw-brand-deep">{currency.format(selected.amountToCollect)}</dd></div></dl>
          {selected.comments ? <section className="border-t border-pw-line pt-4"><h3 className="font-extrabold">Nota del envío</h3><p className="mt-1 whitespace-pre-wrap text-sm text-pw-muted">{selected.comments}</p></section> : null}
          {saleDetailError ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950" role="status">No se pudieron cargar los datos de pago para habilitar las acciones. {saleDetailError}</p> : null}
          {saleDetail && selected.deliveryStatusId === 1 && !canSend && !selectedDelivery?.deliveryAgencyCanCollectCashOnDelivery ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Para despachar, la venta y el costo del envío deben estar pagados.</p> : null}
          {selected.deliveryStatusId === 5 ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Para volver a intentar la entrega, crea un nuevo envío desde la venta.</p> : null}
          <div className="flex flex-wrap gap-2 border-t border-pw-line pt-4">
            {selected.deliveryStatusId === 1 && canSend ? <button type="button" disabled={actionBusy} onClick={() => startAction("send")} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:opacity-60">Marcar despachada</button> : null}
            {isAdmin && selected.deliveryStatusId === 1 ? <button type="button" disabled={actionBusy} onClick={() => startAction("cancel")} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">Cancelar envío</button> : null}
            {isAdmin && selected.deliveryStatusId === 4 && !requiresCodReconciliation && canComplete ? <button type="button" disabled={actionBusy} onClick={() => startAction(hasOpenSelection ? "delivered-pending-selection" : "complete")} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:opacity-60">Confirmar entrega</button> : null}
            {isAdmin && selected.deliveryStatusId === 4 ? <button type="button" disabled={actionBusy} onClick={() => startAction("fail")} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold hover:bg-pw-canvas disabled:opacity-60">Registrar falla</button> : null}
            {isAdmin && selected.deliveryStatusId === 6 && canComplete && !hasOpenSelection ? <button type="button" disabled={actionBusy} onClick={() => startAction("complete")} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:opacity-60">Finalizar entrega</button> : null}
            {isAdmin && selected.deliveryStatusId === 6 && hasOpenSelection ? <p className="w-full text-sm text-pw-muted">Resuelve las prendas de selección pendientes antes de finalizar.</p> : null}
            {selected.deliveryStatusId === 4 && saleDetail && !canComplete && !requiresCodReconciliation ? <p className="w-full text-sm text-pw-muted">Completa el pago pendiente antes de confirmar: productos {currency.format(productBalance)} · envío {currency.format(shippingBalance)}.</p> : null}
          </div>
        </aside> : null}
      </div>
    </> : null}

    {pendingAction ? <ConfirmDialog
      open
      title={actionCopy[pendingAction].title}
      description={actionCopy[pendingAction].description}
      confirmLabel={actionCopy[pendingAction].confirmLabel}
      error={actionError}
      isPending={actionBusy}
      onConfirm={() => void confirmAction()}
      onClose={() => { if (!actionBusy) { setPendingAction(null); setActionError(null); } }}
    /> : null}
  </div>;
}
