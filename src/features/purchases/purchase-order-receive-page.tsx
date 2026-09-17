import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { LoadingButton } from "../../shared/ui/loading-button";
import { ErrorState, LoadingState, PermissionDeniedState } from "../../shared/ui/screen-state";
import { formatCordobas, type OrderDTO, type OrderTrackingNumberDTO } from "./purchase-order-types";

type LoadError = {
  detail: string;
  isForbidden: boolean;
  isNotFound: boolean;
};

type ReceiptLine = {
  productId: number;
  productName: string;
  orderProductId: number;
  supplierProductCode: string | null;
  presentationName: string;
  sizeName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  quantity: string;
  weight: string;
  unitCostNio: number | null;
  salePrice: string;
  isSurplus: boolean;
};

type ReceiptProductGroup = {
  productId: number;
  productName: string;
  supplierProductCode: string | null;
  lines: ReceiptLine[];
};

type TrackingDraft = {
  item: OrderTrackingNumberDTO;
  selected: boolean;
  weight: string;
  shippingCostUsd: string;
  isReceived: boolean;
};

type ValidationTarget =
  | { type: "line"; id: number; field: "quantity" | "weight" | "salePrice" }
  | { type: "tracking"; id: number; field: "weight" | "shippingCostUsd" }
  | { type: "warehouseShipping" };

function todayDateInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function inputClass() {
  return "h-11 w-full rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none transition focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30";
}

function problemDetail(response: Response, fallback: string) {
  return response
    .clone()
    .json()
    .then((body: { detail?: string; title?: string }) => body.detail ?? body.title ?? fallback)
    .catch(() => fallback);
}

function toUtcDateTime(value: string) {
  return `${value}T00:00:00.000Z`;
}

function variantLabel(line: Pick<ReceiptLine, "productName" | "presentationName" | "sizeName">) {
  return `${line.productName} - ${line.presentationName} - ${line.sizeName}`;
}

type ReceiptCostLine = Pick<ReceiptLine, "unitCostNio" | "quantity" | "weight">;

function estimatedUnitCostNio(line: ReceiptCostLine, lines: ReceiptCostLine[], shippingCostUsd: number, exchangeRate: number) {
  if (line.unitCostNio === null) return null;

  const quantity = Number(line.quantity);
  const selectedLines = lines.filter((candidate) => Number(candidate.quantity) > 0);
  const hasInvalidWeight = selectedLines.some((candidate) => {
    const weight = Number(candidate.weight);
    return !Number.isFinite(weight) || weight <= 0;
  });
  const weightedTotal = selectedLines.reduce((total, candidate) => total + (Number(candidate.quantity) * Number(candidate.weight)), 0);
  if (quantity <= 0 || !Number.isFinite(quantity) || shippingCostUsd <= 0 || !Number.isFinite(shippingCostUsd) || exchangeRate <= 0 || !Number.isFinite(exchangeRate) || hasInvalidWeight || !Number.isFinite(weightedTotal) || weightedTotal <= 0) {
    return line.unitCostNio;
  }

  const lineWeightedQuantity = quantity * Number(line.weight);
  const shippingCostNio = shippingCostUsd * exchangeRate;
  const allocatedShippingPerUnitNio = (shippingCostNio * (lineWeightedQuantity / weightedTotal)) / quantity;
  return line.unitCostNio + allocatedShippingPerUnitNio;
}

function estimatedProfit(line: Pick<ReceiptLine, "salePrice">, estimatedCostNio: number | null) {
  const salePrice = Number(line.salePrice);
  return estimatedCostNio !== null && Number.isFinite(salePrice) && salePrice > 0
    ? formatCordobas(salePrice - estimatedCostNio)
    : "—";
}

