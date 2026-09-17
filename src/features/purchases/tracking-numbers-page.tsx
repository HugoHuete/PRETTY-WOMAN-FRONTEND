import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-provider';
import { usePageActions } from '../../shared/layout/page-actions-context';
import { FilterBar } from '../../shared/ui/filter-bar';
import { Pagination } from '../../shared/ui/pagination';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../../shared/ui/screen-state';
import { SelectControl, type SelectOption } from '../../shared/ui/select-control';
import { StatusBadge } from '../../shared/ui/status-badge';
import {
  buildTrackingNumbersPath,
  orderStatusLabel,
  type OrderStatusDTO,
  type OrderTrackingNumberDTO,
  type PaginatedResult,
  type ShippingCompanyDTO,
  type TrackingNumberFilters,
} from './purchase-order-types';

type LoadError = {
  detail: string;
  isForbidden: boolean;
};

type OptionLoadState = {
  error: string | null;
  isLoading: boolean;
};

type TrackingFormValues = {
  shippingCompanyId: string;
  trackingNumber: string;
  supplierShipmentDate: string;
  warehouseDeliveryDate: string;
  productReceiptId: number | null;
};

const defaultFilters: TrackingNumberFilters = {
  page: 1,
  pageSize: 20,
  isReceived: '',
  trackingNumber: '',
  shippingCompanyId: '',
  orderStatusId: '',
  purchaseDateFrom: '',
  purchaseDateTo: '',
};

const backendMaxPageSize = 100;

function filtersFromSearchParams(searchParams: URLSearchParams): TrackingNumberFilters {
  const page = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('pageSize'));
  const normalizedPageSize =
    Number.isInteger(pageSize) && pageSize > 0
      ? Math.min(pageSize, backendMaxPageSize)
      : defaultFilters.pageSize;

  return {
    page: Number.isInteger(page) && page > 0 ? page : defaultFilters.page,
    pageSize: normalizedPageSize,
    isReceived: searchParams.get('isReceived') ?? '',
    trackingNumber: searchParams.get('trackingNumber') ?? '',
    shippingCompanyId: searchParams.get('shippingCompanyId') ?? '',
    orderStatusId: searchParams.get('orderStatusId') ?? '',
    purchaseDateFrom: searchParams.get('purchaseDateFrom') ?? '',
    purchaseDateTo: searchParams.get('purchaseDateTo') ?? '',
  };
}

function searchParamsFromFilters(filters: TrackingNumberFilters) {
  const path = buildTrackingNumbersPath(filters);
  return path.slice(path.indexOf('?') + 1);
}

function todayDateInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

function toUtcDateTime(value: string) {
  return value ? `${value}T00:00:00.000Z` : null;
}

function trackingFormFromItem(item: OrderTrackingNumberDTO): TrackingFormValues {
  return {
    shippingCompanyId: String(item.shippingCompanyId),
    trackingNumber: item.trackingNumber,
    supplierShipmentDate: item.supplierShipmentDate?.slice(0, 10) ?? '',
    warehouseDeliveryDate: item.warehouseDeliveryDate?.slice(0, 10) ?? '',
    productReceiptId: item.productReceiptId,
  };
}

