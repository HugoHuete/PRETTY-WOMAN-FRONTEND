import { dateWithCurrentManaguaTime } from "../../shared/date/current-time";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { useToast } from "../../shared/ui/toast-context";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import {
  createShipmentReconciliation,
  getPendingReconciliationDeliveries,
  getPendingPostSaleDeliveries,
  getShipmentAgencies,
} from "./shipments-api";
import type {
  CreateShipmentReconciliationPayload,
  PendingReconciliationDelivery,
  PendingPostSaleDelivery,
} from "./shipments-types";

type DeliveryDraft = {
  selected: boolean;
  amountCollectedNio: string;
  amountCollectedUsd: string;
  changeGivenNio: string;
  shippingPaidToAgency: string;
};

const currency = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const statusLabels: Record<number, string> = {
  2: "Entregada",
  4: "En tránsito",
  5: "Entrega fallida",
};
const statusTones: Record<number, "success" | "warning" | "danger" | "info" | "neutral"> = {
  2: "success",
  4: "info",
  5: "danger",
};
const statusTextClasses = {
  success: "text-green-800",
  warning: "text-amber-900",
  danger: "text-red-800",
  info: "text-sky-800",
  neutral: "text-stone-700",
} as const;
const postSaleStatusLabels: Record<number, string> = { 2: "En tránsito", 3: "Completado" };
const postSaleStatusClasses: Record<number, string> = { 2: statusTextClasses.info, 3: statusTextClasses.success };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function amount(value: string) {
  return roundMoney(numeric(value));
}

function exchangeRate(value: string) {
  return Math.round((numeric(value) + Number.EPSILON) * 100) / 100;
}

function managuaDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Managua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function managuaToday() {
  return managuaDate(new Date());
}

function deliveryLocalDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : managuaDate(date);
}

function makeDeliveryDraft(delivery: PendingReconciliationDelivery): DeliveryDraft {
  const expected = delivery.deliveryStatusId === 5 ? 0 : delivery.amountToCollect;
  return {
    selected: true,
    amountCollectedNio: expected > 0 ? expected.toFixed(2) : "0",
    amountCollectedUsd: "0",
    changeGivenNio: "0",
    shippingPaidToAgency: delivery.shippingChargedToClient.toFixed(2),
  };
}

function makePostSaleDeliveryDraft(delivery: PendingPostSaleDelivery): DeliveryDraft {
  const expected = delivery.saleExchangeId ? delivery.amountToCollect : 0;
  return {
    selected: true,
    amountCollectedNio: expected > 0 ? expected.toFixed(2) : "0",
    amountCollectedUsd: "0",
    changeGivenNio: "0",
    shippingPaidToAgency: delivery.shippingChargedToClient.toFixed(2),
  };
}

function isPostSaleReturn(delivery: PendingPostSaleDelivery) {
  return delivery.saleReturnId !== null;
}

function collectedNet(draft: DeliveryDraft, conversionRate: string) {
  return roundMoney(
    amount(draft.amountCollectedNio)
      + amount(draft.amountCollectedUsd) * exchangeRate(conversionRate)
      - amount(draft.changeGivenNio),
  );
}

function formControlClassName({ compact = false, prefixed = false, compactWidth = "w-20" }: { compact?: boolean; prefixed?: boolean; compactWidth?: "w-20" | "w-24" | "w-[7rem]" } = {}) {
  const heightAndPadding = compact ? `min-h-9 ${compactWidth} px-2 text-xs` : "min-h-10 w-full px-3 text-sm";
  const prefixPadding = prefixed ? compact ? "pl-8" : "pl-10" : "";
  return `rounded-lg border border-pw-line bg-white ${heightAndPadding} ${prefixPadding} tabular-nums text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand disabled:cursor-not-allowed disabled:bg-pw-canvas disabled:text-pw-muted`;
}