function receiptLinesFromOrder(order: OrderDTO): ReceiptLine[] {
  return order.products.flatMap((product) => product.presentations.flatMap((presentation) => presentation.sizes.map((size) => ({
    productId: size.id,
    orderProductId: product.id,
    supplierProductCode: product.supplierProductCode,
    productName: product.name,
    presentationName: presentation.name ?? "Sin presentación",
    sizeName: size.sizeName ?? `Talla #${size.sizeId}`,
    orderedQuantity: size.quantity,
    receivedQuantity: size.receivedQuantity,
    pendingQuantity: Math.max(0, size.quantity - size.receivedQuantity),
    quantity: "0",
    weight: "1",
    unitCostNio: typeof size.unitCostNio === "number" && Number.isFinite(size.unitCostNio) ? size.unitCostNio : null,
    salePrice: size.salePrice !== null && size.salePrice > 0 ? String(size.salePrice) : "",
    isSurplus: false,
  }))));
}

function trackingDraftsFromItems(items: OrderTrackingNumberDTO[]): TrackingDraft[] {
  return items.map((item) => ({
    item,
    selected: false,
    isReceived: item.productReceiptId != null || item.receiptId != null,
    weight: item.weight > 0 ? String(item.weight) : "0",
    shippingCostUsd: item.shippingCost > 0 ? String(item.shippingCost) : "0",
  }));
}

function normaliseOrder(order: OrderDTO) {
  return {
    ...order,
    products: order.products ?? [],
  };
}

