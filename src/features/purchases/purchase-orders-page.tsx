import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { DataTable, type DataTableColumn } from "../../shared/ui/data-table";
import { FilterBar } from "../../shared/ui/filter-bar";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { Pagination } from "../../shared/ui/pagination";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import {
  buildOrdersPath,
  formatCordobas,
  orderStatusLabel,
  orderStatusTone,
  type OrderDTO,
  type OrderFilters,
  type OrderStatusDTO,
  type PaginatedResult,
  type SupplierDTO,
} from "./purchase-order-types";

type LoadError = {
  detail: string;
  isForbidden: boolean;
};

type OptionLoadState = {
  error: string | null;
  isLoading: boolean;
};

const defaultFilters: OrderFilters = {
  page: 1,
  pageSize: 20,
  purchaseDateFrom: "",
  purchaseDateTo: "",
  orderStatusId: "",
  supplierId: "",
};

const backendMaxPageSize = 100;

function filtersFromSearchParams(searchParams: URLSearchParams): OrderFilters {
  const page = Number(searchParams.get("page"));
  const pageSize = Number(searchParams.get("pageSize"));
  const normalizedPageSize =
    Number.isInteger(pageSize) && pageSize > 0
      ? Math.min(pageSize, backendMaxPageSize)
      : defaultFilters.pageSize;

  return {
    page: Number.isInteger(page) && page > 0 ? page : defaultFilters.page,
    pageSize: normalizedPageSize,
    purchaseDateFrom: searchParams.get("purchaseDateFrom") ?? "",
    purchaseDateTo: searchParams.get("purchaseDateTo") ?? "",
    orderStatusId: searchParams.get("orderStatusId") ?? "",
    supplierId: searchParams.get("supplierId") ?? "",
  };
}

function searchParamsFromFilters(filters: OrderFilters) {
  const path = buildOrdersPath(filters);
  return path.slice(path.indexOf("?") + 1);
}

async function problemDetail(
  response: Response,
  fallback = "No se pudieron cargar las órdenes de compra.",
) {
  try {
    const problem = (await response.json()) as {
      detail?: string;
      title?: string;
    };
    return problem.detail ?? problem.title ?? fallback;
  } catch {
    return fallback;
  }
}

