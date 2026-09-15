import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { StatusBadge } from "../../shared/ui/status-badge";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import {
  formatCordobas,
  orderStatusLabel,
  orderStatusTone,
  type OrderProductDTO,
  type OrderProductVariantDTO,
  type OrderDTO,
  type ShippingCompanyDTO,
  type OrderTrackingNumberDTO,
  type OrderReceiptSummaryDTO,
  type OrderReceiptDTO,
} from "./purchase-order-types";

type LoadError = {
  detail: string;
  isForbidden: boolean;
  isNotFound: boolean;
};

type TrackingFormMode = "create" | "edit";

type TrackingFormValues = {
  shippingCompanyId: string;
  trackingNumber: string;
  supplierShipmentDate: string;
  warehouseDeliveryDate: string;
  productReceiptId: number | null;
};

function emptyTrackingForm(): TrackingFormValues {
  return {
    shippingCompanyId: "",
    trackingNumber: "",
    supplierShipmentDate: "",
    warehouseDeliveryDate: "",
    productReceiptId: null,
  };
}

function trackingFormFromItem(
  item: OrderTrackingNumberDTO,
): TrackingFormValues {
  return {
    shippingCompanyId: String(item.shippingCompanyId),
    trackingNumber: item.trackingNumber,
    supplierShipmentDate: item.supplierShipmentDate?.slice(0, 10) ?? "",
    warehouseDeliveryDate: item.warehouseDeliveryDate?.slice(0, 10) ?? "",
    productReceiptId: item.productReceiptId,
  };
}

type ReceiptEditorLine = {
  detailId: number;
  productId: number;
  productName: string;
  supplierProductCode: string;
  presentationName: string;
  sizeName: string;
  quantity: number;
  weight: string;
  salePrice: string;
};

type ReceiptEditorTracking = {
  id: number;
  trackingNumber: string;
  shippingCompanyName: string | null;
  shippingCostUsd: string;
};

type ReceiptEditorState = {
  receipt: OrderReceiptDTO;
  lines: ReceiptEditorLine[];
  trackings: ReceiptEditorTracking[];
  warehouseShippingCostUsd: string;
};
function receiptEditorFromData(order: OrderDTO, receipt: OrderReceiptDTO): ReceiptEditorState {
  const variants = order.products.flatMap((product) =>
    product.presentations.flatMap((presentation) =>
      presentation.sizes.map((size) => ({
        product,
        presentation,
        size,
      })),
    ),
  );
  const productVariants = Array.isArray(receipt.productVariants) ? receipt.productVariants : [];
  const trackingNumbers = Array.isArray(receipt.trackingNumbers) ? receipt.trackingNumbers : [];

  return {
    receipt,
    lines: productVariants.map((detail) => {
      const match = variants.find((variant) => variant.size.id === detail.productId);
      return {
        detailId: detail.productReceiptDetailId,
        productId: detail.productId,
        productName: match?.product.name ?? `Producto #${detail.productId}`,
        supplierProductCode: match?.product.supplierProductCode ?? "Sin código",
        presentationName: match?.presentation.name ?? "Sin presentación",
        sizeName: match?.size.sizeName ?? "Sin talla",
        quantity: detail.quantity,
        weight: String(detail.weight),
        salePrice: match?.size.salePrice == null ? "" : String(match.size.salePrice),
      };
    }),
    trackings: trackingNumbers.map((tracking) => ({
      id: tracking.id,
      trackingNumber: tracking.trackingNumber,
      shippingCompanyName: tracking.shippingCompanyName,
      shippingCostUsd: String(tracking.shippingCost),
    })),
    warehouseShippingCostUsd: String(receipt.warehouseShippingCostUsd),
  };
}
type SupplierRefundFormValues = {
  amountNio: string;
  reference: string;
  comments: string;
};

function emptySupplierRefundForm(): SupplierRefundFormValues {
  return { amountNio: "", reference: "", comments: "" };
}

function todayDateInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function toUtcDateTime(value: string) {
  return value ? `${value}T00:00:00.000Z` : null;
}

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
  const { setAction, setHeading } = usePageActions();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [tracking, setTracking] = useState<OrderTrackingNumberDTO[] | null>(
    null,
  );
  const [receipts, setReceipts] = useState<OrderReceiptSummaryDTO[] | null>(null);
  const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null);
  const [receiptEditor, setReceiptEditor] = useState<ReceiptEditorState | null>(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [receiptMutationError, setReceiptMutationError] = useState<string | null>(null);
  const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);
  const [isShortageConfirmationOpen, setIsShortageConfirmationOpen] = useState(false);
  const [shortageMutationError, setShortageMutationError] = useState<string | null>(null);
  const [isClosingShortages, setIsClosingShortages] = useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundForm, setRefundForm] = useState<SupplierRefundFormValues>(
    emptySupplierRefundForm,
  );
  const [refundMutationError, setRefundMutationError] = useState<string | null>(
    null,
  );
  const [isSavingRefund, setIsSavingRefund] = useState(false);
  const [isDeclineRefundConfirmationOpen, setIsDeclineRefundConfirmationOpen] =
    useState(false);
  const [isDecliningRefund, setIsDecliningRefund] = useState(false);
  const [shortageResolutionMessage, setShortageResolutionMessage] = useState<
    string | null
  >(null);

  const [isReceiptConfirmationOpen, setIsReceiptConfirmationOpen] = useState(false);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [trackingError, setTrackingError] = useState<LoadError | null>(null);
  const [receiptsError, setReceiptsError] = useState<LoadError | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [shippingCompanies, setShippingCompanies] = useState<
    ShippingCompanyDTO[] | null
  >(null);
  const [shippingCompaniesError, setShippingCompaniesError] =
    useState<LoadError | null>(null);
  const [isLoadingShippingCompanies, setIsLoadingShippingCompanies] =
    useState(false);
  const [trackingFormMode, setTrackingFormMode] =
    useState<TrackingFormMode | null>(null);
  const [editingTrackingId, setEditingTrackingId] = useState<number | null>(
    null,
  );
  const [trackingForm, setTrackingForm] =
    useState<TrackingFormValues>(emptyTrackingForm);
  const [trackingMutationError, setTrackingMutationError] = useState<
    string | null
  >(null);
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [pendingDeleteTrackingId, setPendingDeleteTrackingId] = useState<
    number | null
  >(null);
  const [deletingTrackingId, setDeletingTrackingId] = useState<number | null>(
    null,
  );
  const [trackingRetryVersion, setTrackingRetryVersion] = useState(0);
  const [receiptsRetryVersion, setReceiptsRetryVersion] = useState(0);
  const orderRequestId = useRef(0);
  const trackingRequestId = useRef(0);
  const receiptRequestId = useRef(0);
  const receiptEditorRequestId = useRef(0);
  const trackingActionOrderId = useRef(id);
  const receiptActionOrderId = useRef(id);
  const shortageActionOrderId = useRef(id);

  useEffect(() => {
    if (trackingActionOrderId.current === id) return;
    trackingActionOrderId.current = id;
    setTrackingFormMode(null);
    setEditingTrackingId(null);
    setTrackingForm(emptyTrackingForm());
    setTrackingMutationError(null);
    setIsSavingTracking(false);
    setPendingDeleteTrackingId(null);
    setDeletingTrackingId(null);
  }, [id]);

  useEffect(() => {
    if (receiptActionOrderId.current === id) return;
    receiptActionOrderId.current = id;
    receiptEditorRequestId.current += 1;
    setEditingReceiptId(null);
    setReceiptEditor(null);
    setIsLoadingReceipt(false);
    setReceiptMutationError(null);
    setReceiptSuccess(null);
    setIsReceiptConfirmationOpen(false);
    setIsSavingReceipt(false);
  }, [id]);
  useEffect(() => {
    if (shortageActionOrderId.current === id) return;
    shortageActionOrderId.current = id;
    setIsShortageConfirmationOpen(false);
    setShortageMutationError(null);
    setIsClosingShortages(false);
    setIsRefundDialogOpen(false);
    setIsDeclineRefundConfirmationOpen(false);
    setRefundMutationError(null);
    setShortageResolutionMessage(null);
    setIsSavingRefund(false);
    setIsDecliningRefund(false);
  }, [id]);

  useEffect(() => {
    setHeading({
      title:
        order && String(order.id) === id
          ? `Orden #${order.id}`
          : "Detalle de compra",
      breadcrumbs: (
        <Link
          className="inline-flex items-center underline underline-offset-4 hover:text-pw-brand-deep"
          to="/purchases/orders"
        >
          ← Regresar a compras
        </Link>
      ),
    });
    setAction(
      order && String(order.id) === id ? (
        <button
          className="inline-flex min-h-10 items-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep"
          type="button"
          onClick={() => navigate(`/purchases/orders/${id}/edit`)}
        >
          Editar orden
        </button>
      ) : null,
    );
    return () => {
      setHeading(null);
      setAction(null);
    };
  }, [id, navigate, order, setAction, setHeading]);

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
              presentations: (product.presentations ?? []).map(
                (presentation) => ({
                  ...presentation,
                  sizes: presentation.sizes ?? [],
                }),
              ),
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

  useEffect(() => {
    const requestId = ++receiptRequestId.current;
    const loadReceipts = async () => {
      setReceipts(null);
      setReceiptsError(null);
      try {
        const response = await request(`/api/v1/orders/${id}/receipts`);
        if (!response.ok) {
          const detail = await problemDetail(response);
          if (requestId === receiptRequestId.current) {
            setReceiptsError({
              detail,
              isForbidden: response.status === 403,
              isNotFound: response.status === 404,
            });
          }
          return;
        }
        const body = await response.json();
        const loadedReceipts = Array.isArray(body)
          ? (body as OrderReceiptSummaryDTO[])
          : [];
        if (requestId === receiptRequestId.current) setReceipts(loadedReceipts);
      } catch {
        if (requestId === receiptRequestId.current) {
          setReceiptsError({
            detail: "No se pudieron cargar las recepciones de esta orden.",
            isForbidden: false,
            isNotFound: false,
          });
        }
      }
    };

    void loadReceipts();
  }, [id, request, receiptsRetryVersion]);

  const openReceiptEditor = async (receiptId: number) => {
    if (!id || !order || isLoadingReceipt) return;
    const requestId = ++receiptEditorRequestId.current;
    const actionOrderId = id;
    setEditingReceiptId(receiptId);
    setReceiptEditor(null);
    setReceiptMutationError(null);
    setReceiptSuccess(null);
    setIsLoadingReceipt(true);
    try {
      const response = await request(`/api/v1/orders/${actionOrderId}/receipts/${receiptId}`);
      if (!response.ok) throw new Error(await problemDetail(response));
      const detail = (await response.json()) as OrderReceiptDTO;
      if (requestId !== receiptEditorRequestId.current || receiptActionOrderId.current !== actionOrderId) return;
      setReceiptEditor(receiptEditorFromData(order, detail));
    } catch (caught) {
      if (requestId === receiptEditorRequestId.current && receiptActionOrderId.current === actionOrderId) {
        setReceiptMutationError(caught instanceof Error ? caught.message : "No se pudo cargar el detalle de la recepción.");
      }
    } finally {
      if (requestId === receiptEditorRequestId.current && receiptActionOrderId.current === actionOrderId) setIsLoadingReceipt(false);
    }
  };

  const closeReceiptEditor = () => {
    if (isSavingReceipt) return;
    setEditingReceiptId(null);
    setReceiptEditor(null);
    setReceiptMutationError(null);
    setIsReceiptConfirmationOpen(false);
  };

  const updateReceiptLine = (detailId: number, key: "weight" | "salePrice", value: string) => {
    setReceiptEditor((current) => current ? { ...current, lines: current.lines.map((line) => line.detailId === detailId ? { ...line, [key]: value } : line) } : current);
    setReceiptMutationError(null);
  };

  const updateReceiptTracking = (trackingId: number, value: string) => {
    setReceiptEditor((current) => current ? { ...current, trackings: current.trackings.map((tracking) => tracking.id === trackingId ? { ...tracking, shippingCostUsd: value } : tracking) } : current);
    setReceiptMutationError(null);
  };

  const openReceiptConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!receiptEditor || isSavingReceipt) return;
    if (receiptEditor.trackings.length === 0) {
      const warehouseShipping = Number(receiptEditor.warehouseShippingCostUsd);
      if (!Number.isFinite(warehouseShipping) || warehouseShipping < 0) {
        setReceiptMutationError("El costo de envío de bodega debe ser mayor o igual a cero.");
        return;
      }
    }
    for (const line of receiptEditor.lines) {
      const weight = Number(line.weight);
      if (!Number.isFinite(weight) || weight <= 0) {
        setReceiptMutationError(`El peso del código de proveedor ${line.supplierProductCode} debe ser mayor que cero.`);
        return;
      }
      if (line.salePrice.trim() && (!Number.isFinite(Number(line.salePrice)) || Number(line.salePrice) <= 0)) {
        setReceiptMutationError(`El precio de venta del código de proveedor ${line.supplierProductCode} debe ser mayor que cero.`);
        return;
      }
    }
    for (const tracking of receiptEditor.trackings) {
      const shippingCost = Number(tracking.shippingCostUsd);
      if (!Number.isFinite(shippingCost) || shippingCost < 0) {
        setReceiptMutationError(`El costo de envío del tracking ${tracking.trackingNumber} debe ser mayor o igual a cero.`);
        return;
      }
    }
    setReceiptMutationError(null);
    setIsReceiptConfirmationOpen(true);
  };

  const saveReceipt = async () => {
    if (!id || !receiptEditor || isSavingReceipt) return;
    const actionOrderId = id;
    const payload = {
      warehouseShippingCostUsd: receiptEditor.trackings.length === 0 ? Number(receiptEditor.warehouseShippingCostUsd) : null,
      trackingNumbers: receiptEditor.trackings.map((tracking) => ({ id: tracking.id, shippingCostUsd: Number(tracking.shippingCostUsd) })),
      productVariants: receiptEditor.lines.map((line) => ({ productReceiptDetailId: line.detailId, weight: Number(line.weight), salePrice: line.salePrice.trim() ? Number(line.salePrice) : null })),
    };
    setIsSavingReceipt(true);
    setReceiptMutationError(null);
    try {
      const response = await request(`/api/v1/orders/${actionOrderId}/receipts/${receiptEditor.receipt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await problemDetail(response));
      if (receiptActionOrderId.current !== actionOrderId) return;
      setIsReceiptConfirmationOpen(false);
      setEditingReceiptId(null);
      setReceiptEditor(null);
      setReceiptSuccess("Recepción actualizada correctamente.");
      setReceiptsRetryVersion((version) => version + 1);
      setRetryVersion((version) => version + 1);
    } catch (caught) {
      if (receiptActionOrderId.current === actionOrderId) {
        setReceiptMutationError(caught instanceof Error ? caught.message : "No se pudo actualizar la recepción.");
      }
    } finally {
      if (receiptActionOrderId.current === actionOrderId) setIsSavingReceipt(false);
    }
  };

  const loadShippingCompanies = async () => {
    if (shippingCompanies !== null || isLoadingShippingCompanies) return;

    setIsLoadingShippingCompanies(true);
    setShippingCompaniesError(null);
    try {
      const response = await request("/api/v1/shipping-companies");
      if (!response.ok) {
        const detail = await problemDetail(response);
        setShippingCompaniesError({
          detail,
          isForbidden: response.status === 403,
          isNotFound: response.status === 404,
        });
        return;
      }
      setShippingCompanies((await response.json()) as ShippingCompanyDTO[]);
    } catch {
      setShippingCompaniesError({
        detail: "No se pudieron cargar las empresas de envío.",
        isForbidden: false,
        isNotFound: false,
      });
    } finally {
      setIsLoadingShippingCompanies(false);
    }
  };

  const openTrackingForm = (
    mode: TrackingFormMode,
    item?: OrderTrackingNumberDTO,
  ) => {
    setTrackingFormMode(mode);
    setEditingTrackingId(mode === "edit" ? (item?.id ?? null) : null);
    setTrackingForm(item ? trackingFormFromItem(item) : emptyTrackingForm());
    setTrackingMutationError(null);
    setPendingDeleteTrackingId(null);
    void loadShippingCompanies();
  };

  const closeTrackingForm = (force = false) => {
    if (isSavingTracking && !force) return;
    setTrackingFormMode(null);
    setEditingTrackingId(null);
    setTrackingMutationError(null);
  };

  const handleTrackingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trackingFormMode) return;

    const shippingCompanyId = Number(trackingForm.shippingCompanyId);
    if (!shippingCompanyId || !trackingForm.trackingNumber.trim()) {
      setTrackingMutationError(
        "La empresa y el número de tracking son obligatorios.",
      );
      return;
    }
    const today = todayDateInputValue();
    if (
      [
        trackingForm.supplierShipmentDate,
        trackingForm.warehouseDeliveryDate,
      ].some((date) => date && date > today)
    ) {
      setTrackingMutationError("Las fechas de tracking no pueden ser futuras.");
      return;
    }

    const payload = {
      shippingCompanyId,
      trackingNumber: trackingForm.trackingNumber.trim(),
      supplierShipmentDate: toUtcDateTime(trackingForm.supplierShipmentDate),
      warehouseDeliveryDate: toUtcDateTime(trackingForm.warehouseDeliveryDate),
      productReceiptId: trackingForm.productReceiptId,
    };
    const isEdit = trackingFormMode === "edit";
    const path = isEdit
      ? `/api/v1/orders/${id}/tracking-numbers/${editingTrackingId}`
      : `/api/v1/orders/${id}/tracking-numbers`;

    setIsSavingTracking(true);
    setTrackingMutationError(null);
    try {
      const response = await request(path, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? payload : [payload]),
      });
      if (!response.ok) {
        throw new Error(await problemDetail(response));
      }
      closeTrackingForm(true);
      setTrackingRetryVersion((version) => version + 1);
    } catch (caught) {
      setTrackingMutationError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el número de tracking.",
      );
    } finally {
      setIsSavingTracking(false);
    }
  };

  const deleteTracking = async (trackingId: number) => {
    setDeletingTrackingId(trackingId);
    setTrackingMutationError(null);
    try {
      const response = await request(
        `/api/v1/orders/${id}/tracking-numbers/${trackingId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(await problemDetail(response));
      }
      setPendingDeleteTrackingId(null);
      setTrackingRetryVersion((version) => version + 1);
    } catch (caught) {
      setTrackingMutationError(
        caught instanceof Error
          ? caught.message
          : "No se pudo eliminar el número de tracking.",
      );
    } finally {
      setDeletingTrackingId(null);
    }
  };

  const pendingShortageVariants = useMemo(
    () =>
      (order?.products ?? [])
        .flatMap(productRows)
        .filter((variant) => variant.receivedQuantity < variant.quantity),
    [order],
  );
  const pendingShortageUnits = pendingShortageVariants.reduce(
    (total, variant) => total + variant.quantity - variant.receivedQuantity,
    0,
  );
  const canCloseShortages =
    order !== null &&
    order.orderStatusId !== 3 &&
    order.orderStatusId !== 4 &&
    order.purchaseShortages.length === 0 &&
    pendingShortageVariants.length > 0 &&
    !isClosingShortages;

  const canResolveShortages =
    order !== null &&
    order.purchaseShortages.length > 0 &&
    Number(order.totalShortageLossNio ?? 0) > 0 &&
    order.supplierRefund === null &&
    order.supplierRefundDeclinedAt === null &&
    !isSavingRefund &&
    !isDecliningRefund;

  const openRefundDialog = () => {
    if (!canResolveShortages || !order) return;
    setRefundMutationError(null);
    setShortageResolutionMessage(null);
    setRefundForm({
      ...emptySupplierRefundForm(),
      amountNio: String(order.totalShortageLossNio ?? ""),
    });
    setIsRefundDialogOpen(true);
  };

  const openDeclineRefundConfirmation = () => {
    if (!canResolveShortages) return;
    setRefundMutationError(null);
    setShortageResolutionMessage(null);
    setIsDeclineRefundConfirmationOpen(true);
  };

  const saveSupplierRefund = async () => {
    if (!id || !order || !canResolveShortages) return;
    const amountNio = Number(refundForm.amountNio);
    const maximumAmountNio = Number(order.totalShortageLossNio ?? 0);
    if (!Number.isFinite(amountNio) || amountNio <= 0 || amountNio > maximumAmountNio) {
      setRefundMutationError(
        `El monto debe ser mayor que C$0.00 y no superar ${formatCordobas(maximumAmountNio)}.`,
      );
      return;
    }

    const actionOrderId = id;
    setIsSavingRefund(true);
    setRefundMutationError(null);
    try {
      const response = await request(`/api/v1/orders/${actionOrderId}/supplier-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountNio,
          ...(refundForm.reference.trim() ? { reference: refundForm.reference.trim() } : {}),
          ...(refundForm.comments.trim() ? { comments: refundForm.comments.trim() } : {}),
        }),
      });
      if (!response.ok) throw new Error(await problemDetail(response));
      const updatedOrder = (await response.json()) as OrderDTO;
      if (shortageActionOrderId.current !== actionOrderId) return;
      setOrder(updatedOrder);
      setIsRefundDialogOpen(false);
      setShortageResolutionMessage("Reembolso registrado correctamente.");
    } catch (caught) {
      if (shortageActionOrderId.current === actionOrderId) {
        setRefundMutationError(
          caught instanceof Error
            ? caught.message
            : "No se pudo registrar el reembolso.",
        );
      }
    } finally {
      if (shortageActionOrderId.current === actionOrderId) setIsSavingRefund(false);
    }
  };

  const declineSupplierRefund = async () => {
    if (!id || !order || !canResolveShortages) return;
    const actionOrderId = id;
    setIsDecliningRefund(true);
    setRefundMutationError(null);
    try {
      const response = await request(
        `/api/v1/orders/${actionOrderId}/supplier-refund/decline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!response.ok) throw new Error(await problemDetail(response));
      const updatedOrder = (await response.json()) as OrderDTO;
      if (shortageActionOrderId.current !== actionOrderId) return;
      setOrder(updatedOrder);
      setIsDeclineRefundConfirmationOpen(false);
      setShortageResolutionMessage(
        "El faltante se marcó como pérdida sin reembolso.",
      );
    } catch (caught) {
      if (shortageActionOrderId.current === actionOrderId) {
        setRefundMutationError(
          caught instanceof Error
            ? caught.message
            : "No se pudo marcar el faltante como pérdida.",
        );
      }
    } finally {
      if (shortageActionOrderId.current === actionOrderId) setIsDecliningRefund(false);
    }
  };

  const openShortageConfirmation = () => {
    if (!canCloseShortages) return;
    setShortageMutationError(null);
    setIsShortageConfirmationOpen(true);
  };

  const closeShortages = async () => {
    if (!id || !canCloseShortages) return;
    const actionOrderId = id;
    setIsClosingShortages(true);
    setShortageMutationError(null);
    try {
      const response = await request(
        `/api/v1/orders/${actionOrderId}/shortages/close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!response.ok) throw new Error(await problemDetail(response));
      if (shortageActionOrderId.current !== actionOrderId) return;
      setIsShortageConfirmationOpen(false);
      setRetryVersion((version) => version + 1);
    } catch (caught) {
      if (shortageActionOrderId.current === actionOrderId) {
        setShortageMutationError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cerrar los faltantes.",
        );
      }
    } finally {
      if (shortageActionOrderId.current === actionOrderId) {
        setIsClosingShortages(false);
      }
    }
  };
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
            <SummaryCostRow
              label="Costo de mercadería"
              value={formatCordobas(order.merchandiseTotalNio)}
            />
            <SummaryCostRow
              label="Envío proveedor"
              value={formatUsd(order.supplierShippingCostUsd)}
            />
            <SummaryCostRow
              label="Envío a bodega"
              value={formatUsd(order.warehouseShippingCostUsd)}
            />
            <div className="border-t border-pw-line pt-3">
              <SummaryCostRow
                label="Valor recibido"
                value={formatCordobas(order.receivedAmountNio)}
              />
            </div>
            <div className="border-t border-pw-line pt-3">
              <SummaryCostRow
                label="Costo total"
                value={formatCordobas(order.totalCostNio)}
                emphasis
              />
            </div>
          </dl>
          <div className="mt-5 space-y-2 border-t border-pw-line pt-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">
              Acciones de la orden
            </p>
            <button
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={() => navigate("/purchases/orders/" + id + "/receive")}
              disabled={order.orderStatusId === 3 || order.orderStatusId === 4}
              title={order.orderStatusId === 3 ? "No se puede recibir una orden completamente recibida." : order.orderStatusId === 4 ? "No se puede recibir una orden cancelada." : undefined}
            >
              Registrar recepción

            </button>
            <button
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canCloseShortages}
              title={
                order.purchaseShortages.length > 0
                  ? "Los faltantes de esta orden ya fueron cerrados."
                  : pendingShortageVariants.length === 0
                    ? "No hay cantidades pendientes para cerrar."
                    : order.orderStatusId === 3
                      ? "La orden ya fue recibida completamente."
                      : order.orderStatusId === 4
                        ? "No se puede cerrar una orden cancelada."
                        : undefined
              }
              type="button"
              onClick={openShortageConfirmation}
            >
              Cerrar con faltantes
            </button>
            {shortageMutationError ? (
              <p
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                {shortageMutationError}
              </p>
            ) : null}
            <a
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand"
              href="#tracking-section"
            >
              Ir a números de seguimiento
            </a>
          </div>
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
                  <div className="space-y-1 bg-pw-brand-soft px-4 py-3">
                    <p
                      className="truncate text-sm text-pw-ink"
                      title={`Código proveedor: ${product.supplierProductCode}`}
                    >
                      <span className="font-medium text-pw-muted">Código proveedor:</span>{" "}
                      <span className="font-mono font-medium text-pw-ink">
                        {product.supplierProductCode}
                      </span>
                    </p>
                    <p
                      className="truncate text-sm text-pw-ink"
                      title={`Nombre: ${product.name}`}
                    >
                      <span className="font-medium text-pw-muted">Nombre:</span>{" "}
                      <span className="font-normal text-pw-ink">{product.name}</span>
                    </p>
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
                            <th className="px-4 py-3 text-center font-extrabold">
                              Talla
                            </th>
                            <th className="px-4 py-3 text-center font-extrabold">
                              Solicitadas
                            </th>
                            <th className="px-4 py-3 text-center font-extrabold">
                              Recibidas
                            </th>
                            <th className="px-4 py-3 text-center font-extrabold">
                              Pendientes
                            </th>
                            <th className="px-4 py-3 text-center font-extrabold">
                              Costo unitario
                            </th>
                            <th className="px-4 py-3 text-center font-extrabold">
                              Precio venta
                            </th>
                            <th className="px-4 py-3 text-center font-extrabold">
                              Ganancia
                            </th>
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
                                <td className="px-4 py-3 text-center tabular-nums">
                                  {row.quantity}
                                </td>
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
                                  {row.salePrice === null ? "Sin definir" : formatCordobas(row.salePrice)}
                                </td>
                                <td className="px-4 py-3 text-center font-extrabold text-pw-brand-deep tabular-nums">
                                  {row.salePrice === null
                                    ? "Sin definir"
                                    : formatCordobas(row.salePrice - row.unitCostNio)}
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
          role="region"
          aria-labelledby="receipts-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="receipts-title" className="text-lg font-extrabold">
              Recepciones
            </h2>
            {receipts && receipts.length > 0 ? (
              <span className="text-sm font-semibold text-pw-muted">
                {receipts.length} {receipts.length === 1 ? "recepción" : "recepciones"}
              </span>
            ) : null}
          </div>
          {receiptSuccess ? (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">
              {receiptSuccess}
            </p>
          ) : null}
          {receipts === null && !receiptsError ? (
            <p className="mt-3 text-sm text-pw-muted" role="status" aria-label="Cargando recepciones">
              Cargando recepciones…
            </p>
          ) : null}
          {receiptsError?.isForbidden ? <PermissionDeniedState /> : null}
          {receiptsError?.isNotFound ? (
            <EmptyState title="No encontramos las recepciones" description={receiptsError.detail} />
          ) : null}
          {receiptsError && !receiptsError.isForbidden && !receiptsError.isNotFound ? (
            <ErrorState
              title="No pudimos cargar las recepciones"
              description={receiptsError.detail}
              onRetry={() => setReceiptsRetryVersion((version) => version + 1)}
            />
          ) : null}
          {receipts?.length === 0 && !receiptsError ? (
            <p className="mt-3 text-sm text-pw-muted">
              No hay recepciones registradas para esta orden.
            </p>
          ) : null}
          {receipts && receipts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {receipts.map((receipt) => (
                                <article
                  key={receipt.id}
                  className="grid gap-4 rounded-lg border border-pw-line bg-pw-canvas p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="font-extrabold">Recepción #{receipt.id}</h3>
                    <p className="mt-1 text-sm text-pw-muted">{formatDate(receipt.receivedDate)}</p>
                    <p className="mt-2 text-xs font-semibold text-pw-muted lg:mt-1">
                      {receipt.trackingCount} {receipt.trackingCount === 1 ? "tracking asociado" : "trackings asociados"}
                    </p>
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:gap-5">
                    <ReceiptMetric label="Envío de bodega" value={formatUsd(receipt.warehouseShippingCostUsd)} />
                    <ReceiptMetric label="Productos" value={String(receipt.productCount)} />

                  </dl>
                  <button
                    className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-extrabold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep lg:justify-self-end"
                    type="button"
                    aria-label={`Editar recepción #${receipt.id}`}
                    onClick={() => void openReceiptEditor(receipt.id)}
                  >
                    Editar recepción
                  </button>
                  {editingReceiptId === receipt.id ? (
                  <section
                    className="mt-4 w-full min-w-0 rounded-lg border border-pw-line bg-white p-4 lg:col-span-full"
                    role="region"
                    aria-label={`Editar recepción #${receipt.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-extrabold">Editar recepción</h4>
                      </div>
                      <button className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-semibold text-pw-muted hover:bg-pw-canvas" type="button" onClick={closeReceiptEditor}>
                        Cancelar
                      </button>
                    </div>
                    {isLoadingReceipt ? <p className="mt-4 text-sm text-pw-muted" role="status">Cargando detalle de la recepción…</p> : null}
                    {receiptMutationError && !receiptEditor ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{receiptMutationError}</p> : null}
                    {receiptEditor ? (
                      <form className="mt-4 space-y-4" onSubmit={openReceiptConfirmation}>
                        {receiptEditor.trackings.length === 0 ? (
                          <label className="grid max-w-xs gap-1 text-sm font-semibold">
                            Envío de bodega (USD)
                            <input
                              aria-label={`Envío de bodega de recepción #${receipt.id}`}
                              className="h-10 rounded-lg border border-pw-line px-3 text-sm font-normal"
                              min="0"
                              step="0.01"
                              type="number"
                              value={receiptEditor.warehouseShippingCostUsd}
                              onChange={(event) => setReceiptEditor((current) => current ? { ...current, warehouseShippingCostUsd: event.target.value } : current)}
                            />
                          </label>
                        ) : (
                          <fieldset className="rounded-lg border border-pw-line p-3" aria-label="Costos de envío por tracking">
                            <legend className="px-1 text-sm font-extrabold">Costos de envío por tracking</legend>
                            <div className="space-y-3">
                              {receiptEditor.trackings.map((tracking) => (
                                <div className="grid gap-2 rounded-lg border border-pw-line bg-pw-canvas p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={tracking.id}>
                                  <span className="min-w-0 truncate text-sm font-semibold" title={tracking.trackingNumber}>
                                    {tracking.trackingNumber}{tracking.shippingCompanyName ? ` · ${tracking.shippingCompanyName}` : ""}
                                  </span>
                                  <label className="flex items-center justify-end gap-2 text-xs font-extrabold text-pw-muted">
                                    <span className="whitespace-nowrap">Costo de envío (USD)</span>
                                    <span className="flex h-9 w-24 overflow-hidden rounded-lg border border-pw-line bg-white">
                                      <span className="grid w-7 shrink-0 place-items-center border-r border-pw-line text-sm font-semibold text-pw-muted">$</span>
                                      <input
                                        aria-label="Costo de envío (USD)"
                                        className="h-full min-w-0 flex-1 px-2 text-center text-sm font-normal text-pw-ink outline-none focus:ring-2 focus:ring-pw-brand/30"
                                        min="0"
                                        step="0.01"
                                        type="number"
                                        value={tracking.shippingCostUsd}
                                        onChange={(event) => updateReceiptTracking(tracking.id, event.target.value)}
                                      />
                                    </span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </fieldset>
                        )}
                        <div className="overflow-x-auto rounded-lg border border-pw-line">
                          <table className="w-full min-w-[52rem] text-left text-sm">
                            <thead className="bg-pw-brand-soft text-xs text-pw-muted">
                              <tr>
                                <th className="px-3 py-2 font-extrabold">Producto</th>
                                <th className="px-3 py-2 text-center font-extrabold">Presentación</th>
                                <th className="px-3 py-2 text-center font-extrabold">Talla</th>
                                <th className="px-3 py-2 text-center font-extrabold">Recibidas</th>
                                <th className="px-3 py-2 text-center font-extrabold">Peso por unidad</th>
                                <th className="px-3 py-2 text-center font-extrabold">Precio de venta</th>
                              </tr>
                            </thead>
                            <tbody>
                              {receiptEditor.lines.map((line) => (
                                <tr className="border-t border-pw-line" key={line.detailId}>
                                  <td className="px-3 py-3">
                                    <strong className="block truncate" title={line.productName}>{line.productName}</strong>
                                    <span className="mt-1 block font-mono text-xs font-extrabold text-pw-brand-deep">{line.supplierProductCode}</span>
                                  </td>
                                  <td className="px-3 py-3 text-center text-sm font-semibold">{line.presentationName}</td>
                                  <td className="px-3 py-3 text-center font-semibold">{line.sizeName}</td>
                                  <td className="px-3 py-3 text-center font-semibold tabular-nums">{line.quantity}</td>
                                  <td className="px-3 py-3 text-center">
                                    <input
                                      aria-label={`Peso por unidad de ${line.productName} - ${line.presentationName} - ${line.sizeName}`}
                                      className="mx-auto h-10 w-24 rounded-lg border border-pw-line px-2 text-center font-semibold"
                                      min="0.01"
                                      step="0.01"
                                      type="number"
                                      value={line.weight}
                                      onChange={(event) => updateReceiptLine(line.detailId, "weight", event.target.value)}
                                    />
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <div className="mx-auto flex h-10 w-28 overflow-hidden rounded-lg border border-pw-line bg-white">
                                      <span className="grid w-8 shrink-0 place-items-center border-r border-pw-line text-sm font-semibold text-pw-muted">C$</span>
                                      <input
                                        aria-label={`Precio de venta de ${line.productName} - ${line.presentationName} - ${line.sizeName}`}
                                        className="min-w-0 flex-1 px-2 text-center font-semibold outline-none focus:ring-2 focus:ring-pw-brand/30"
                                        min="0.01"
                                        step="0.01"
                                        type="number"
                                        value={line.salePrice}
                                        onChange={(event) => updateReceiptLine(line.detailId, "salePrice", event.target.value)}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {receiptMutationError ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{receiptMutationError}</p> : null}
                        <div className="flex flex-wrap justify-end gap-2">
                          <button className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-semibold text-pw-muted hover:bg-pw-canvas" type="button" onClick={closeReceiptEditor}>Cancelar</button>
                          <button className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-50" disabled={isSavingReceipt} type="submit">Guardar cambios</button>
                        </div>
                      </form>
                    ) : null}
                  </section>
                ) : null}
                <ConfirmDialog
                  open={editingReceiptId === receipt.id && isReceiptConfirmationOpen}
                  title="Confirmar cambios"
                  description="¿Deseas actualizar esta recepción? Se recalcularán los costos asociados de la orden."
                  confirmLabel="Confirmar cambios"
                  isPending={isSavingReceipt}
                  error={receiptMutationError}
                  onConfirm={() => void saveReceipt()}
                  onClose={() => setIsReceiptConfirmationOpen(false)}
                />
              </article>
              ))}
            </div>
          ) : null}
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
              {shortageResolutionMessage ? (
                <p
                  className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"
                  role="status"
                >
                  {shortageResolutionMessage}
                </p>
              ) : null}
              {order.supplierRefundDeclinedAt ? (
                <p className="mt-4 text-sm text-pw-muted">
                  El proveedor no emitirá reembolso; el faltante quedó registrado como pérdida.
                </p>
              ) : null}
              {canResolveShortages ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    onClick={openRefundDialog}
                    disabled={isSavingRefund || isDecliningRefund}
                  >
                    Registrar reembolso
                  </button>
                  <button
                    className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-muted hover:bg-pw-canvas disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    onClick={openDeclineRefundConfirmation}
                    disabled={isSavingRefund || isDecliningRefund}
                  >
                    Marcar como pérdida
                  </button>
                </div>
              ) : null}

            </>
          )}
        </section>

        <section
          id="tracking-section"
          className="scroll-mt-6 rounded-xl border border-pw-line bg-white p-5"
          aria-labelledby="tracking-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="tracking-title" className="text-lg font-extrabold">
                Números de seguimiento
              </h2>
            </div>
            <button
              className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep"
              type="button"
              onClick={() => openTrackingForm("create")}
            >
              Agregar tracking
            </button>
          </div>

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
          {trackingMutationError ? (
            <p
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {trackingMutationError}
            </p>
          ) : null}

          {trackingFormMode ? (
            <form
              className="mt-4 rounded-lg border border-pw-line bg-pw-canvas p-4"
              onSubmit={(event) => void handleTrackingSubmit(event)}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-extrabold">
                  {trackingFormMode === "edit"
                    ? "Editar tracking"
                    : "Agregar tracking"}
                </h3>
              </div>

              {isLoadingShippingCompanies ? (
                <p className="mt-3 text-sm text-pw-muted" role="status">
                  Cargando empresas de envío…
                </p>
              ) : null}
              {shippingCompaniesError ? (
                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  role="alert"
                >
                  <span>{shippingCompaniesError.detail}</span>
                  <button
                    className="font-extrabold underline underline-offset-4"
                    type="button"
                    onClick={() => void loadShippingCompanies()}
                  >
                    Reintentar empresas
                  </button>
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">
                  Empresa de envío
                  <SelectControl
                    aria-label="Empresa de envío"
                    id="tracking-shipping-company"
                    value={trackingForm.shippingCompanyId}
                    options={[
                      { value: "", label: "Selecciona una empresa" },
                      ...(shippingCompanies ?? []).map((company) => ({
                        value: String(company.id),
                        label: company.name,
                      })),
                    ]}
                    disabled={
                      isLoadingShippingCompanies ||
                      Boolean(shippingCompaniesError)
                    }
                    onChange={(event) =>
                      setTrackingForm((current) => ({
                        ...current,
                        shippingCompanyId: event.target.value,
                      }))
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
                      setTrackingForm((current) => ({
                        ...current,
                        trackingNumber: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Fecha de envío
                  <input
                    className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal"
                    type="date"
                    max={todayDateInputValue()}
                    value={trackingForm.supplierShipmentDate}
                    onChange={(event) =>
                      setTrackingForm((current) => ({
                        ...current,
                        supplierShipmentDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Entrega en bodega
                  <input
                    className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal"
                    type="date"
                    max={todayDateInputValue()}
                    value={trackingForm.warehouseDeliveryDate}
                    onChange={(event) =>
                      setTrackingForm((current) => ({
                        ...current,
                        warehouseDeliveryDate: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button
                  className="min-h-10 rounded-lg border border-pw-line bg-white px-4 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep"
                  type="button"
                  onClick={() => closeTrackingForm()}
                >
                  Cancelar
                </button>
                <button
                  className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={
                    isSavingTracking ||
                    isLoadingShippingCompanies ||
                    Boolean(shippingCompaniesError)
                  }
                >
                  {isSavingTracking ? "Guardando…" : "Guardar tracking"}
                </button>
              </div>
            </form>
          ) : null}

          {tracking?.length === 0 && !trackingError ? (
            <p className="mt-4 text-sm text-pw-muted">
              Aún no hay números de seguimiento para esta orden.
            </p>
          ) : null}
          {tracking && tracking.length > 0 ? (
            <ul className="mt-4 divide-y divide-pw-line rounded-lg border border-pw-line">
              {tracking.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <strong className="block truncate">
                      {item.trackingNumber}
                    </strong>
                    <span className="mt-1 block text-sm text-pw-muted">
                      {item.shippingCompanyName ??
                        "Transportadora sin especificar"}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs font-extrabold text-pw-muted">
                        Enviado
                      </dt>
                      <dd>{formatDate(item.supplierShipmentDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-extrabold text-pw-muted">
                        Entrega bodega
                      </dt>
                      <dd>{formatDate(item.warehouseDeliveryDate)}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep"
                      type="button"
                      aria-label={`Editar tracking ${item.trackingNumber}`}
                      onClick={() => openTrackingForm("edit", item)}
                    >
                      Editar
                    </button>
                    <button
                      className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                      type="button"
                      aria-label={`Eliminar tracking ${item.trackingNumber}`}
                      onClick={() => {
                        setPendingDeleteTrackingId(item.id);
                        setTrackingMutationError(null);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                  {pendingDeleteTrackingId === item.id ? (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-3"
                      role="alert"
                    >
                      <span>¿Eliminar este número de tracking?</span>
                      <div className="flex gap-2">
                        <button
                          className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold hover:bg-red-50"
                          type="button"
                          onClick={() => setPendingDeleteTrackingId(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          className="min-h-10 rounded-lg bg-red-700 px-3 text-sm font-extrabold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          disabled={deletingTrackingId === item.id}
                          onClick={() => void deleteTracking(item.id)}
                        >
                          {deletingTrackingId === item.id
                            ? "Eliminando…"
                            : "Confirmar eliminación"}
                        </button>
                      </div>
                    </div>
                  ) : null}
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

        <SupplierRefundDialog
          open={isRefundDialogOpen}
          maximumAmountNio={Number(order.totalShortageLossNio ?? 0)}
          values={refundForm}
          error={refundMutationError}
          isPending={isSavingRefund}
          onChange={(field, value) =>
            setRefundForm((current) => ({ ...current, [field]: value }))
          }
          onSubmit={() => void saveSupplierRefund()}
          onClose={() => {
            if (!isSavingRefund) {
              setIsRefundDialogOpen(false);
              setRefundMutationError(null);
            }
          }}
        />
        <ConfirmDialog
          open={isDeclineRefundConfirmationOpen}
          title="Marcar como pérdida"
          description="Esta decisión es definitiva. El faltante quedará registrado como pérdida y no se podrá solicitar un reembolso después."
          confirmLabel="Marcar como pérdida"
          error={refundMutationError}
          isPending={isDecliningRefund}
          onConfirm={() => void declineSupplierRefund()}
          onClose={() => {
            if (!isDecliningRefund) setIsDeclineRefundConfirmationOpen(false);
          }}
        />

        <ConfirmDialog
          open={isShortageConfirmationOpen}
          title="Cerrar con faltantes"
          description={`Esta es una decisión definitiva. Todas las cantidades pendientes se registrarán como faltantes: ${pendingShortageUnits} unidades y no podrán recibirse después.`}
          confirmLabel="Cerrar con faltantes"
          error={shortageMutationError}
          isPending={isClosingShortages}
          onConfirm={() => void closeShortages()}
          onClose={() => {
            if (!isClosingShortages) setIsShortageConfirmationOpen(false);
          }}
        />
      </div>
    </div>
  );
}
function SupplierRefundDialog({
  open,
  maximumAmountNio,
  values,
  error,
  isPending,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  maximumAmountNio: number;
  values: SupplierRefundFormValues;
  error: string | null;
  isPending: boolean;
  onChange: (field: keyof SupplierRefundFormValues, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-pw-ink/45 p-4" role="presentation">
      <div
        className="w-full max-w-lg rounded-xl border border-pw-line bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-refund-dialog-title"
      >
        <h2 id="supplier-refund-dialog-title" className="text-xl font-extrabold">
          Registrar reembolso
        </h2>
        <p className="mt-2 text-sm text-pw-muted">
          Registra el monto que devolvió el proveedor. El máximo permitido es {formatCordobas(maximumAmountNio)}.
        </p>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="grid gap-1 text-sm font-bold" htmlFor="supplier-refund-amount">
            Monto del reembolso (C$)
            <input
              id="supplier-refund-amount"
              className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-semibold tabular-nums focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
              type="number"
              min="0.01"
              max={maximumAmountNio}
              step="0.01"
              value={values.amountNio}
              onChange={(event) => onChange("amountNio", event.target.value)}
              disabled={isPending}
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-bold" htmlFor="supplier-refund-reference">
            Referencia <span className="font-normal text-pw-muted">(opcional)</span>
            <input
              id="supplier-refund-reference"
              className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-semibold focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
              value={values.reference}
              onChange={(event) => onChange("reference", event.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold" htmlFor="supplier-refund-comments">
            Comentarios <span className="font-normal text-pw-muted">(opcional)</span>
            <textarea
              id="supplier-refund-comments"
              className="min-h-24 rounded-lg border border-pw-line bg-white px-3 py-2 font-semibold focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
              value={values.comments}
              onChange={(event) => onChange("comments", event.target.value)}
              disabled={isPending}
            />
          </label>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-lg border border-pw-line px-4 font-bold hover:bg-pw-canvas disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              className="min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isPending}
            >
              {isPending ? "Registrando…" : "Registrar reembolso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function ReceiptMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-extrabold text-pw-muted">{label}</dt>
      <dd className="mt-1 font-extrabold tabular-nums text-pw-ink">{value}</dd>
    </div>
  );
}

function DetailField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
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

function SummaryCostRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs font-extrabold text-pw-muted">{label}</dt>
      <dd
        className={
          emphasis
            ? "text-base font-black text-pw-brand-deep tabular-nums"
            : "font-extrabold text-pw-ink tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