function MoneyInput({
  id,
  value,
  prefix,
  disabled,
  onChange,
  compact = false,
  ariaLabel,
  compactWidth = "w-20",
}: {
  id: string;
  value: string;
  prefix: "C$" | "US$";
  disabled: boolean;
  onChange: (value: string) => void;
  compact?: boolean;
  ariaLabel?: string;
  compactWidth?: "w-20" | "w-24" | "w-[7rem]";
}) {
  return <div className="relative min-w-0">
    <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-pw-muted ${compact ? "left-2" : ""}`}>{prefix}</span>
    <input
      id={id}
      className={`${formControlClassName({ compact, prefixed: true, compactWidth })} pw-number-input`}
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>;
}

export function ShipmentReconciliationPage() {
  const { request } = useAuth();
  const { storeRate, status: exchangeRateStatus } = useExchangeRate();
  const { setAction, setHeading } = usePageActions();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<Awaited<ReturnType<typeof getShipmentAgencies>>>([]);
  const [agencyLoading, setAgencyLoading] = useState(true);
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [deliveryAgencyId, setDeliveryAgencyId] = useState("");
  const [deliveries, setDeliveries] = useState<PendingReconciliationDelivery[]>([]);
  const [postSaleDeliveries, setPostSaleDeliveries] = useState<PendingPostSaleDelivery[]>([]);
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<number, DeliveryDraft>>({});
  const [postSaleDeliveryDrafts, setPostSaleDeliveryDrafts] = useState<Record<number, DeliveryDraft>>({});
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [reconciliationDate, setReconciliationDate] = useState(managuaToday);
  const [shipmentDate, setShipmentDate] = useState("");
  const [settlementExchangeRate, setSettlementExchangeRate] = useState("");
  const [rateEdited, setRateEdited] = useState(false);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setHeading({ title: "Conciliar agencia", breadcrumbs: <Link className="underline underline-offset-4 hover:text-pw-brand-deep" to="/shipments">← Envíos</Link> });
    setAction(null);
    return () => {
      setHeading(null);
      setAction(null);
    };
  }, [setAction, setHeading]);

  useEffect(() => {
    if (storeRate && !rateEdited) setSettlementExchangeRate(storeRate.toFixed(2));
  }, [storeRate, rateEdited]);

  useEffect(() => {
    let active = true;
    setAgencyLoading(true);
    setAgencyError(null);
    void getShipmentAgencies(request)
      .then((items) => { if (active) setAgencies(items); })
      .catch((caught: unknown) => {
        if (active) setAgencyError(caught instanceof Error ? caught.message : "No se pudieron cargar las agencias.");
      })
      .finally(() => { if (active) setAgencyLoading(false); });
    return () => { active = false; };
  }, [request, retry]);

  useEffect(() => {
    if (!deliveryAgencyId) {
      setDeliveries([]);
      setPostSaleDeliveries([]);
      setDeliveryDrafts({});
      setPostSaleDeliveryDrafts({});
      setPendingError(null);
      return undefined;
    }

    let active = true;
    setPendingLoading(true);
    setPendingError(null);
    setSaveError(null);
    const agencyId = Number(deliveryAgencyId);
    void Promise.all([
      getPendingReconciliationDeliveries(request, agencyId),
      getPendingPostSaleDeliveries(request, agencyId),
    ])
      .then(([pendingDeliveries, pendingPostSaleDeliveries]) => {
        if (!active) return;
        setDeliveries(pendingDeliveries);
        setPostSaleDeliveries(pendingPostSaleDeliveries);
        setDeliveryDrafts(Object.fromEntries(pendingDeliveries.map((delivery) => [delivery.saleDeliveryId, makeDeliveryDraft(delivery)])));
        setPostSaleDeliveryDrafts(Object.fromEntries(pendingPostSaleDeliveries.map((delivery) => [delivery.id, makePostSaleDeliveryDraft(delivery)])));
      })
      .catch((caught: unknown) => {
        if (active) setPendingError(caught instanceof Error ? caught.message : "No se pudieron cargar los pendientes de la agencia.");
      })
      .finally(() => { if (active) setPendingLoading(false); });
    return () => { active = false; };
  }, [deliveryAgencyId, request, retry]);

  const updateDeliveryDraft = (id: number, patch: Partial<DeliveryDraft>) => {
    setDeliveryDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };
  const updatePostSaleDeliveryDraft = (id: number, patch: Partial<DeliveryDraft>) => {
    setPostSaleDeliveryDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const selectedDeliveries = useMemo(
    () => deliveries.filter((delivery) => deliveryDrafts[delivery.saleDeliveryId]?.selected),
    [deliveries, deliveryDrafts],
  );
  const selectedPostSaleDeliveries = useMemo(
    () => postSaleDeliveries.filter((delivery) => postSaleDeliveryDrafts[delivery.id]?.selected),
    [postSaleDeliveries, postSaleDeliveryDrafts],
  );
  const visibleDeliveries = useMemo(
    () => shipmentDate
      ? deliveries.filter((delivery) => deliveryLocalDate(delivery.createdAt) === shipmentDate)
      : deliveries,
    [deliveries, shipmentDate],
  );
  const visiblePostSaleDeliveries = useMemo(
    () => shipmentDate
      ? postSaleDeliveries.filter((delivery) => deliveryLocalDate(delivery.createdAt) === shipmentDate)
      : postSaleDeliveries,
    [postSaleDeliveries, shipmentDate],
  );
  const allVisibleDeliveriesSelected = visibleDeliveries.length > 0
    && visibleDeliveries.every((delivery) => deliveryDrafts[delivery.saleDeliveryId]?.selected);
  const someVisibleDeliveriesSelected = visibleDeliveries.some((delivery) => deliveryDrafts[delivery.saleDeliveryId]?.selected);
  const selectAllDeliveriesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllDeliveriesRef.current) {
      selectAllDeliveriesRef.current.indeterminate = someVisibleDeliveriesSelected && !allVisibleDeliveriesSelected;
    }
  }, [allVisibleDeliveriesSelected, someVisibleDeliveriesSelected]);
  const selectedCount = selectedDeliveries.length + selectedPostSaleDeliveries.length;
  const totals = useMemo(() => {
    const receivedNio = roundMoney(
      selectedDeliveries.reduce((total, delivery) => {
        const draft = deliveryDrafts[delivery.saleDeliveryId];
        if (!draft) return total;
        return total + amount(draft.amountCollectedNio) + amount(draft.amountCollectedUsd) * exchangeRate(settlementExchangeRate);
      }, 0)
      + selectedPostSaleDeliveries.reduce((total, delivery) => {
        const draft = postSaleDeliveryDrafts[delivery.id];
        if (!draft) return total;
        return total + amount(draft.amountCollectedNio) + amount(draft.amountCollectedUsd) * exchangeRate(settlementExchangeRate);
      }, 0),
    );
    const returnedChange = roundMoney(
      selectedDeliveries.reduce((total, delivery) => total + amount(deliveryDrafts[delivery.saleDeliveryId]?.changeGivenNio ?? "0"), 0)
      + selectedPostSaleDeliveries.reduce((total, delivery) => total + amount(postSaleDeliveryDrafts[delivery.id]?.changeGivenNio ?? "0"), 0),
    );
    const agencyFees = roundMoney(
      selectedDeliveries.reduce((total, delivery) => total + amount(deliveryDrafts[delivery.saleDeliveryId]?.shippingPaidToAgency ?? "0"), 0)
      + selectedPostSaleDeliveries.reduce((total, delivery) => total + amount(postSaleDeliveryDrafts[delivery.id]?.shippingPaidToAgency ?? "0"), 0),
    );
    const expectedCollection = roundMoney(
      selectedDeliveries.reduce((total, delivery) => total + collectedNet(deliveryDrafts[delivery.saleDeliveryId], settlementExchangeRate), 0)
      + selectedPostSaleDeliveries.reduce((total, delivery) => total + collectedNet(postSaleDeliveryDrafts[delivery.id], settlementExchangeRate), 0),
    );
    return {
      receivedNio,
      returnedChange,
      agencyPayments: roundMoney(returnedChange + agencyFees),
      netRemittance: roundMoney(receivedNio - returnedChange - agencyFees),
      expectedCollection,
    };
  }, [deliveryDrafts, postSaleDeliveryDrafts, selectedDeliveries, selectedPostSaleDeliveries, settlementExchangeRate]);

  const settlementRate = exchangeRate(settlementExchangeRate);
  const deliveriesAreValid = selectedDeliveries.every((delivery) => {
    const draft = deliveryDrafts[delivery.saleDeliveryId];
    if (!draft) return false;
    const nio = amount(draft.amountCollectedNio);
    const usd = amount(draft.amountCollectedUsd);
    const change = amount(draft.changeGivenNio);
    const rate = settlementRate;
    const netCollected = collectedNet(draft, settlementExchangeRate);
    if ([nio, usd, change, rate, amount(draft.shippingPaidToAgency)].some((value) => value < 0)) return false;
    if (change > nio + usd * rate) return false;
    if (usd > 0 && rate <= 0) return false;
    if (delivery.deliveryStatusId === 5 && netCollected !== 0) return false;
    const expected = roundMoney(delivery.amountToCollect);
    if (netCollected > expected) return false;
    if (delivery.deliveryStatusId === 4 && netCollected !== expected) return false;
    return true;
  });
  const postSaleDeliveriesAreValid = selectedPostSaleDeliveries.every((delivery) => {
    const draft = postSaleDeliveryDrafts[delivery.id];
    if (!draft) return false;
    const nio = amount(draft.amountCollectedNio);
    const usd = amount(draft.amountCollectedUsd);
    const change = amount(draft.changeGivenNio);
    const netCollected = collectedNet(draft, settlementExchangeRate);
    if ([nio, usd, change, settlementRate, amount(draft.shippingPaidToAgency)].some((value) => value < 0)) return false;
    if (change > nio + usd * settlementRate) return false;
    if (usd > 0 && settlementRate <= 0) return false;
    if (isPostSaleReturn(delivery)) return netCollected === 0;
    return netCollected === roundMoney(delivery.amountToCollect);
  });
  const draftsAreValid = deliveriesAreValid && postSaleDeliveriesAreValid;
  const canSubmit = selectedCount > 0 && Boolean(reconciliationDate) && settlementRate > 0 && draftsAreValid && !saving && !pendingLoading;

  const selectAgency = (value: string) => {
    setDeliveryAgencyId(value);
    setRateEdited(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setSaveError(null);
    const payload: CreateShipmentReconciliationPayload = {
      deliveryAgencyId: Number(deliveryAgencyId),
      reconciliationDate: reconciliationDate ? dateWithCurrentManaguaTime(reconciliationDate) : undefined,
      settlementExchangeRate: settlementRate,
      comments: comments.trim() || undefined,
      deliveries: selectedDeliveries.map((delivery) => {
        const draft = deliveryDrafts[delivery.saleDeliveryId];
        const amountCollectedUsd = amount(draft.amountCollectedUsd);
        return {
          saleDeliveryId: delivery.saleDeliveryId,
          amountCollectedNio: amount(draft.amountCollectedNio),
          amountCollectedUsd,
          changeGivenNio: amount(draft.changeGivenNio),
          ...(amountCollectedUsd > 0 ? { collectionExchangeRate: settlementRate } : {}),
          shippingPaidToAgency: amount(draft.shippingPaidToAgency),
        };
      }),
      postSaleDeliveries: selectedPostSaleDeliveries.map((delivery) => {
        const draft = postSaleDeliveryDrafts[delivery.id];
        const amountCollectedUsd = amount(draft.amountCollectedUsd);
        return {
          postSaleDeliveryId: delivery.id,
          amountCollectedNio: amount(draft.amountCollectedNio),
          amountCollectedUsd,
          changeGivenNio: amount(draft.changeGivenNio),
          shippingPaidToAgency: amount(draft.shippingPaidToAgency),
          ...(amountCollectedUsd > 0 ? { collectionExchangeRate: settlementRate } : {}),
        };
      }),
    };

    try {
      const reconciliationId = await createShipmentReconciliation(request, payload);
      showToast({ tone: "success", title: `Conciliación #${reconciliationId} registrada.` });
      navigate("/shipments");
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "No se pudo registrar la conciliación.";
      setSaveError(message);
      showToast({ tone: "error", title: "No pudimos registrar la conciliación", detail: message });
    } finally {
      setSaving(false);
    }
  };

  const agencyOptions = [
    { value: "", label: agencyLoading ? "Cargando agencias…" : "Selecciona una agencia" },
    ...agencies.map((agency) => ({ value: String(agency.id), label: agency.name })),
  ];
  return <div className="space-y-5">
    <section aria-label="Datos de la conciliación" className="grid gap-4 rounded-xl border border-pw-line bg-white p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(15rem,1.2fr)_repeat(3,minmax(10rem,0.8fr))]">
      <label htmlFor="reconciliation-agency" className="grid min-w-0 gap-1.5 text-xs font-extrabold text-pw-muted">
        Agencia
        <SelectControl
          id="reconciliation-agency"
          aria-label="Agencia de envío"
          value={deliveryAgencyId}
          disabled={agencyLoading || agencies.length === 0 || saving}
          required
          options={agencyOptions}
          onChange={(event) => selectAgency(event.target.value)}
        />
      </label>
      <label htmlFor="reconciliation-date" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
        Fecha de liquidación
        <input id="reconciliation-date" className={formControlClassName()} type="date" required value={reconciliationDate} disabled={saving} onChange={(event) => setReconciliationDate(event.target.value)} />
      </label>
      <label htmlFor="reconciliation-shipment-date" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
        Fecha del envío
        <input id="reconciliation-shipment-date" className={formControlClassName()} type="date" value={shipmentDate} disabled={saving} onChange={(event) => {
          const nextDate = event.target.value;
          setShipmentDate(nextDate);
          setDeliveryDrafts((current) => Object.fromEntries(deliveries.map((delivery) => {
            const draft = current[delivery.saleDeliveryId] ?? makeDeliveryDraft(delivery);
            const belongsToSelectedDate = !nextDate || deliveryLocalDate(delivery.createdAt) === nextDate;
            return [delivery.saleDeliveryId, { ...draft, selected: belongsToSelectedDate }];
          })));
          setPostSaleDeliveryDrafts((current) => Object.fromEntries(postSaleDeliveries.map((delivery) => {
            const draft = current[delivery.id] ?? makePostSaleDeliveryDraft(delivery);
            const belongsToSelectedDate = !nextDate || deliveryLocalDate(delivery.createdAt) === nextDate;
            return [delivery.id, { ...draft, selected: belongsToSelectedDate }];
          })));
        }} />
      </label>
      <label htmlFor="reconciliation-rate" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
        Tasa de cambio USD a C$
        <input id="reconciliation-rate" className={`${formControlClassName()} pw-number-input`} type="number" min="0.01" step="0.01" inputMode="decimal" value={settlementExchangeRate} disabled={saving} onChange={(event) => { setSettlementExchangeRate(event.target.value); setRateEdited(true); }} onBlur={() => {
          if (settlementExchangeRate) setSettlementExchangeRate(exchangeRate(settlementExchangeRate).toFixed(2));
        }} />
      </label>
    </section>

    {agencyError ? <ErrorState title="No pudimos cargar las agencias" description={agencyError} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {!agencyError && !agencyLoading && agencies.length === 0 ? <EmptyState title="No hay agencias activas" description="Activa una agencia de envío antes de preparar una conciliación." /> : null}
    {!agencyError && !deliveryAgencyId ? <EmptyState title="Selecciona una agencia" description="Mostraremos los envíos normales y postventa que aún puedes incluir en su liquidación." /> : null}
    {deliveryAgencyId && pendingLoading ? <LoadingState /> : null}
    {deliveryAgencyId && pendingError && !pendingLoading ? <ErrorState title="No pudimos cargar los pendientes" description={pendingError} onRetry={() => setRetry((value) => value + 1)} /> : null}

    {deliveryAgencyId && !pendingLoading && !pendingError ? <>
      {deliveries.length === 0 && postSaleDeliveries.length === 0 ? <EmptyState title="No hay movimientos pendientes" description="Esta agencia no tiene envíos normales ni postventa por conciliar." /> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="pending-deliveries-heading" className="rounded-xl border border-pw-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-pw-line pb-3">
              <h2 id="pending-deliveries-heading" className="text-base font-extrabold text-pw-ink">Envíos pendientes</h2>
              <span className="text-sm text-pw-muted">{shipmentDate ? `${visibleDeliveries.length} de ${deliveries.length} envíos` : `${deliveries.length} ${deliveries.length === 1 ? "envío" : "envíos"}`}</span>
            </div>
            {visibleDeliveries.length ? <div className="overflow-x-auto">
              <table aria-label="Envíos pendientes para conciliar" className="w-full min-w-[54rem] table-fixed border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-pw-line text-[10px] font-bold uppercase tracking-wide text-pw-muted">
                    <th className="w-10 py-3 pr-2">
                      <input
                        ref={selectAllDeliveriesRef}
                        aria-label="Seleccionar todos los envíos visibles"
                        className="size-4 accent-pw-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand"
                        type="checkbox"
                        checked={allVisibleDeliveriesSelected}
                        disabled={saving || visibleDeliveries.length === 0}
                        onChange={(event) => {
                          const selected = event.target.checked;
                          setDeliveryDrafts((current) => {
                            const next = { ...current };
                            for (const delivery of visibleDeliveries) {
                              const draft = current[delivery.saleDeliveryId] ?? makeDeliveryDraft(delivery);
                              next[delivery.saleDeliveryId] = { ...draft, selected };
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th scope="col" className="w-[10rem] py-3 pr-1">Envío</th>
                    <th scope="col" className="w-[5.5rem] py-3 pr-1">Estado</th>
                    <th scope="col" className="w-[4.5rem] py-3 pr-1">Envío cobrado</th>
                    <th scope="col" className="w-[5.5rem] py-3 pr-1">Envío pagado</th>
                    <th scope="col" className="w-24 py-3 pr-1">Monto por cobrar</th>
                    <th scope="col" className="w-32 py-3 pr-1">Recibido en C$</th>
                    <th scope="col" className="w-32 py-3 pr-1">Recibido en US$</th>
                    <th scope="col" className="w-32 py-3">Vuelto en C$</th>
                  </tr>
                </thead>
                {visibleDeliveries.map((delivery) => {
                  const draft = deliveryDrafts[delivery.saleDeliveryId] ?? makeDeliveryDraft(delivery);
                  const failed = delivery.deliveryStatusId === 5;
                  const amountToCollect = failed ? 0 : delivery.amountToCollect;
                  const net = collectedNet(draft, settlementExchangeRate);
                  return <tbody key={delivery.saleDeliveryId}>
                    <tr className="border-b border-pw-line align-top last:border-b-0">
                      <td className="py-4 pr-2">
                        <input
                          aria-label={`Incluir envío ${delivery.code}`}
                          className="size-4 accent-pw-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand"
                          type="checkbox"
                          checked={draft.selected}
                          disabled={saving}
                          onChange={(event) => updateDeliveryDraft(delivery.saleDeliveryId, { selected: event.target.checked })}
                        />
                      </td>
                      <td className="w-[10rem] max-w-[10rem] py-4 pr-1">
                        <div className="grid min-w-0 justify-items-start gap-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><Link aria-label={`Abrir envío ${delivery.code}`} to={`/sales/${delivery.saleId}#delivery-${delivery.saleDeliveryId}`} className="inline-flex rounded bg-pw-brand-soft px-1.5 py-0.5 text-xs font-extrabold text-pw-brand-deep hover:bg-pw-brand/10 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-pw-brand focus-visible:outline-offset-2">{delivery.code}</Link><span className="min-w-0 break-words text-xs text-pw-muted">{delivery.clientName || "Clienta no disponible"}</span></div>
                          <span className="text-xs text-pw-muted">Venta #{delivery.saleId}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-1"><span className={`text-xs font-bold ${statusTextClasses[statusTones[delivery.deliveryStatusId] ?? "neutral"]}`}>{statusLabels[delivery.deliveryStatusId] ?? delivery.deliveryStatusName ?? "Estado desconocido"}</span></td>
                      <td className="py-4 pr-1 font-bold tabular-nums">{currency.format(delivery.shippingChargedToClient)}</td>
                      <td className="py-3 pr-1">
                        <MoneyInput
                          id={`reconciliation-delivery-shipping-${delivery.saleDeliveryId}`}
                          value={draft.shippingPaidToAgency}
                          prefix="C$"
                          compact
                          disabled={saving || !draft.selected}
                          onChange={(value) => updateDeliveryDraft(delivery.saleDeliveryId, { shippingPaidToAgency: value })}
                        />
                      </td>
                      <td className="w-24 py-3 pr-1 font-bold tabular-nums">
                        <span>{currency.format(net)}</span>
                        <span className="block text-xs font-normal text-pw-muted">de {currency.format(amountToCollect)}</span>
                      </td>
                      <td className="py-3 pr-1">
                        <MoneyInput id={`reconciliation-delivery-nio-${delivery.saleDeliveryId}`} ariaLabel="Recibido en C$" value={draft.amountCollectedNio} prefix="C$" compact compactWidth="w-[7rem]" disabled={saving || failed || !draft.selected} onChange={(value) => updateDeliveryDraft(delivery.saleDeliveryId, { amountCollectedNio: value })} />
                      </td>
                      <td className="py-3 pr-1">
                        <MoneyInput id={`reconciliation-delivery-usd-${delivery.saleDeliveryId}`} ariaLabel="Recibido en US$" value={draft.amountCollectedUsd} prefix="US$" compact compactWidth="w-[7rem]" disabled={saving || failed || !draft.selected} onChange={(value) => {
                          const amountReceived = amount(draft.amountCollectedNio) + amount(value) * exchangeRate(settlementExchangeRate);
                          const changeGivenNio = Math.max(0, roundMoney(amountReceived - amountToCollect));
                          updateDeliveryDraft(delivery.saleDeliveryId, { amountCollectedUsd: value, changeGivenNio: changeGivenNio.toFixed(2) });
                        }} />
                      </td>
                      <td className="py-3">
                        <MoneyInput id={`reconciliation-delivery-change-${delivery.saleDeliveryId}`} ariaLabel="Vuelto entregado en C$" value={draft.changeGivenNio} prefix="C$" compact compactWidth="w-[7rem]" disabled={saving || failed || !draft.selected || amount(draft.amountCollectedUsd) <= 0} onChange={(value) => updateDeliveryDraft(delivery.saleDeliveryId, { changeGivenNio: value })} />
                      </td>
                    </tr>
                  </tbody>;
                })}
              </table>
            </div> : <p className="pt-4 text-sm text-pw-muted">{shipmentDate ? "No hay envíos pendientes para esta fecha." : "No hay envíos pendientes para esta agencia."}</p>}
          </section>

          <section aria-labelledby="pending-post-sale-heading" className="rounded-xl border border-pw-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-pw-line pb-3">
              <h2 id="pending-post-sale-heading" className="text-base font-extrabold text-pw-ink">Envíos postventa pendientes</h2>
              <span className="text-sm text-pw-muted">{shipmentDate ? `${visiblePostSaleDeliveries.length} de ${postSaleDeliveries.length} envíos` : `${postSaleDeliveries.length} ${postSaleDeliveries.length === 1 ? "envío" : "envíos"}`}</span>
            </div>
            {visiblePostSaleDeliveries.length ? <div className="overflow-x-auto">
              <table aria-label="Envíos postventa pendientes para conciliar" className="w-full min-w-[55rem] table-fixed border-collapse text-left text-sm">
                <thead><tr className="border-b border-pw-line text-[10px] font-bold uppercase tracking-wide text-pw-muted"><th className="w-10 py-3 pr-2">Incluir</th><th className="w-[10rem] py-3 pr-1">Envío</th><th className="w-[5.5rem] py-3 pr-1">Estado</th><th className="w-[4.5rem] py-3 pr-1">Envío cobrado</th><th className="w-[5.5rem] py-3 pr-1">Envío pagado</th><th className="w-24 py-3 pr-1">Monto por cobrar</th><th className="w-32 py-3 pr-1">Recibido en C$</th><th className="w-32 py-3 pr-1">Recibido en US$</th><th className="w-32 py-3">Vuelto en C$</th></tr></thead>
                <tbody>{visiblePostSaleDeliveries.map((delivery) => {
                  const draft = postSaleDeliveryDrafts[delivery.id] ?? makePostSaleDeliveryDraft(delivery);
                  const isReturn = isPostSaleReturn(delivery);
                  const net = collectedNet(draft, settlementExchangeRate);
                  const code = delivery.code || `Postventa #${delivery.id}`;
                  return <tr key={delivery.id} className="border-b border-pw-line align-top last:border-b-0">
                    <td className="py-4 pr-2"><input aria-label={`Incluir envío postventa ${code}`} className="size-4 accent-pw-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand" type="checkbox" checked={draft.selected} disabled={saving} onChange={(event) => updatePostSaleDeliveryDraft(delivery.id, { selected: event.target.checked })} /></td>
                    <td className="py-4 pr-1"><div className="grid min-w-0 justify-items-start gap-1"><div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><Link aria-label={`Abrir envío postventa ${code}`} to={`/sales/${delivery.saleId}#sale-post-sale-title`} className="inline-flex rounded bg-pw-brand-soft px-1.5 py-0.5 text-xs font-extrabold text-pw-brand-deep hover:bg-pw-brand/10">{code}</Link><span className="min-w-0 break-words text-xs text-pw-muted">{delivery.clientName || "Clienta no disponible"}</span></div><span className="text-xs font-bold text-pw-muted">{isReturn ? "Devolución" : "Cambio"} · Venta #{delivery.saleId}</span></div></td>
                    <td className="py-4 pr-1"><span className={`text-xs font-bold ${postSaleStatusClasses[delivery.statusId] ?? statusTextClasses.neutral}`}>{postSaleStatusLabels[delivery.statusId] ?? delivery.statusName}</span></td>
                    <td className="py-4 pr-1 font-bold tabular-nums">{currency.format(delivery.shippingChargedToClient)}</td>
                    <td className="py-3 pr-1"><MoneyInput id={`reconciliation-post-sale-shipping-${delivery.id}`} value={draft.shippingPaidToAgency} prefix="C$" compact disabled={saving || !draft.selected} onChange={(value) => updatePostSaleDeliveryDraft(delivery.id, { shippingPaidToAgency: value })} /></td>
                    <td className="py-4 pr-1 font-bold tabular-nums"><span>{currency.format(net)}</span><span className="block text-xs font-normal text-pw-muted">de {currency.format(delivery.amountToCollect)}</span></td>
                    <td className="py-3 pr-1"><MoneyInput id={`reconciliation-post-sale-nio-${delivery.id}`} ariaLabel="Recibido en C$ para envío postventa" value={draft.amountCollectedNio} prefix="C$" compact compactWidth="w-[7rem]" disabled={saving || isReturn || !draft.selected} onChange={(value) => updatePostSaleDeliveryDraft(delivery.id, { amountCollectedNio: value })} /></td>
                    <td className="py-3 pr-1"><MoneyInput id={`reconciliation-post-sale-usd-${delivery.id}`} ariaLabel="Recibido en US$ para envío postventa" value={draft.amountCollectedUsd} prefix="US$" compact compactWidth="w-[7rem]" disabled={saving || isReturn || !draft.selected} onChange={(value) => {
                      const amountReceived = amount(draft.amountCollectedNio) + amount(value) * settlementRate;
                      const changeGivenNio = Math.max(0, roundMoney(amountReceived - delivery.amountToCollect));
                      updatePostSaleDeliveryDraft(delivery.id, { amountCollectedUsd: value, changeGivenNio: changeGivenNio.toFixed(2) });
                    }} /></td>
                    <td className="py-3"><MoneyInput id={`reconciliation-post-sale-change-${delivery.id}`} ariaLabel="Vuelto entregado en C$ para envío postventa" value={draft.changeGivenNio} prefix="C$" compact compactWidth="w-[7rem]" disabled={saving || isReturn || !draft.selected || amount(draft.amountCollectedUsd) <= 0} onChange={(value) => updatePostSaleDeliveryDraft(delivery.id, { changeGivenNio: value })} /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div> : <p className="pt-4 text-sm text-pw-muted">{shipmentDate ? "No hay envíos postventa pendientes para esta fecha." : "No hay envíos postventa pendientes para esta agencia."}</p>}
          </section>

          <section aria-labelledby="reconciliation-comments-heading" className="rounded-xl border border-pw-line bg-white p-4 sm:p-5">
            <label htmlFor="reconciliation-comments" id="reconciliation-comments-heading" className="grid gap-1.5 text-sm font-extrabold text-pw-ink">Comentarios <span className="font-medium text-pw-muted">(opcional)</span>
              <textarea id="reconciliation-comments" className="min-h-24 rounded-lg border border-pw-line bg-white p-3 text-sm font-normal text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand" value={comments} maxLength={500} disabled={saving} onChange={(event) => setComments(event.target.value)} />
            </label>
          </section>
        </div>

        <aside aria-label="Resumen de conciliación" className="space-y-4 rounded-xl border border-pw-line bg-white p-4 sm:p-5 xl:sticky xl:top-5">
          <div className="flex items-baseline justify-between gap-3"><h2 className="text-base font-extrabold">Resumen</h2><span className="text-sm text-pw-muted">{selectedCount} seleccionados</span></div>
          <dl className="space-y-3 border-t border-pw-line pt-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-pw-muted">Cobro neto aplicado</dt><dd className="font-bold tabular-nums">{currency.format(totals.expectedCollection)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-pw-muted">Remesa recibida</dt><dd className="font-bold tabular-nums">{currency.format(totals.receivedNio)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-pw-muted">Salidas · vuelto y flete</dt><dd className="font-bold tabular-nums">{currency.format(totals.agencyPayments)}</dd></div>
            <div className="flex justify-between gap-3 border-t border-pw-line pt-3"><dt className="font-extrabold">Remesa neta</dt><dd className="font-extrabold tabular-nums">{currency.format(totals.netRemittance)}</dd></div>
            <div className="flex justify-between gap-3 border-t border-pw-line pt-3"><dt className="font-extrabold">Envíos</dt><dd className="font-extrabold tabular-nums">{selectedDeliveries.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="font-extrabold">Envíos postventa</dt><dd className="font-extrabold tabular-nums">{selectedPostSaleDeliveries.length}</dd></div>
          </dl>
          {saveError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{saveError}</p> : null}
          <button type="button" disabled={!canSubmit} onClick={() => void submit()} className="min-h-11 w-full rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Registrando…" : "Registrar conciliación"}
          </button>
          {!canSubmit && selectedCount > 0 && !pendingLoading && !saving ? <p className="text-xs text-pw-muted">Revisa los montos: los envíos en tránsito y los cambios postventa deben registrar el cobro completo; las devoluciones no deben registrar cobros y el vuelto no puede superar lo recibido.</p> : null}
          {exchangeRateStatus === "loading" && !storeRate ? <p className="text-xs text-pw-muted">Cargando tasa actual…</p> : null}
        </aside>
      </div>}
    </> : null}
  </div>;
}