function formatPurchaseDate(value: string) {
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

export function PurchaseOrdersPage() {
  const { request } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const [orders, setOrders] = useState<PaginatedResult<OrderDTO> | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [statuses, setStatuses] = useState<OrderStatusDTO[]>([]);
  const [supplierOptionsState, setSupplierOptionsState] =
    useState<OptionLoadState>({ error: null, isLoading: true });
  const [statusOptionsState, setStatusOptionsState] = useState<OptionLoadState>(
    { error: null, isLoading: true },
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [supplierRetryVersion, setSupplierRetryVersion] = useState(0);
  const [statusRetryVersion, setStatusRetryVersion] = useState(0);
  const orderRequestId = useRef(0);

  useEffect(() => {
    setHeading({ title: "Órdenes de compra", breadcrumbs: "Inventario" });
    setAction(
      <Link
        className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
        to="/purchases/orders/new"
      >
        <span aria-hidden="true" className="mr-1 text-lg leading-none">
          +
        </span>
        Nueva orden
      </Link>,
    );
    return () => {
      setHeading(null);
      setAction(null);
    };
  }, [setAction, setHeading]);

  useEffect(() => {
    let active = true;

    const loadSuppliers = async () => {
      setSupplierOptionsState((state) => ({ ...state, isLoading: true }));
      try {
        const response = await request("/api/v1/suppliers");
        if (!response.ok) {
          const detail = await problemDetail(
            response,
            "No se pudieron cargar los proveedores.",
          );
          if (active)
            setSupplierOptionsState({ error: detail, isLoading: false });
          return;
        }
        const loadedSuppliers = (await response.json()) as SupplierDTO[];
        if (active) {
          setSuppliers(loadedSuppliers);
          setSupplierOptionsState({ error: null, isLoading: false });
        }
      } catch {
        if (active) {
          setSupplierOptionsState({
            error: "No se pudieron cargar los proveedores.",
            isLoading: false,
          });
        }
      }
    };

    void loadSuppliers();
    return () => {
      active = false;
    };
  }, [request, supplierRetryVersion]);

  useEffect(() => {
    let active = true;

    const loadStatuses = async () => {
      setStatusOptionsState((state) => ({ ...state, isLoading: true }));
      try {
        const response = await request("/api/v1/orders/statuses");
        if (!response.ok) {
          const detail = await problemDetail(
            response,
            "No se pudieron cargar los estados.",
          );
          if (active)
            setStatusOptionsState({ error: detail, isLoading: false });
          return;
        }
        const loadedStatuses = (await response.json()) as OrderStatusDTO[];
        if (active) {
          setStatuses(loadedStatuses);
          setStatusOptionsState({ error: null, isLoading: false });
        }
      } catch {
        if (active) {
          setStatusOptionsState({
            error: "No se pudieron cargar los estados.",
            isLoading: false,
          });
        }
      }
    };

    void loadStatuses();
    return () => {
      active = false;
    };
  }, [request, statusRetryVersion]);

  useEffect(() => {
    const requestId = ++orderRequestId.current;
    const loadOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await request(buildOrdersPath(filters));
        if (!response.ok) {
          const detail = await problemDetail(response);
          if (requestId === orderRequestId.current) {
            setError({ detail, isForbidden: response.status === 403 });
          }
          return;
        }
        const nextOrders = (await response.json()) as PaginatedResult<OrderDTO>;
        if (requestId === orderRequestId.current) setOrders(nextOrders);
      } catch {
        if (requestId === orderRequestId.current) {
          setError({
            detail: "No se pudieron cargar las órdenes de compra.",
            isForbidden: false,
          });
        }
      } finally {
        if (requestId === orderRequestId.current) setIsLoading(false);
      }
    };

    void loadOrders();
  }, [filters, request, retryVersion]);

  const updateFilters = (nextFilters: OrderFilters) => {
    setSearchParams(searchParamsFromFilters(nextFilters));
  };

  const changeFilter =
    (
      key: keyof Pick<
        OrderFilters,
        "purchaseDateFrom" | "purchaseDateTo" | "orderStatusId" | "supplierId"
      >,
    ) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateFilters({ ...filters, [key]: event.target.value, page: 1 });
    };

  const clearFilters = () => updateFilters(defaultFilters);
  const hasActiveFilters = Boolean(
    filters.purchaseDateFrom ||
    filters.purchaseDateTo ||
    filters.orderStatusId ||
    filters.supplierId,
  );
  const statusesById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status.name])),
    [statuses],
  );
  const columns: readonly DataTableColumn<OrderDTO>[] = [
    {
      key: "order-supplier",
      header: "Orden y proveedor",
      render: (order) => (
        <span className="block min-w-40">
          <strong className="block">OC-{order.id}</strong>
          <span className="block text-xs text-pw-muted">
            {order.supplierName ?? `Proveedor #${order.supplierId}`}
          </span>
        </span>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      render: (order) => formatPurchaseDate(order.purchaseDate),
    },
    {
      key: "amount",
      header: "Monto (C$)",
      render: (order) => formatCordobas(order.merchandiseTotalNio),
    },
    {
      key: "shipping",
      header: "Envío proveedor (USD)",
      render: (order) => formatUsd(order.supplierShippingCostUsd),
    },
    {
      key: "total",
      header: "Total (C$)",
      render: (order) => <strong>{formatCordobas(order.totalCostNio)}</strong>,
    },
    {
      key: "status",
      header: "Estado",
      render: (order) => (
        <StatusBadge tone={orderStatusTone(order.orderStatusId)}>
          {orderStatusLabel(
            order.orderStatusId,
            order.orderStatusName ??
              statusesById.get(order.orderStatusId) ??
              null,
          )}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (order) => (
        <Link
          className="font-extrabold text-pw-brand-deep underline underline-offset-4"
          to={`/purchases/orders/${order.id}`}
        >
          Ver detalle
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <FilterBar
        aria-label="Filtros de órdenes de compra"
        onSubmit={(event) => event.preventDefault()}
      >
        <label
          className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted"
          htmlFor="purchase-order-supplier"
        >
          Proveedor
          <SelectControl
            aria-label="Proveedor"
            disabled={supplierOptionsState.isLoading}
            id="purchase-order-supplier"
            value={filters.supplierId}
            options={[
              { value: "", label: "Todos" },
              ...suppliers
                .filter((supplier) => supplier.enabled)
                .map((supplier) => ({
                  value: String(supplier.id),
                  label: supplier.name,
                })),
            ]}
            onChange={changeFilter("supplierId")}
          />
        </label>
        <label
          className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted"
          htmlFor="purchase-order-status"
        >
          Estado
          <SelectControl
            aria-label="Estado"
            disabled={statusOptionsState.isLoading}
            id="purchase-order-status"
            value={filters.orderStatusId}
            options={[
              { value: "", label: "Todos" },
              ...statuses.map((status) => ({
                value: String(status.id),
                label: orderStatusLabel(status.id, status.name),
              })),
            ]}
            onChange={changeFilter("orderStatusId")}
          />
        </label>
        <label
          className="grid gap-1.5 text-xs font-extrabold text-pw-muted"
          htmlFor="purchase-order-date-from"
        >
          Fecha inicial
          <input
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="purchase-order-date-from"
            type="date"
            value={filters.purchaseDateFrom}
            onChange={changeFilter("purchaseDateFrom")}
          />
        </label>
        <label
          className="grid gap-1.5 text-xs font-extrabold text-pw-muted"
          htmlFor="purchase-order-date-to"
        >
          Fecha final
          <input
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="purchase-order-date-to"
            type="date"
            value={filters.purchaseDateTo}
            onChange={changeFilter("purchaseDateTo")}
          />
        </label>
        {hasActiveFilters &&
        !(orders?.totalCount === 0 && !isLoading && !error) ? (
          <button
            className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas"
            type="button"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        ) : null}
      </FilterBar>

      {supplierOptionsState.error || statusOptionsState.error ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {supplierOptionsState.error ? (
            <OptionLoadError
              description={supplierOptionsState.error}
              isLoading={supplierOptionsState.isLoading}
              label="Opciones de proveedores"
              onRetry={() => setSupplierRetryVersion((version) => version + 1)}
            />
          ) : null}
          {statusOptionsState.error ? (
            <OptionLoadError
              description={statusOptionsState.error}
              isLoading={statusOptionsState.isLoading}
              label="Opciones de estados"
              onRetry={() => setStatusRetryVersion((version) => version + 1)}
            />
          ) : null}
        </div>
      ) : null}

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error?.isForbidden ? <PermissionDeniedState /> : null}
      {!isLoading && error && !error.isForbidden ? (
        <ErrorState
          title="No pudimos cargar las órdenes"
          description={error.detail}
          onRetry={() => setRetryVersion((version) => version + 1)}
        />
      ) : null}
      {!isLoading && !error && orders?.totalCount === 0 && hasActiveFilters ? (
        <EmptyState
          title="No hay órdenes que coincidan"
          description="Prueba con otros filtros o restablece los valores."
          action={
            <button
              className="min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep"
              type="button"
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          }
        />
      ) : null}
      {!isLoading && !error && orders?.totalCount === 0 && !hasActiveFilters ? (
        <EmptyState
          title="Aún no hay órdenes de compra"
          description="Crea la primera orden para comenzar a registrar compras."
          action={
            <Link
              className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep"
              to="/purchases/orders/new"
            >
              Nueva orden
            </Link>
          }
        />
      ) : null}
      {!isLoading && !error && orders && orders.totalCount > 0 ? (
        <>
          <DataTable
            caption="Órdenes de compra. Los totales principales se expresan en córdobas."
            columns={columns}
            rows={orders.items}
            rowKey={(order) => String(order.id)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pw-muted">
              Mostrando órdenes de compra: {orders.totalCount}
            </p>
            <Pagination
              page={orders.page}
              totalPages={orders.totalPages}
              onPageChange={(page) => updateFilters({ ...filters, page })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function OptionLoadError({
  description,
  isLoading,
  label,
  onRetry,
}: {
  description: string;
  isLoading: boolean;
  label: string;
  onRetry: () => void;
}) {
  return (
    <section
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pw-line bg-white px-4 py-3"
      role="region"
    >
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-pw-ink">{label}</h2>
        <p className="mt-1 text-sm text-pw-muted">{description}</p>
      </div>
      {isLoading ? (
        <p className="text-sm font-bold text-pw-muted" role="status">
          Cargando…
        </p>
      ) : (
        <button
          className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
          type="button"
          onClick={onRetry}
        >
          Reintentar
        </button>
      )}
    </section>
  );
}