function formatDate(value: string | null) {
  if (!value) return 'Sin registrar';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat('es-NI', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

async function problemDetail(
  response: Response,
  fallback: string,
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

function emptyTrackingForm(): TrackingFormValues {
  return {
    shippingCompanyId: '',
    trackingNumber: '',
    supplierShipmentDate: '',
    warehouseDeliveryDate: '',
    productReceiptId: null,
  };
}

export function TrackingNumbersPage() {
  const { request } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const [trackingPage, setTrackingPage] =
    useState<PaginatedResult<OrderTrackingNumberDTO> | null>(null);
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompanyDTO[]>([]);
  const [statuses, setStatuses] = useState<OrderStatusDTO[]>([]);
  const [shippingCompanyOptionsState, setShippingCompanyOptionsState] =
    useState<OptionLoadState>({ error: null, isLoading: true });
  const [statusOptionsState, setStatusOptionsState] = useState<OptionLoadState>({
    error: null,
    isLoading: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [shippingCompanyRetryVersion, setShippingCompanyRetryVersion] = useState(0);
  const [statusRetryVersion, setStatusRetryVersion] = useState(0);
  const [editingTrackingId, setEditingTrackingId] = useState<number | null>(null);
  const [trackingForm, setTrackingForm] = useState<TrackingFormValues>(emptyTrackingForm);
  const [trackingMutationError, setTrackingMutationError] = useState<string | null>(null);
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [pendingDeleteTrackingId, setPendingDeleteTrackingId] = useState<number | null>(null);
  const [deletingTrackingId, setDeletingTrackingId] = useState<number | null>(null);
  const trackingRequestId = useRef(0);

  useEffect(() => {
    setHeading({ title: 'Números de tracking', breadcrumbs: 'Compras' });
    setAction(
      <Link
        className="inline-flex min-h-11 items-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
        to="/purchases/orders"
      >
        Volver a órdenes
      </Link>,
    );
    return () => {
      setHeading(null);
      setAction(null);
    };
  }, [setAction, setHeading]);

  useEffect(() => {
    let active = true;
    const loadShippingCompanies = async () => {
      setShippingCompanyOptionsState((state) => ({ ...state, isLoading: true }));
      try {
        const response = await request('/api/v1/shipping-companies');
        if (!response.ok) {
          const detail = await problemDetail(
            response,
            'No se pudieron cargar las empresas de envío.',
          );
          if (active) {
            setShippingCompanyOptionsState({ error: detail, isLoading: false });
          }
          return;
        }
        const loadedCompanies = (await response.json()) as ShippingCompanyDTO[];
        if (active) {
          setShippingCompanies(loadedCompanies);
          setShippingCompanyOptionsState({ error: null, isLoading: false });
        }
      } catch {
        if (active) {
          setShippingCompanyOptionsState({
            error: 'No se pudieron cargar las empresas de envío.',
            isLoading: false,
          });
        }
      }
    };

    void loadShippingCompanies();
    return () => {
      active = false;
    };
  }, [request, shippingCompanyRetryVersion]);

  useEffect(() => {
    let active = true;
    const loadStatuses = async () => {
      setStatusOptionsState((state) => ({ ...state, isLoading: true }));
      try {
        const response = await request('/api/v1/orders/statuses');
        if (!response.ok) {
          const detail = await problemDetail(
            response,
            'No se pudieron cargar los estados de la orden.',
          );
          if (active) {
            setStatusOptionsState({ error: detail, isLoading: false });
          }
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
            error: 'No se pudieron cargar los estados de la orden.',
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
    const requestId = ++trackingRequestId.current;
    const loadTrackingNumbers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await request(buildTrackingNumbersPath(filters));
        if (!response.ok) {
          const detail = await problemDetail(
            response,
            'No se pudieron cargar los números de tracking.',
          );
          if (requestId === trackingRequestId.current) {
            setError({ detail, isForbidden: response.status === 403 });
          }
          return;
        }
        const nextPage = (await response.json()) as PaginatedResult<OrderTrackingNumberDTO>;
        if (requestId === trackingRequestId.current) setTrackingPage(nextPage);
      } catch {
        if (requestId === trackingRequestId.current) {
          setError({
            detail: 'No se pudieron cargar los números de tracking.',
            isForbidden: false,
          });
        }
      } finally {
        if (requestId === trackingRequestId.current) setIsLoading(false);
      }
    };

    void loadTrackingNumbers();
  }, [filters, request, retryVersion]);

  const updateFilters = (nextFilters: TrackingNumberFilters) => {
    setSearchParams(searchParamsFromFilters(nextFilters));
  };

  const changeFilter =
    (
      key: keyof Pick<
        TrackingNumberFilters,
        | 'isReceived'
        | 'trackingNumber'
        | 'shippingCompanyId'
        | 'orderStatusId'
        | 'purchaseDateFrom'
        | 'purchaseDateTo'
      >,
    ) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateFilters({ ...filters, [key]: event.target.value, page: 1 });
    };

  const clearFilters = () => updateFilters(defaultFilters);
  const hasActiveFilters = Boolean(
    filters.isReceived ||
      filters.trackingNumber ||
      filters.shippingCompanyId ||
      filters.orderStatusId ||
      filters.purchaseDateFrom ||
      filters.purchaseDateTo,
  );

  const openEditor = (item: OrderTrackingNumberDTO) => {
    setEditingTrackingId(item.id);
    setTrackingForm(trackingFormFromItem(item));
    setTrackingMutationError(null);
    setPendingDeleteTrackingId(null);
  };

  const closeEditor = () => {
    if (isSavingTracking) return;
    setEditingTrackingId(null);
    setTrackingMutationError(null);
  };

  const handleTrackingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingTrackingId === null || !trackingPage) return;

    const shippingCompanyId = Number(trackingForm.shippingCompanyId);
    if (!shippingCompanyId || !trackingForm.trackingNumber.trim()) {
      setTrackingMutationError(
        'La empresa y el número de tracking son obligatorios.',
      );
      return;
    }

    const today = todayDateInputValue();
    if (
      [trackingForm.supplierShipmentDate, trackingForm.warehouseDeliveryDate].some(
        (date) => date && date > today,
      )
    ) {
      setTrackingMutationError('Las fechas de tracking no pueden ser futuras.');
      return;
    }

    setIsSavingTracking(true);
    setTrackingMutationError(null);
    try {
      const item = trackingPage.items.find((entry) => entry.id === editingTrackingId);
      if (!item) return;
      const response = await request(
        `/api/v1/orders/${item.orderId}/tracking-numbers/${editingTrackingId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shippingCompanyId,
            trackingNumber: trackingForm.trackingNumber.trim(),
            supplierShipmentDate: toUtcDateTime(trackingForm.supplierShipmentDate),
            warehouseDeliveryDate: toUtcDateTime(trackingForm.warehouseDeliveryDate),
            productReceiptId: trackingForm.productReceiptId,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await problemDetail(response, 'No se pudo guardar el número de tracking.'),
        );
      }
      closeEditor();
      setRetryVersion((version) => version + 1);
    } catch (caught) {
      setTrackingMutationError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo guardar el número de tracking.',
      );
    } finally {
      setIsSavingTracking(false);
    }
  };

  const deleteTracking = async (item: OrderTrackingNumberDTO) => {
    setDeletingTrackingId(item.id);
    setTrackingMutationError(null);
    try {
      const response = await request(
        `/api/v1/orders/${item.orderId}/tracking-numbers/${item.id}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new Error(
          await problemDetail(response, 'No se pudo eliminar el número de tracking.'),
        );
      }
      setPendingDeleteTrackingId(null);
      if (filters.page > 1 && trackingPage?.items.length === 1) {
        updateFilters({ ...filters, page: filters.page - 1 });
      } else {
        setRetryVersion((version) => version + 1);
      }
    } catch (caught) {
      setTrackingMutationError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo eliminar el número de tracking.',
      );
    } finally {
      setDeletingTrackingId(null);
    }
  };

  const shippingCompanyOptions: SelectOption[] = [
    { value: '', label: 'Todas' },
    ...shippingCompanies.map((company) => ({
      value: String(company.id),
      label: company.name,
    })),
  ];
  const statusOptions: SelectOption[] = [
    { value: '', label: 'Todos' },
    ...statuses.map((status) => ({
      value: String(status.id),
      label: orderStatusLabel(status.id, status.name),
    })),
  ];

  if (isLoading) return <LoadingState />;
  if (error?.isForbidden) return <PermissionDeniedState />;

  return (
    <div className="space-y-5">
      <FilterBar
        aria-label="Filtros de números de tracking"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="grid min-w-52 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="tracking-number-filter">
          Número de tracking
          <input
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="tracking-number-filter"
            value={filters.trackingNumber}
            onChange={changeFilter('trackingNumber')}
          />
        </label>
        <label className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="tracking-received-filter">
          Estado de recepción
          <SelectControl
            aria-label="Estado de recepción"
            disabled={false}
            id="tracking-received-filter"
            value={filters.isReceived}
            options={[
              { value: '', label: 'Todos' },
              { value: 'false', label: 'Pendientes' },
              { value: 'true', label: 'Recibidos' },
            ]}
            onChange={changeFilter('isReceived')}
          />
        </label>
        <label className="grid min-w-48 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="tracking-shipping-company-filter">
          Empresa de envío
          <SelectControl
            aria-label="Empresa de envío"
            disabled={shippingCompanyOptionsState.isLoading || Boolean(shippingCompanyOptionsState.error)}
            id="tracking-shipping-company-filter"
            value={filters.shippingCompanyId}
            options={shippingCompanyOptions}
            onChange={changeFilter('shippingCompanyId')}
          />
        </label>
        <label className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="tracking-order-status-filter">
          Estado de orden
          <SelectControl
            aria-label="Estado de orden"
            disabled={statusOptionsState.isLoading || Boolean(statusOptionsState.error)}
            id="tracking-order-status-filter"
            value={filters.orderStatusId}
            options={statusOptions}
            onChange={changeFilter('orderStatusId')}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="tracking-date-from">
          Fecha inicial
          <input
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="tracking-date-from"
            type="date"
            value={filters.purchaseDateFrom}
            onChange={changeFilter('purchaseDateFrom')}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-extrabold text-pw-muted" htmlFor="tracking-date-to">
          Fecha final
          <input
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="tracking-date-to"
            type="date"
            value={filters.purchaseDateTo}
            onChange={changeFilter('purchaseDateTo')}
          />
        </label>
        {hasActiveFilters ? (
          <button
            className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas"
            type="button"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        ) : null}
      </FilterBar>

      {shippingCompanyOptionsState.error || statusOptionsState.error ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {shippingCompanyOptionsState.error ? (
            <OptionLoadError
              description={shippingCompanyOptionsState.error}
              label="Opciones de empresas de envío"
              onRetry={() => setShippingCompanyRetryVersion((version) => version + 1)}
            />
          ) : null}
          {statusOptionsState.error ? (
            <OptionLoadError
              description={statusOptionsState.error}
              label="Opciones de estados de orden"
              onRetry={() => setStatusRetryVersion((version) => version + 1)}
            />
          ) : null}
        </div>
      ) : null}

      {error && !error.isForbidden ? (
        <ErrorState
          title="No pudimos cargar los números de tracking"
          description={error.detail}
          onRetry={() => setRetryVersion((version) => version + 1)}
        />
      ) : null}

      {!error && trackingPage?.totalCount === 0 && hasActiveFilters ? (
        <EmptyState
          title="No hay trackings que coincidan"
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

      {!error && trackingPage?.totalCount === 0 && !hasActiveFilters ? (
        <EmptyState
          title="Aún no hay números de tracking"
          description="Los trackings agregados en las órdenes aparecerán aquí."
        />
      ) : null}

      {!error && trackingPage && trackingPage.totalCount > 0 ? (
        <>
          <TrackingTable
            items={trackingPage.items}
            editingTrackingId={editingTrackingId}
            pendingDeleteTrackingId={pendingDeleteTrackingId}
            deletingTrackingId={deletingTrackingId}
            trackingForm={trackingForm}
            shippingCompanies={shippingCompanies}
            isSavingTracking={isSavingTracking}
            shippingCompanyOptionsState={shippingCompanyOptionsState}
            trackingMutationError={trackingMutationError}
            onEdit={openEditor}
            onDeleteRequest={(id) => {
              setPendingDeleteTrackingId(id);
              setTrackingMutationError(null);
              setEditingTrackingId(null);
            }}
            onDeleteCancel={() => setPendingDeleteTrackingId(null)}
            onDelete={(item) => void deleteTracking(item)}
            onCloseEditor={closeEditor}
            onSubmit={(event) => void handleTrackingSubmit(event)}
            onFormChange={setTrackingForm}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pw-muted">
              Mostrando números de tracking: {trackingPage.totalCount}
            </p>
            <Pagination
              page={trackingPage.page}
              totalPages={trackingPage.totalPages}
              onPageChange={(page) => updateFilters({ ...filters, page })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

type TrackingTableProps = {
  items: OrderTrackingNumberDTO[];
  editingTrackingId: number | null;
  pendingDeleteTrackingId: number | null;
  deletingTrackingId: number | null;
  trackingForm: TrackingFormValues;
  shippingCompanies: ShippingCompanyDTO[];
  isSavingTracking: boolean;
  shippingCompanyOptionsState: OptionLoadState;
  trackingMutationError: string | null;
  onEdit: (item: OrderTrackingNumberDTO) => void;
  onDeleteRequest: (id: number) => void;
  onDeleteCancel: () => void;
  onDelete: (item: OrderTrackingNumberDTO) => void;
  onCloseEditor: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (form: TrackingFormValues) => void;
};

function TrackingTable({
  items,
  editingTrackingId,
  pendingDeleteTrackingId,
  deletingTrackingId,
  trackingForm,
  shippingCompanies,
  isSavingTracking,
  shippingCompanyOptionsState,
  trackingMutationError,
  onEdit,
  onDeleteRequest,
  onDeleteCancel,
  onDelete,
  onCloseEditor,
  onSubmit,
  onFormChange,
}: TrackingTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-pw-line bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          Números de tracking y sus órdenes de compra
        </caption>
        <thead className="bg-pw-brand-soft text-[0.9375rem] uppercase tracking-[0.045em] text-pw-ink">
          <tr>
            {['Tracking', 'Orden', 'Empresa de envío', 'Peso', 'Envío (USD)', 'Estado', 'Fechas', 'Acciones'].map(
              (header) => (
                <th
                  className="border-b border-pw-brand/35 px-4 py-3.5 font-extrabold"
                  scope="col"
                  key={header}
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-pw-line">
          {items.map((item) => (
            <Fragment key={item.id}>
              <tr className="hover:bg-pw-brand-soft/40">
                <td className="max-w-52 px-4 py-3">
                  <strong className="block truncate" title={item.trackingNumber}>
                    {item.trackingNumber}
                  </strong>
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="font-extrabold text-pw-brand-deep underline underline-offset-4"
                    to={`/purchases/orders/${item.orderId}`}
                    aria-label={`OC-${item.orderId}`}
                  >
                    OC-{item.orderId}
                  </Link>
                </td>
                <td className="max-w-44 px-4 py-3">
                  <span className="block truncate" title={item.shippingCompanyName ?? undefined}>
                    {item.shippingCompanyName ?? 'Sin empresa'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{item.weight.toFixed(2)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatUsd(item.shippingCost)}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={item.productReceiptId ? 'success' : 'warning'}>
                    {item.productReceiptId ? 'Recibido' : 'Pendiente'}
                  </StatusBadge>
                </td>
                <td className="min-w-44 px-4 py-3 text-sm">
                  <dl className="grid gap-1">
                    <div>
                      <dt className="inline text-xs font-extrabold text-pw-muted">Envío: </dt>
                      <dd className="inline">{formatDate(item.supplierShipmentDate)}</dd>
                    </div>
                    <div>
                      <dt className="inline text-xs font-extrabold text-pw-muted">Bodega: </dt>
                      <dd className="inline">{formatDate(item.warehouseDeliveryDate)}</dd>
                    </div>
                  </dl>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep"
                      type="button"
                      aria-label={`Editar tracking ${item.trackingNumber}`}
                      onClick={() => onEdit(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                      type="button"
                      aria-label={`Eliminar tracking ${item.trackingNumber}`}
                      onClick={() => onDeleteRequest(item.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
              {editingTrackingId === item.id ? (
                <tr>
                  <td className="bg-pw-canvas px-4 py-4" colSpan={8}>
                    <form
                      aria-label={`Editar tracking ${item.trackingNumber}`}
                      className="rounded-lg border border-pw-line bg-white p-4"
                      onSubmit={onSubmit}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-extrabold">Editar tracking</h2>
                        <span className="text-sm text-pw-muted">OC-{item.orderId}</span>
                      </div>
                      {trackingMutationError ? (
                        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                          {trackingMutationError}
                        </p>
                      ) : null}
                      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="grid gap-1 text-sm font-semibold">
                          Empresa de envío
                          <SelectControl
                            aria-label="Empresa de envío"
                            id={`tracking-edit-company-${item.id}`}
                            value={trackingForm.shippingCompanyId}
                            options={[
                              { value: '', label: 'Selecciona una empresa' },
                              ...shippingCompanies.map((company) => ({
                                value: String(company.id),
                                label: company.name,
                              })),
                            ]}
                            disabled={shippingCompanyOptionsState.isLoading || Boolean(shippingCompanyOptionsState.error)}
                            onChange={(event) =>
                              onFormChange({
                                ...trackingForm,
                                shippingCompanyId: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          Número de tracking
                          <input
                            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal"
                            required
                            value={trackingForm.trackingNumber}
                            onChange={(event) =>
                              onFormChange({
                                ...trackingForm,
                                trackingNumber: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          Fecha de envío
                          <input
                            aria-label="Fecha de envío"
                            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal"
                            type="date"
                            max={todayDateInputValue()}
                            value={trackingForm.supplierShipmentDate}
                            onChange={(event) =>
                              onFormChange({
                                ...trackingForm,
                                supplierShipmentDate: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          Entrega en bodega
                          <input
                            aria-label="Entrega en bodega"
                            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal"
                            type="date"
                            max={todayDateInputValue()}
                            value={trackingForm.warehouseDeliveryDate}
                            onChange={(event) =>
                              onFormChange({
                                ...trackingForm,
                                warehouseDeliveryDate: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-3">
                        <button
                          className="min-h-10 rounded-lg border border-pw-line bg-white px-4 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep"
                          type="button"
                          onClick={onCloseEditor}
                        >
                          Cancelar
                        </button>
                        <button
                          className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
                          type="submit"
                          disabled={isSavingTracking || shippingCompanyOptionsState.isLoading || Boolean(shippingCompanyOptionsState.error)}
                        >
                          {isSavingTracking ? 'Guardando…' : 'Guardar tracking'}
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : null}
              {pendingDeleteTrackingId === item.id ? (
                <tr>
                  <td className="bg-red-50 px-4 py-3" colSpan={8}>
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 text-sm text-red-700"
                      role="alert"
                    >
                      <span>¿Eliminar este número de tracking?</span>
                      {trackingMutationError ? (
                        <p className="basis-full rounded-lg border border-red-200 bg-white p-3 text-sm font-semibold">{trackingMutationError}</p>
                      ) : null}
                      <div className="flex gap-2">
                        <button
                          className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold hover:bg-red-50"
                          type="button"
                          onClick={onDeleteCancel}
                        >
                          Cancelar
                        </button>
                        <button
                          className="min-h-10 rounded-lg bg-red-700 px-3 text-sm font-extrabold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          disabled={deletingTrackingId === item.id}
                          onClick={() => onDelete(item)}
                        >
                          {deletingTrackingId === item.id ? 'Eliminando…' : 'Confirmar eliminación'}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OptionLoadError({
  description,
  label,
  onRetry,
}: {
  description: string;
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
      <button
        className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
        type="button"
        onClick={onRetry}
      >
        Reintentar
      </button>
    </section>
  );
}