export function PurchaseOrderReceivePage() {
  const { id } = useParams();
  const { request } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [tracking, setTracking] = useState<TrackingDraft[]>([]);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [receivedDate, setReceivedDate] = useState(todayDateInputValue);
  const [warehouseShippingCostUsd, setWarehouseShippingCostUsd] = useState("0");
  const [comments, setComments] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [validationTarget, setValidationTarget] = useState<ValidationTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setMutationError(null);
    setIsConfirmationOpen(false);
    setValidationTarget(null);
    setOrder(null);
    setLines([]);
    setTracking([]);
    setReceivedDate(todayDateInputValue());
    setWarehouseShippingCostUsd("0");
    setComments("");
    setIsSubmitting(false);
    void Promise.all([
      request(`/api/v1/orders/${id}`),
      request(`/api/v1/orders/${id}/tracking-numbers`),
    ])
      .then(async ([orderResponse, trackingResponse]) => {
        if (!orderResponse.ok) {
          return {
            detail: await problemDetail(orderResponse, "No se pudo cargar esta orden de compra."),
            isForbidden: orderResponse.status === 403,
            isNotFound: orderResponse.status === 404,
          };
        }
        if (!trackingResponse.ok) {
          return {
            detail: await problemDetail(trackingResponse, "No se pudieron cargar los números de seguimiento."),
            isForbidden: trackingResponse.status === 403,
            isNotFound: trackingResponse.status === 404,
          };
        }
        return {
          order: normaliseOrder((await orderResponse.json()) as OrderDTO),
          tracking: (await trackingResponse.json()) as OrderTrackingNumberDTO[],
        };
      })
      .then((result) => {
        if (!active) return;
        if (result.detail !== undefined) {
          setLoadError({ detail: result.detail, isForbidden: result.isForbidden ?? false, isNotFound: result.isNotFound ?? false });
          return;
        }
        setOrder(result.order);
        setLines(receiptLinesFromOrder(result.order));
        setTracking(trackingDraftsFromItems(result.tracking));
      })
      .catch(() => {
        if (active) setLoadError({ detail: "No se pudo preparar la recepción de esta orden.", isForbidden: false, isNotFound: false });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, request, retryVersion]);

  useEffect(() => {
    setHeading({
      title: order && String(order.id) === id ? "Registrar recepción de orden #" + order.id : "Registrar recepción",
      breadcrumbs: (
        <Link className="inline-flex items-center underline underline-offset-4 hover:text-pw-brand-deep" to={`/purchases/orders/${id ?? ""}`}>
          ← Regresar al detalle
        </Link>
      ),
    });
    setAction(null);
    return () => {
      setHeading(null);
      setAction(null);
    };
  }, [id, order, setAction, setHeading]);

  const clearMutationError = () => {
    setMutationError(null);
    setValidationTarget(null);
  };

  const showValidationError = (message: string, target: ValidationTarget | null = null) => {
    setMutationError(message);
    setValidationTarget(target);
  };

  const updateLine = (productId: number, key: "quantity" | "weight" | "salePrice" | "isSurplus", value: string | boolean) => {
    setLines((current) => current.map((line) => line.productId === productId ? { ...line, [key]: value } : line));
    clearMutationError();
  };

  const updateTracking = (trackingId: number, key: "selected" | "weight" | "shippingCostUsd", value: string | boolean) => {
    setTracking((current) => current.map((draft) => draft.item.id === trackingId ? { ...draft, [key]: value } : draft));
    clearMutationError();
  };

  const submit = async () => {
    if (!id || !order || isSubmitting) return;
    if (!receivedDate || receivedDate > todayDateInputValue()) {
      showValidationError("La fecha de recepción no puede ser futura.");
      return;
    }
    const selectedLines = lines.filter((line) => Number(line.quantity) > 0);
    if (!selectedLines.length) {
      showValidationError("Selecciona al menos un producto recibido.");
      return;
    }
    for (const line of selectedLines) {
      const quantity = Number(line.quantity);
      const weight = Number(line.weight);
      const hasSalePrice = line.salePrice.trim().length > 0;
      const salePrice = hasSalePrice ? Number(line.salePrice) : null;
      if (!Number.isInteger(quantity) || quantity <= 0) {
        showValidationError(
          `La cantidad recibida del código de proveedor ${line.supplierProductCode ?? "sin código"} debe ser un entero mayor que cero.`,
          { type: "line", id: line.productId, field: "quantity" },
        );
        return;
      }
      if (!line.isSurplus && quantity > line.pendingQuantity) {
        showValidationError(
          `La cantidad recibida del código de proveedor ${line.supplierProductCode ?? "sin código"} supera la cantidad pendiente. Marca la recepción como sobrante si corresponde.`,
          { type: "line", id: line.productId, field: "quantity" },
        );
        return;
      }
      if (!Number.isFinite(weight) || weight <= 0) {
        showValidationError(
          `El peso recibido del código de proveedor ${line.supplierProductCode ?? "sin código"} debe ser mayor que cero.`,
          { type: "line", id: line.productId, field: "weight" },
        );
        return;
      }
      if (
        (salePrice === null && line.receivedQuantity <= 0) ||
        (salePrice !== null && (!Number.isFinite(salePrice) || salePrice <= 0))
      ) {
        showValidationError(
          `El precio de venta del código de proveedor ${line.supplierProductCode ?? "sin código"} debe ser mayor que cero.`,
          { type: "line", id: line.productId, field: "salePrice" },
        );
        return;
      }
    }
    const selectedTracking = tracking.filter((draft) => draft.selected);
    const pendingTracking = tracking.filter((draft) => !draft.isReceived);
    if (tracking.length > 0 && pendingTracking.length === 0) {
      showValidationError("Todos los trackings de esta orden ya fueron recepcionados. Agrega un tracking nuevo antes de continuar.");
      return;
    }
    if (pendingTracking.length > 0 && selectedTracking.length === 0) {
      showValidationError("Selecciona al menos un tracking recibido.");
      return;
    }
    for (const draft of selectedTracking) {
      if (!Number.isFinite(Number(draft.weight)) || Number(draft.weight) < 0 || !Number.isFinite(Number(draft.shippingCostUsd)) || Number(draft.shippingCostUsd) < 0) {
        showValidationError(`Completa un peso y costo de envío válidos para el tracking ${draft.item.trackingNumber}.`, { type: "tracking", id: draft.item.id, field: !Number.isFinite(Number(draft.weight)) || Number(draft.weight) < 0 ? "weight" : "shippingCostUsd" });
        return;
      }
    }
    const shippingCost = Number(warehouseShippingCostUsd);
    if (tracking.length === 0 && (!Number.isFinite(shippingCost) || shippingCost < 0)) {
      showValidationError("El costo de envío de bodega debe ser mayor o igual a cero.", { type: "warehouseShipping" });
      return;
    }

    if (selectedLines.some((line) => line.isSurplus) && !window.confirm("La recepción incluye cantidades sobrantes y aumentará el inventario por encima de lo comprado. ¿Deseas continuar?")) {
      return;
    }

    const payload = {
      receivedDate: toUtcDateTime(receivedDate),
      warehouseShippingCostUsd: tracking.length === 0 ? shippingCost : null,
      comments: comments.trim() || null,
      trackingNumbers: selectedTracking.map((draft) => ({ id: draft.item.id, weight: Number(draft.weight), shippingCostUsd: Number(draft.shippingCostUsd) })),
      productVariants: selectedLines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), weight: Number(line.weight), salePrice: line.salePrice.trim().length > 0 ? Number(line.salePrice) : null, isSurplus: line.isSurplus })),
    };

    setIsSubmitting(true);
    clearMutationError();
    try {
      const response = await request(`/api/v1/orders/${id}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await problemDetail(response, "No se pudo registrar la recepción."));
      navigate(`/purchases/orders/${id}`);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "No se pudo registrar la recepción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSubmitting) setIsConfirmationOpen(true);
  };

  const selectedUnits = useMemo(() => lines.reduce((total, line) => total + (Number(line.quantity) || 0), 0), [lines]);
  const pendingUnits = useMemo(() => lines.reduce((total, line) => total + line.pendingQuantity, 0), [lines]);
  const surplusUnits = useMemo(
    () => lines.reduce((total, line) => total + (line.isSurplus ? Math.max(0, (Number(line.quantity) || 0) - line.pendingQuantity) : 0), 0),
    [lines],
  );
  const selectedTrackingCount = useMemo(
    () => tracking.filter((draft) => draft.selected).length,
    [tracking],
  );
  const availableTrackingCount = useMemo(
    () => tracking.filter((draft) => !draft.isReceived).length,
    [tracking],
  );
  const selectedShippingCostUsd = useMemo(
    () => tracking.length > 0
      ? tracking.reduce((total, draft) => total + (draft.selected ? Number(draft.shippingCostUsd) || 0 : 0), 0)
      : Number(warehouseShippingCostUsd) || 0,
    [tracking, warehouseShippingCostUsd],
  );
  const shippingSummary = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(selectedShippingCostUsd);
  const estimatedUnitCosts = useMemo(
    () => new Map(lines.map((line) => [
      line.productId,
      estimatedUnitCostNio(line, lines, selectedShippingCostUsd, order?.exchangeRate ?? 0),
    ])),
    [lines, selectedShippingCostUsd, order?.exchangeRate],
  );

  const productGroups = useMemo<ReceiptProductGroup[]>(() => {
    const groups = new Map<number, ReceiptProductGroup>();
    lines.forEach((line) => {
      const group = groups.get(line.orderProductId) ?? {
        productId: line.orderProductId,
        productName: line.productName,
        supplierProductCode: line.supplierProductCode,
        lines: [],
      };
      group.lines.push(line);
      groups.set(line.orderProductId, group);
    });
    return Array.from(groups.values());
  }, [lines]);
  const currentLoadError = loadError;
  if (isLoading) return <LoadingState />;
  if (currentLoadError?.isForbidden) return <PermissionDeniedState />;
  if (currentLoadError?.isNotFound) return <ErrorState title="No encontramos esta orden" description={currentLoadError.detail} />;
  if (currentLoadError) return <ErrorState title="No pudimos preparar la recepción" description={currentLoadError.detail} onRetry={() => setRetryVersion((version) => version + 1)} />;
  if (!order || String(order.id) !== id) return <LoadingState />;
  if (order.orderStatusId === 3 || order.orderStatusId === 4) return <ErrorState title="No se puede registrar la recepción" description={order.orderStatusId === 3 ? "Las órdenes completamente recibidas no pueden recibir mercancía adicional." : "Las órdenes canceladas no pueden recibir mercancía."} />;

  return (
    <>
    <form className="space-y-5" onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault(); }} onSubmit={openConfirmation} noValidate>
      {mutationError ? <p id="receive-mutation-error" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{mutationError}</p> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="receive-data-title">
            <h2 id="receive-data-title" className="mt-1 text-xl font-extrabold">Datos de recepción</h2>
            <div className="mt-5 grid items-start gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-pw-ink">
                Fecha de recepción
                <input aria-label="Fecha de recepción" className={inputClass()} type="date" max={todayDateInputValue()} value={receivedDate} onChange={(event) => { setReceivedDate(event.target.value); clearMutationError(); }} />
              </label>
              {tracking.length === 0 ? (
                <label className="grid gap-1.5 text-sm font-medium text-pw-ink">
                  Envío de bodega a Nicaragua (USD)
                  <input aria-label="Envío de bodega a Nicaragua (USD)" aria-describedby={validationTarget?.type === "warehouseShipping" ? "receive-mutation-error" : undefined} aria-invalid={validationTarget?.type === "warehouseShipping"} className={inputClass() + (validationTarget?.type === "warehouseShipping" ? " border-red-500 bg-red-50 ring-2 ring-red-100" : "")} min="0" step="0.01" type="number" value={warehouseShippingCostUsd} onChange={(event) => { setWarehouseShippingCostUsd(event.target.value); clearMutationError(); }} />
                </label>
              ) : null}
              {tracking.length > 0 ? (
                <fieldset className="sm:col-span-2" aria-labelledby="receive-tracking-title">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 id="receive-tracking-title" className="text-base font-extrabold">Trackings a recibir</h3>
                    </div>
                    <p className="text-sm text-pw-muted">{selectedTrackingCount} de {availableTrackingCount} seleccionados</p>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-lg border border-pw-line">
                    {availableTrackingCount === 0 ? <p className="bg-pw-brand-soft p-3 text-sm text-pw-muted" role="status">Todos los trackings de esta orden ya fueron recepcionados. Agrega un tracking nuevo antes de continuar.</p> : null}
                    <div className="divide-y divide-pw-line">
                      {tracking.filter((draft) => !draft.isReceived).map((draft) => {
                        const trackingWeightInvalid = validationTarget?.type === "tracking" && validationTarget.id === draft.item.id && validationTarget.field === "weight";
                        const trackingShippingInvalid = validationTarget?.type === "tracking" && validationTarget.id === draft.item.id && validationTarget.field === "shippingCostUsd";
                        return (
                        <div className={`grid items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] ${trackingWeightInvalid || trackingShippingInvalid ? "bg-red-50" : draft.selected ? "bg-pw-brand-soft/40" : ""}`} key={draft.item.id}>
                          <label className="flex min-h-11 min-w-0 items-center gap-3 text-sm font-extrabold text-pw-ink">
                            <input aria-label={"Recibir tracking " + draft.item.trackingNumber} type="checkbox" checked={draft.selected} disabled={draft.isReceived} onChange={(event) => updateTracking(draft.item.id, "selected", event.target.checked)} />
                            <span className="min-w-0">
                              <span className="block truncate">{draft.item.trackingNumber}</span>
                              <span className="block truncate text-xs font-normal text-pw-muted">{draft.item.shippingCompanyName ?? "Sin empresa"}{draft.isReceived ? " · Ya recepcionado" : ""}</span>
                            </span>
                          </label>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <label className="flex items-center gap-2 text-xs font-semibold text-pw-ink">
                              Peso (lb)
                              <input aria-label={"Peso del tracking " + draft.item.trackingNumber} aria-describedby={trackingWeightInvalid ? "receive-mutation-error" : undefined} aria-invalid={trackingWeightInvalid} className="h-9 w-20 rounded-lg border border-pw-line bg-white px-2 text-center text-sm font-semibold text-pw-ink outline-none transition focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30 aria-invalid:border-red-500 aria-invalid:bg-red-50 aria-invalid:ring-2 aria-invalid:ring-red-100 disabled:cursor-not-allowed disabled:bg-pw-surface" disabled={!draft.selected || draft.isReceived} min="0" step="0.01" type="number" value={draft.weight} onChange={(event) => updateTracking(draft.item.id, "weight", event.target.value)} />
                            </label>
                            <label className="flex items-center gap-2 text-xs font-semibold text-pw-ink">
                              Envío (USD)
                              <span className={`flex h-9 w-28 overflow-hidden rounded-lg border bg-white ${trackingShippingInvalid ? "border-red-500 ring-2 ring-red-100" : "border-pw-line"}`}>
                                <span aria-hidden="true" className="flex w-8 shrink-0 items-center justify-center border-r border-pw-line text-sm font-semibold text-pw-muted">$</span>
                                <input aria-label={"Costo de envío del tracking " + draft.item.trackingNumber + " (USD)"} aria-describedby={trackingShippingInvalid ? "receive-mutation-error" : undefined} aria-invalid={trackingShippingInvalid} className="h-full min-w-0 w-20 flex-1 border-0 bg-transparent px-2 text-center text-sm font-semibold text-pw-ink outline-none transition focus:ring-2 focus:ring-pw-brand/30 aria-invalid:bg-red-50 disabled:cursor-not-allowed disabled:bg-pw-surface" disabled={!draft.selected || draft.isReceived} min="0" step="0.01" type="number" value={draft.shippingCostUsd} onChange={(event) => updateTracking(draft.item.id, "shippingCostUsd", event.target.value)} />
                              </span>
                            </label>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </fieldset>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="receive-products-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-pw-muted">Inventario</p>
                <h2 id="receive-products-title" className="mt-1 text-xl font-extrabold">Productos recibidos</h2>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {productGroups.map((group) => (
                <section className="overflow-hidden rounded-lg border border-pw-line" key={group.productId} aria-labelledby={`receive-product-${group.productId}`}>
                  <header className="border-b border-pw-line bg-pw-brand-soft/40 px-3 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-pw-muted">Código proveedor</p>
                      <p className="break-words text-sm font-extrabold text-pw-brand-deep">{group.supplierProductCode ?? "Sin código"}</p>
                    </div>
                    <h3 id={`receive-product-${group.productId}`} className="mt-1 break-words text-xs font-semibold text-pw-muted">{group.productName}</h3>
                  </header>
                  <div className="overflow-x-auto">
                    <table aria-label={`Tallas a recibir de ${group.productName}`} className="min-w-[1040px] w-full border-collapse text-sm">
                      <thead className="bg-pw-brand-soft text-xs uppercase tracking-[0.04em] text-pw-muted">
                        <tr>
                          <th className="min-w-36 px-2 py-3 text-left font-extrabold" scope="col">Presentación</th>
                          <th className="w-20 px-2 py-3 text-left font-extrabold" scope="col">Talla</th>
                          <th className="w-20 px-2 py-3 text-center font-extrabold" scope="col">Compradas</th>
                          <th className="w-20 px-2 py-3 text-center font-extrabold" scope="col">Recibidas</th>
                          <th className="w-24 px-2 py-3 text-center font-extrabold" scope="col">Cantidad a recibir</th>
                          <th className="w-24 px-2 py-3 text-center font-extrabold" scope="col">Peso</th>
                          <th className="w-28 px-2 py-3 text-center font-extrabold" scope="col">
                            <span className="group relative inline-flex items-center justify-center gap-1">
                              <span>Costo unit. (C$)</span>
                              <button aria-describedby={"estimated-unit-cost-tooltip-" + group.productId} aria-label="Información sobre el costo unitario estimado" className="grid h-4 w-4 place-items-center rounded-full text-[11px] font-extrabold leading-none text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep focus-visible:outline-2 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-1" title="Estimado: incluye el costo de envío prorrateado según el peso por unidad y la cantidad recibida." type="button">ⓘ</button>
                              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-pw-ink px-2 py-1.5 text-left text-[11px] font-semibold normal-case leading-tight text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100" id={"estimated-unit-cost-tooltip-" + group.productId} role="tooltip">Estimado: incluye el costo de envío prorrateado según el peso por unidad y la cantidad recibida.</span>
                            </span>
                          </th>
                          <th className="w-28 px-2 py-3 text-center font-extrabold" scope="col">Precio de venta (C$)</th>
                          <th className="w-32 px-2 py-3 text-center font-extrabold" scope="col">Ganancia estimada (C$)</th>
                          <th className="w-24 px-2 py-3 text-center font-extrabold" scope="col">Sobrante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.lines.map((line) => {
                          const label = variantLabel(line);
                          const lineExtra = line.isSurplus ? Math.max(0, (Number(line.quantity) || 0) - line.pendingQuantity) : 0;
                          const quantityInvalid = validationTarget?.type === "line" && validationTarget.id === line.productId && validationTarget.field === "quantity";
                          const weightInvalid = validationTarget?.type === "line" && validationTarget.id === line.productId && validationTarget.field === "weight";
                          const salePriceInvalid = validationTarget?.type === "line" && validationTarget.id === line.productId && validationTarget.field === "salePrice";
                          const lineHasValidationError = quantityInvalid || weightInvalid || salePriceInvalid;
                          const estimatedCostNio = estimatedUnitCosts.get(line.productId) ?? line.unitCostNio;
                          return (
                            <tr className={lineHasValidationError ? "bg-red-50" : lineExtra > 0 ? "bg-pw-brand-soft/40" : ""} key={line.productId}>
                              <th className="border-t border-pw-line px-2 py-3 text-left align-middle font-extrabold text-pw-ink" scope="row">{line.presentationName}</th>
                              <td className="border-t border-pw-line px-2 py-3 font-extrabold text-pw-ink">{line.sizeName}</td>
                              <td className="border-t border-pw-line px-2 py-3 text-center tabular-nums">{line.orderedQuantity}</td>
                              <td className="border-t border-pw-line px-2 py-3 text-center tabular-nums">{line.receivedQuantity}</td>
                              <td className="border-t border-pw-line px-2 py-3">
                                <input aria-label={"Cantidad recibida de " + label} aria-describedby={quantityInvalid ? "receive-mutation-error" : undefined} aria-invalid={quantityInvalid} className="h-10 w-20 rounded-lg border border-pw-line bg-white px-1 text-center text-sm font-semibold text-pw-ink outline-none transition focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30 aria-invalid:border-red-500 aria-invalid:bg-red-50 aria-invalid:ring-2 aria-invalid:ring-red-100" min="0" step="1" type="number" value={line.quantity} onChange={(event) => updateLine(line.productId, "quantity", event.target.value)} />
                              </td>
                              <td className="border-t border-pw-line px-2 py-3">
                                <input aria-label={"Peso recibido de " + label} aria-describedby={weightInvalid ? "receive-mutation-error" : undefined} aria-invalid={weightInvalid} className="h-10 w-20 rounded-lg border border-pw-line bg-white px-1 text-center text-sm font-semibold text-pw-ink outline-none transition focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30 aria-invalid:border-red-500 aria-invalid:bg-red-50 aria-invalid:ring-2 aria-invalid:ring-red-100" min="0" step="0.01" type="number" value={line.weight} onChange={(event) => updateLine(line.productId, "weight", event.target.value)} />
                              </td>
                              <td className="border-t border-pw-line px-2 py-3 text-center font-semibold tabular-nums text-pw-ink">{estimatedCostNio === null ? "—" : formatCordobas(estimatedCostNio)}</td>
                              <td className="border-t border-pw-line px-2 py-3">
                                <input aria-label={"Precio de venta de " + label} aria-describedby={salePriceInvalid ? "receive-mutation-error" : undefined} aria-invalid={salePriceInvalid} className="h-10 w-24 rounded-lg border border-pw-line bg-white px-1 text-center text-sm font-semibold text-pw-ink outline-none transition focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30 aria-invalid:border-red-500 aria-invalid:bg-red-50 aria-invalid:ring-2 aria-invalid:ring-red-100" min="0.01" step="0.01" type="number" value={line.salePrice} onChange={(event) => updateLine(line.productId, "salePrice", event.target.value)} />
                              </td>
                              <td className="border-t border-pw-line px-2 py-3 text-center font-semibold tabular-nums text-pw-ink">{estimatedProfit(line, estimatedCostNio)}</td>
                              <td className="border-t border-pw-line px-2 py-3 text-center">
                                <label className="inline-flex min-h-11 items-center justify-center gap-2 text-xs font-semibold text-pw-ink">
                                  <input aria-label={"Marcar como sobrante " + label} type="checkbox" checked={line.isSurplus} onChange={(event) => updateLine(line.productId, "isSurplus", event.target.checked)} />
                                  <span>{lineExtra > 0 ? "+" + lineExtra : "Permitir"}</span>
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="receive-comment-title">
            <h2 id="receive-comment-title" className="text-xl font-extrabold">Notas de recepción</h2>
            <p className="mt-1 text-sm text-pw-muted">Opcional. Puedes dejar una nota sobre el estado o contenido de los paquetes.</p>
            <textarea aria-label="Comentario de recepción" className={inputClass() + " mt-4 min-h-24 py-2.5"} maxLength={280} value={comments} onChange={(event) => { setComments(event.target.value); clearMutationError(); }} />
          </section>
        </div>

        <aside className="rounded-xl border border-pw-line bg-white p-5 lg:sticky lg:top-5" aria-label="Resumen de recepción">
          <h2 className="text-xl font-extrabold">Resumen de recepción</h2>
          <dl className="mt-4 divide-y divide-pw-line border-y border-pw-line">
            {tracking.length > 0 ? <div className="flex items-center justify-between gap-3 py-3"><dt className="text-sm text-pw-muted">Paquetes</dt><dd className="font-bold">{selectedTrackingCount} de {availableTrackingCount}</dd></div> : null}
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-sm text-pw-muted">Variantes pendientes</dt><dd className="font-bold">{lines.filter((line) => line.pendingQuantity > 0).length}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-sm text-pw-muted">Unidades pendientes</dt><dd className="font-bold">{pendingUnits}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-sm text-pw-muted">Sobrantes</dt><dd className="font-bold">{surplusUnits}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-sm text-pw-muted">Unidades a recibir</dt><dd className="text-lg font-extrabold">{selectedUnits}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-sm text-pw-muted">Envío registrado</dt><dd className="font-bold">{shippingSummary}</dd></div>
          </dl>
          <LoadingButton className="mt-5 w-full" isLoading={isSubmitting} type="submit">{isSubmitting ? "Guardando recepción…" : "Guardar recepción"}</LoadingButton>
          <Link className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-muted hover:bg-pw-brand-soft" to={`/purchases/orders/${id}`}>Cancelar</Link>
        </aside>
      </div>
    </form>
      <ConfirmDialog
        open={isConfirmationOpen}
        title="Confirmar recepción"
        description="¿Deseas registrar esta recepción?"
        confirmLabel="Confirmar recepción"
        isPending={isSubmitting}
        onConfirm={() => { setIsConfirmationOpen(false); void submit(); }}
        onClose={() => { if (!isSubmitting) setIsConfirmationOpen(false); }}
      />
    </>
  );
}
