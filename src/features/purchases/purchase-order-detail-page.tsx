import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { StatusBadge } from "../../shared/ui/status-badge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from "../../shared/ui/screen-state";
import {
  formatCordobas,
  orderStatusLabel,
  orderStatusTone,
  type OrderProductDTO,
  type OrderProductVariantDTO,
  type OrderDTO,
  type OrderTrackingNumberDTO,
} from "./purchase-order-types";

type LoadError = {
  detail: string;
  isForbidden: boolean;
  isNotFound: boolean;
};

async function problemDetail(response: Response) {
  try {
    const problem = (await response.json()) as {
      detail?: string;
      title?: string;
    };
    return (
      problem.detail ??
      problem.title ??
      "No se pudo cargar esta orden de compra."
    );
  } catch {
    return "No se pudo cargar esta orden de compra.";
  }
}

function formatDate(value: string | null) {
  if (!value) return "Sin registrar";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("es-NI", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatExchangeRate(value: number) {
  const formatted = new Intl.NumberFormat("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `C$ ${formatted} por $1`;
}

function nullableMoney(value: number | null) {
  return formatCordobas(value ?? 0);
}


type OrderProductRow = OrderProductVariantDTO & {
  presentationName: string;
};

function productRows(product: OrderProductDTO): OrderProductRow[] {
  return product.presentations.flatMap((presentation) =>
    presentation.sizes.map((size) => ({
      ...size,
      presentationName: presentation.name ?? "Sin presentación",
    })),
  );
}

export function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const { request } = useAuth();
  const { setHeading } = usePageActions();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [tracking, setTracking] = useState<OrderTrackingNumberDTO[] | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [trackingError, setTrackingError] = useState<LoadError | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [trackingRetryVersion, setTrackingRetryVersion] = useState(0);
  const orderRequestId = useRef(0);
  const trackingRequestId = useRef(0);

  useEffect(() => {
    setHeading({
      title:
        order && String(order.id) === id
          ? `Orden #${order.id}`
          : "Detalle de compra",
      breadcrumbs: (
        <Link
          className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-pw-brand-deep"
          to="/purchases/orders"
        >
          ← Regresar a compras
        </Link>
      ),
    });
    return () => setHeading(null);
  }, [id, order, setHeading]);

  useEffect(() => {
    const requestId = ++orderRequestId.current;
    const loadOrder = async () => {
      setIsLoading(true);
      setError(null);
      setOrder(null);
      try {
        const response = await request(`/api/v1/orders/${id}`);
        if (!response.ok) {
          const detail = await problemDetail(response);
          if (requestId === orderRequestId.current) {
            setError({
              detail,
              isForbidden: response.status === 403,
              isNotFound: response.status === 404,
            });
          }
          return;
        }
        const loadedOrder = (await response.json()) as OrderDTO;
        if (requestId === orderRequestId.current) {
          setOrder({
            ...loadedOrder,
            products: (loadedOrder.products ?? []).map((product) => ({
              ...product,
              presentations: (product.presentations ?? []).map((presentation) => ({
                ...presentation,
                sizes: presentation.sizes ?? [],
              })),
            })),
            purchaseShortages: loadedOrder.purchaseShortages ?? [],
          });
        }
      } catch {
        if (requestId === orderRequestId.current) {
          setError({
            detail: "No se pudo cargar esta orden de compra.",
            isForbidden: false,
            isNotFound: false,
          });
        }
      } finally {
        if (requestId === orderRequestId.current) setIsLoading(false);
      }
    };

    void loadOrder();
  }, [id, request, retryVersion]);

  useEffect(() => {
    const requestId = ++trackingRequestId.current;
    const loadTracking = async () => {
      setTracking(null);
      setTrackingError(null);
      try {
        const response = await request(`/api/v1/orders/${id}/tracking-numbers`);
        if (!response.ok) {
          const detail = await problemDetail(response);
          if (requestId === trackingRequestId.current) {
            setTrackingError({
              detail,
              isForbidden: response.status === 403,
              isNotFound: response.status === 404,
            });
          }
          return;
        }
        const loadedTracking =
          (await response.json()) as OrderTrackingNumberDTO[];
        if (requestId === trackingRequestId.current)
          setTracking(loadedTracking);
      } catch {
        if (requestId === trackingRequestId.current) {
          setTrackingError({
            detail: "No se pudieron cargar los números de seguimiento.",
            isForbidden: false,
            isNotFound: false,
          });
        }
      }
    };

    void loadTracking();
  }, [id, request, trackingRetryVersion]);

  const summary = useMemo(() => {
    const products = order?.products ?? [];
    const variants = products.flatMap(productRows);
    return {
      products: products.length,
      variants: variants.length,
      units: variants.reduce((total, variant) => total + variant.quantity, 0),
    };
  }, [order]);

  if (isLoading) return <LoadingState />;
  if (error?.isForbidden) return <PermissionDeniedState />;
  if (error?.isNotFound) {
    return (
      <EmptyState
        title="No encontramos esta orden"
        description="Puede que el enlace esté incompleto o que la orden ya no exista."
        action={
          <Link
            className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep"
            to="/purchases/orders"
          >
            Volver a órdenes
          </Link>
        }
      />
    );
  }
  if (error)
    return (
      <ErrorState
        title="No pudimos cargar la orden"
        description={error.detail}
        onRetry={() => setRetryVersion((version) => version + 1)}
      />
    );
  if (!order) return null;

  return (
    <div className="pw-order-detail space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          className="rounded-xl border border-pw-line bg-white p-5"
          role="region"
          aria-labelledby="order-data-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="order-data-title" className="text-lg font-extrabold">
              Datos de la orden
            </h2>
            <StatusBadge tone={orderStatusTone(order.orderStatusId)}>
              {orderStatusLabel(order.orderStatusId, order.orderStatusName)}
            </StatusBadge>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailField
              className="rounded-lg border border-pw-line bg-pw-canvas p-3"
              label="Proveedor"
              value={order.supplierName ?? `Proveedor #${order.supplierId}`}
            />
            <DetailField
              className="rounded-lg border border-pw-line bg-pw-canvas p-3"
              label="Fecha de compra"
              value={formatDate(order.purchaseDate)}
            />
            <DetailField
              className="rounded-lg border border-pw-line bg-pw-canvas p-3"
              label="Moneda de compra"
              value={order.purchaseCurrencyName ?? "Sin especificar"}
            />
            <DetailField
              className="rounded-lg border border-pw-line bg-pw-canvas p-3"
              label="Tasa de cambio"
              value={formatExchangeRate(order.exchangeRate)}
            />
          </dl>
        </section>

        <aside
          className="self-start rounded-xl border border-pw-line bg-white p-5 lg:sticky lg:top-6 lg:row-span-5"
          aria-label="Resumen financiero de la orden"
        >
          <h2 id="summary-title" className="text-lg font-extrabold">
            Resumen de compra
          </h2>
          <dl className="mt-5 grid grid-cols-3 divide-x divide-pw-line border-y border-pw-line py-3 text-center">
            <SummaryMetric label="Productos" value={String(summary.products)} />
            <SummaryMetric label="Variantes" value={String(summary.variants)} />
            <SummaryMetric label="Unidades" value={String(summary.units)} />
          </dl>
          <h3 className="mt-6 font-extrabold">Costos</h3>
          <dl className="mt-3 space-y-3">
            <SummaryCostRow label="Costo de mercadería" value={formatCordobas(order.merchandiseTotalNio)} />
            <SummaryCostRow label="Envío proveedor" value={formatUsd(order.supplierShippingCostUsd)} />
            <SummaryCostRow label="Envío a bodega" value={formatUsd(order.warehouseShippingCostUsd)} />
            <div className="border-t border-pw-line pt-3">
              <SummaryCostRow label="Valor recibido" value={formatCordobas(order.receivedAmountNio)} />
            </div>
            <div className="border-t border-pw-line pt-3">
              <SummaryCostRow label="Costo total" value={formatCordobas(order.totalCostNio)} emphasis />
            </div>
          </dl>
        </aside>

        <section
          className="rounded-xl border border-pw-line bg-white p-5"
          aria-labelledby="products-title"
        >
          <h2 id="products-title" className="text-lg font-extrabold">
            Productos de la orden
          </h2>
          <div className="mt-4 space-y-4">
            {order.products.length === 0 ? (
              <p className="text-sm text-pw-muted">
                No hay productos registrados para esta orden.
              </p>
            ) : null}
            {order.products.map((product) => {
              const rows = productRows(product);
              return (
              <article
                key={product.id}
                role="region"
                aria-label={`Presentaciones de ${product.name}`}
                className="overflow-hidden rounded-lg border border-pw-line"
              >
                <div className="border-b border-pw-line bg-pw-brand-soft px-4 py-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">
                        Código proveedor
                      </p>
                      <h3 className="truncate font-mono text-sm font-black tracking-tight text-pw-ink">
                        {product.supplierProductCode}
                      </h3>
                    </div>
                    <div className="min-w-0 sm:border-l sm:border-pw-line sm:pl-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-pw-muted">
                        Producto
                      </p>
                      <p
                        className="mt-1 truncate text-sm font-semibold text-pw-ink"
                        title={product.name}
                      >
                        {product.name}
                      </p>
                    </div>
                  </div>
                </div>
                {rows.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-pw-muted">
                    No hay variantes registradas para este producto.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-232 text-left text-sm">
                    <thead className="bg-pw-canvas text-xs text-pw-muted">
                      <tr>
                        <th className="px-4 py-3 font-extrabold">
                          Presentación
                        </th>
                        <th className="px-4 py-3 text-center font-extrabold">Talla</th>
                        <th className="px-4 py-3 text-center font-extrabold">
                          Solicitadas
                        </th>
                        <th className="px-4 py-3 text-center font-extrabold">Recibidas</th>
                        <th className="px-4 py-3 text-center font-extrabold">Pendientes</th>
                        <th className="px-4 py-3 text-center font-extrabold">
                          Costo unitario
                        </th>
                        <th className="px-4 py-3 text-center font-extrabold">Precio venta</th>
                        <th className="px-4 py-3 text-center font-extrabold">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        return (
                        <tr
                          key={row.id}
                          className="border-t border-pw-line"
                        >
                          <td className="px-4 py-3 font-bold">
                            {row.presentationName}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.sizeName ?? "Sin talla"}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums">{row.quantity}</td>
                          <td className="px-4 py-3 text-center tabular-nums">
                            {row.receivedQuantity}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums">
                            {Math.max(
                              row.quantity - row.receivedQuantity,
                              0,
                            )}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums">
                            {formatCordobas(row.unitCostNio)}
                          </td>
                          <td className="px-4 py-3 text-center font-extrabold tabular-nums">
                            {formatCordobas(row.salePrice)}
                          </td>
                          <td className="px-4 py-3 text-center font-extrabold text-pw-brand-deep tabular-nums">
                            {formatCordobas(row.salePrice - row.unitCostNio)}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                )}
              </article>
              );
            })}
          </div>
        </section>

        <section
          className="rounded-xl border border-pw-line bg-white p-5"
          aria-labelledby="shortages-title"
        >
          <h2 id="shortages-title" className="text-lg font-extrabold">
            Faltantes
          </h2>
          {order.purchaseShortages.length === 0 ? (
            <p className="mt-3 text-sm text-pw-muted">
              No hay faltantes registrados para esta orden.
            </p>
          ) : (
            <>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <DetailField
                  label="Pérdida total"
                  value={nullableMoney(order.totalShortageLossNio)}
                />
                <DetailField
                  label="Reembolso del proveedor"
                  value={nullableMoney(order.totalSupplierRefundNio)}
                />
                <DetailField
                  label="Pérdida neta"
                  value={nullableMoney(order.netShortageLossNio)}
                />
              </dl>
              <p className="mt-4 text-sm text-pw-muted">
                {order.purchaseShortages.length} faltante(s) registrado(s).{" "}
                {order.supplierRefund
                  ? `Reembolso registrado: ${formatCordobas(order.supplierRefund.amountNio)}.`
                  : "Sin reembolso registrado."}
              </p>
            </>
          )}
        </section>

        <section
          className="rounded-xl border border-pw-line bg-white p-5"
          aria-labelledby="tracking-title"
        >
          <h2 id="tracking-title" className="text-lg font-extrabold">
            Números de seguimiento
          </h2>
          {tracking === null && !trackingError ? (
            <p
              className="mt-3 text-sm text-pw-muted"
              role="status"
              aria-label="Cargando números de seguimiento"
            >
              Cargando números de seguimiento…
            </p>
          ) : null}
          {trackingError?.isForbidden ? <PermissionDeniedState /> : null}
          {trackingError?.isNotFound ? (
            <EmptyState
              title="No encontramos los números de seguimiento"
              description={trackingError.detail}
            />
          ) : null}
          {trackingError &&
          !trackingError.isForbidden &&
          !trackingError.isNotFound ? (
            <ErrorState
              title="No pudimos cargar los números de seguimiento"
              description={trackingError.detail}
              onRetry={() => setTrackingRetryVersion((version) => version + 1)}
            />
          ) : null}
          {tracking?.length === 0 && !trackingError ? (
            <p className="mt-3 text-sm text-pw-muted">
              Aún no hay números de seguimiento para esta orden.
            </p>
          ) : null}
          {tracking && tracking.length > 0 ? (
            <ul className="mt-4 divide-y divide-pw-line rounded-lg border border-pw-line">
              {tracking.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-1 px-4 py-3 sm:grid-cols-3"
                >
                  <strong>{item.trackingNumber}</strong>
                  <span className="text-sm text-pw-muted">
                    {item.shippingCompanyName ??
                      "Transportadora sin especificar"}
                  </span>
                  <span className="text-sm text-pw-muted">
                    Enviado: {formatDate(item.supplierShipmentDate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section
          className="rounded-xl border border-pw-line bg-white p-5"
          aria-labelledby="comments-title"
        >
          <h2 id="comments-title" className="text-lg font-extrabold">
            Comentario interno
          </h2>
          <p className="mt-3 text-sm leading-6 text-pw-muted">
            {order.comments ?? "No hay comentario interno para esta orden."}
          </p>
        </section>
      </div>
    </div>
  );
}

function DetailField({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-extrabold text-pw-muted">{label}</dt>
      <dd className="mt-1 font-extrabold text-pw-ink">{value}</dd>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <dt className="text-xs font-extrabold text-pw-muted">{label}</dt>
      <dd className="mt-1 font-extrabold tabular-nums text-pw-ink">{value}</dd>
    </div>
  );
}

function SummaryCostRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs font-extrabold text-pw-muted">{label}</dt>
      <dd className={emphasis ? "text-base font-black text-pw-brand-deep tabular-nums" : "font-extrabold text-pw-ink tabular-nums"}>{value}</dd>
    </div>
  );
}
