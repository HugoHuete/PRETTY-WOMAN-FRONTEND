export type OrderFilters = {
  page: number;
  pageSize: number;
  purchaseDateFrom: string;
  purchaseDateTo: string;
  orderStatusId: string;
  supplierId: string;
};

export type TrackingNumberFilters = {
  page: number;
  pageSize: number;
  isReceived: string;
  trackingNumber: string;
  shippingCompanyId: string;
  orderStatusId: string;
  purchaseDateFrom: string;
  purchaseDateTo: string;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type OrderStatusDTO = {
  id: number;
  name: string;
};

export type SupplierDTO = {
  id: number;
  name: string;
  enabled: boolean;
  url: string | null;
  isNational: boolean;
};

export type ShippingCompanyDTO = {
  id: number;
  name: string;
  url: string | null;
};

export type OrderTrackingNumberDTO = {
  id: number;
  orderId: number;
  shippingCompanyId: number;
  trackingNumber: string;
  supplierShipmentDate: string | null;
  warehouseDeliveryDate: string | null;
  productReceiptId: number | null;
  receiptId?: number | null;
  weight: number;
  shippingCost: number;
  shippingCompanyName: string | null;
};

export type OrderReceiptSummaryDTO = {
  id: number;
  orderId: number;
  receivedDate: string;
  createdAt: string;
  warehouseShippingCostUsd: number;
  warehouseShippingCostNio: number;
  productCount: number;
  totalQuantity: number;
  trackingCount: number;
};

export type OrderReceiptProductDTO = {
  productReceiptDetailId: number;
  productId: number;
  quantity: number;
  isSurplus: boolean;
  weight: number;
  allocatedWarehouseShippingCostNio: number;
};

export type OrderReceiptDTO = {
  id: number;
  orderId: number;
  receivedDate: string;
  createdAt: string;
  warehouseShippingCostUsd: number;
  warehouseShippingCostNio: number;
  orderStatusId: number;
  productVariants: OrderReceiptProductDTO[];
  trackingNumberIds: number[];
  trackingNumbers: OrderTrackingNumberDTO[];
};

export type OrderProductVariantDTO = {
  id: number;
  sizeId: number;
  sizeName: string | null;
  quantity: number;
  receivedQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  unitCostUsd: number;
  merchandiseTotalCostNio: number;
  allocatedShippingCostNio: number;
  totalCostNio: number;
  unitCostNio: number;
  salePrice: number | null;
};

export type OrderProductPresentationDTO = {
  id: number;
  name: string | null;
  sortOrder: number;
  sizes: OrderProductVariantDTO[];
};

export type OrderProductDTO = {
  id: number;
  supplierProductCode: string;
  code: number;
  name: string;
  subcategoryId: number;
  subcategoryName: string | null;
  presentations: OrderProductPresentationDTO[];
};

export type PurchaseShortageDTO = {
  id: number;
  productId: number;
  quantity: number;
  lossAmountNio: number;
  shortageDate: string;
  refundStatus: number;
};

export type SupplierRefundDTO = {
  id: number;
  financialMovementId: number;
  amountNio: number;
  refundedAt: string;
  reference: string | null;
  comments: string | null;
};

export type OrderDTO = {
  id: number;
  createdAt: string;
  purchaseDate: string;
  orderStatusId: number;
  orderStatusName: string | null;
  supplierId: number;
  supplierName: string | null;
  purchaseCurrencyId: number;
  purchaseCurrencyName: string | null;
  amountUsd: number;
  receivedAmountNio: number;
  comments: string | null;
  merchandiseTotalNio: number;
  supplierShippingCostUsd: number;
  warehouseShippingCostUsd: number;
  totalCostNio: number;

  exchangeRate: number;
  products: OrderProductDTO[];
  purchaseShortages: PurchaseShortageDTO[];
  supplierRefund: SupplierRefundDTO | null;
  totalShortageLossNio: number | null;
  totalSupplierRefundNio: number | null;
  netShortageLossNio: number | null;
  supplierRefundDeclinedAt: string | null;
  supplierRefundDeclineComments: string | null;
};

const orderStatusTones: Record<
  number,
  "neutral" | "warning" | "success" | "danger"
> = {
  1: "neutral",
  2: "warning",
  3: "success",
  4: "danger",
  5: "danger",
};

const orderStatusLabels: Record<number, string> = {
  1: "Pendiente",
  2: "Recepción parcial",
  3: "Recibida",
  4: "Cancelada",
  5: "Reembolso pendiente",
};

export function buildOrdersPath(filters: OrderFilters): string {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  if (filters.purchaseDateFrom.trim()) {
    params.set("purchaseDateFrom", filters.purchaseDateFrom.trim());
  }

  if (filters.purchaseDateTo.trim()) {
    params.set("purchaseDateTo", filters.purchaseDateTo.trim());
  }

  if (filters.orderStatusId.trim()) {
    params.set("orderStatusId", filters.orderStatusId.trim());
  }

  if (filters.supplierId.trim()) {
    params.set("supplierId", filters.supplierId.trim());
  }

  const query = params.toString();
  return query ? `/api/v1/orders?${query}` : "/api/v1/orders";
}

export function orderStatusTone(
  statusId: number,
): "neutral" | "warning" | "success" | "danger" {
  return orderStatusTones[statusId] ?? "neutral";
}

export function orderStatusLabel(
  statusId: number,
  statusName: string | null = null,
): string {
  return orderStatusLabels[statusId] ?? statusName ?? "Estado sin definir";
}

export function formatCordobas(value: number): string {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(value);
}
export function buildTrackingNumbersPath(
  filters: TrackingNumberFilters,
): string {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  if (filters.isReceived.trim()) {
    params.set("isReceived", filters.isReceived.trim());
  }

  if (filters.trackingNumber.trim()) {
    params.set("trackingNumber", filters.trackingNumber.trim());
  }

  if (filters.shippingCompanyId.trim()) {
    params.set("shippingCompanyId", filters.shippingCompanyId.trim());
  }

  if (filters.orderStatusId.trim()) {
    params.set("orderStatusId", filters.orderStatusId.trim());
  }

  if (filters.purchaseDateFrom.trim()) {
    params.set("purchaseDateFrom", filters.purchaseDateFrom.trim());
  }

  if (filters.purchaseDateTo.trim()) {
    params.set("purchaseDateTo", filters.purchaseDateTo.trim());
  }

  const query = params.toString();
  return query
    ? `/api/v1/tracking-numbers?${query}`
    : "/api/v1/tracking-numbers";
}

