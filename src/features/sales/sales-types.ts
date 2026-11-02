import type { ClientRecord } from "../clients/clients-page";

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type SaleRecord = {
  id: number;
  saleDate: string;
  saleChannelId: number;
  saleChannelName: string | null;
  saleStatusId: number;
  saleStatusName: string | null;
  salePaymentStatusId: number;
  salePaymentStatusName: string | null;
  subtotal: number;
  totalDiscount: number;
  total: number;
  clientId: number | null;
  clientName: string | null;
  latestDeliveryStatusId: number | null;
  latestDeliveryStatusName: string | null;
  hasPendingSelection: boolean;
};

export type SalesFilters = {
  page: number;
  pageSize: number;
  startDate: string;
  endDate: string;
  saleStatusId: string;
  salePaymentStatusId: string;
  saleChannelId: string;
};

export type ProductSearch = {
  page: number;
  pageSize: number;
  code: string;
};

export type ClientSearch = {
  page: number;
  pageSize: number;
  name: string;
  phoneNumber: string;
  instagramUser: string;
  messengerUser: string;
};

export type CreateSaleProductPayload = {
  productId: number;
  quantity: number;
  discountAmount: number;
  discountSourceId: number;
  discountCampaignId?: number;
};

export type CreateSalePaymentPayload = {
  paymentMethodId: number;
  paymentTerminalId?: number;
  productAmount: number;
  shippingAmount: number;
  amountReceivedNio: number;
  amountReceivedUsd: number;
  changeGivenNio: number;
  exchangeRate?: number;
};

export type CreateSalePayload = {
  saleChannelId: number;
  saleStatusId: 1;
  clientId?: number;
  comments?: string;
  productVariants: CreateSaleProductPayload[];
  selectionProducts?: Array<{ productId: number; quantity: number; comments?: string }>;
  paymentMovements?: CreateSalePaymentPayload[];
};

export type CreateSaleClientPayload = {
  name: string;
  phoneNumber: string;
  instagramUser?: string;
  messengerUser?: string;
  address?: string;
};

export type SaleCatalogOption = { id: number; name: string };

export const saleChannels: readonly SaleCatalogOption[] = [
  { id: 1, name: "Tienda física" },
  { id: 2, name: "WhatsApp" },
  { id: 3, name: "Instagram" },
  { id: 4, name: "Messenger" },
  { id: 5, name: "Otro" },
];

export const saleStatuses: readonly SaleCatalogOption[] = [
  { id: 1, name: "Pendiente" },
  { id: 2, name: "Reservada" },
  { id: 3, name: "Lista para entrega" },
  { id: 4, name: "Enviada" },
  { id: 5, name: "Completada" },
  { id: 6, name: "Cancelada" },
];

export const paymentStatuses: readonly SaleCatalogOption[] = [
  { id: 1, name: "Sin pagar" },
  { id: 2, name: "Pago parcial" },
  { id: 3, name: "Pagada" },
  { id: 4, name: "Reembolso pendiente" },
];

export function saleCatalogLabel(id: number, catalog: readonly SaleCatalogOption[], fallback: string | null) {
  return catalog.find((option) => option.id === id)?.name ?? fallback ?? "—";
}

export const salePaymentMethods: readonly SaleCatalogOption[] = [
  { id: 1, name: "Efectivo" },
  { id: 2, name: "Transferencia" },
  { id: 3, name: "Tarjeta" },
];

export const discountSourceIds = {
  none: 1,
  campaign: 2,
  manual: 3,
  employee: 4,
} as const;

export type SaleClient = Pick<ClientRecord, "id" | "name" | "phone" | "instagram" | "messenger">;

export type SaleProductLine = {
  id: number;
  productId: number;
  quantity: number;
  unitCostAtSale: number;
  originalUnitPrice: number;
  discountSourceId: number;
  discountSourceName: string | null;
  discountCampaignId: number | null;
  discountAmount: number;
  finalUnitPrice: number;
  lineTotal: number;
  totalCostAtSale: number;
  grossProfit: number;
};

export type SaleSelectionHold = {
  id: number;
  productId: number;
  quantity: number;
  productHoldStatusId: number;
  productHoldStatusName: string | null;
  holdDate: string;
  resolvedAt: string | null;
  comments: string | null;
};

export type SalePaymentMovement = {
  id: number;
  movementDate: string;
  movementDirectionId: number;
  paymentMethodId: number;
  paymentMethodName: string | null;
  paymentTerminalId: number | null;
  paymentTerminalName: string | null;
  reversedSalePaymentMovementId: number | null;
  grossAmount: number;
  productAmount: number;
  shippingAmount: number;
  saleDeliveryId: number | null;
  deliveryAgencyReconciliationId: number | null;
  commissionPercentage: number;
  commissionAmount: number;
  incomeTaxPercentage: number;
  incomeTaxAmount: number;
  netReceivedAmount: number;
  amountReceivedNio: number;
  amountReceivedUsd: number;
  changeGivenNio: number;
  exchangeRate: number | null;
  exchangeDifferenceNio: number;
};

export type SaleDelivery = {
  id: number;
  createdAt: string;
  code: string;
  municipalityId: number;
  municipalityName: string | null;
  deliveryAgencyId: number;
  deliveryAgencyName: string | null;
  deliveryAgencyCanCollectCashOnDelivery: boolean;
  deliveryStatusId: number;
  deliveryStatusName: string | null;
  clientId: number | null;
  amountToCollect: number;
  amountCollectedNio: number;
  amountCollectedUsd: number;
  changeGivenNio: number;
  collectionExchangeRate: number | null;
  shippingChargedToClient: number;
  shippingPaidToAgency: number;
  deliveryAddress: string | null;
  comments: string | null;
};

export type SaleDetail = SaleRecord & {
  userId: string;
  comments: string | null;
  municipalityId: number | null;
  municipalityName: string | null;
  totalShippingChargedToClient?: number;
  productVariants: SaleProductLine[];
  selectionHolds: SaleSelectionHold[];
  paymentMovements: SalePaymentMovement[];
  deliveries: SaleDelivery[];
};

export type PatchSaleHeaderPayload = {
  saleDate?: string;
  saleChannelId?: number;
  clientId?: number | null;
  comments?: string | null;
};

export type ReplaceSaleProductsPayload = {
  productVariants: Array<{
    saleProductId?: number;
    productId: number;
    quantity: number;
    discountAmount: number;
    discountSourceId: number;
    discountCampaignId?: number;
  }>;
};

export type CreateSalePaymentMovementPayload = {
  movementDate?: string;
  paymentMethodId: number;
  paymentTerminalId?: number;
  productAmount: number;
  shippingAmount: number;
  saleDeliveryId?: number;
  amountReceivedNio: number;
  amountReceivedUsd: number;
  changeGivenNio: number;
  exchangeRate?: number;
};

export type UpdateSalePaymentMovementPayload = {
  movementDate?: string | null;
  paymentMethodId?: number | null;
  paymentTerminalId?: number | null;
  productAmount?: number | null;
  shippingAmount?: number | null;
  saleDeliveryId?: number | null;
};

export type RefundSalePaymentMovementPayload = {
  movementDate?: string;
  paymentMethodId?: number;
  paymentTerminalId?: number;
  productAmount?: number;
  shippingAmount?: number;
};

export type CreateSaleDeliveryPayload = {
  code: string;
  municipalityId: number;
  deliveryAgencyId: number;
  clientId?: number;
  shippingChargedToClient: number;
  deliveryAddress?: string;
  comments?: string;
};

export type SaleMunicipality = {
  id: number;
  name: string;
  departmentId: number;
  departmentName: string;
};

export type SaleDeliveryAgency = {
  id: number;
  name: string;
  phoneNumber: string;
  enabled: boolean;
  canCollectCashOnDelivery: boolean;
};

export type PatchSaleDeliveryPayload = {
  clientId?: number | null;
  deliveryAddress?: string | null;
  deliveryAgencyId?: number;
  municipalityId?: number;
  code?: string;
  shippingChargedToClient?: number;
};

export type CreateSaleSelectionProductPayload = {
  productId: number;
  quantity: number;
  comments?: string;
};

export type ResolveSelectionHoldPayload = {
  selected: boolean;
  discountAmount?: number;
  discountSourceId?: number;
  discountCampaignId?: number;
  comments?: string;
};

export type SaleDeliveryAction =
  | "send"
  | "delivered-pending-selection"
  | "complete"
  | "fail"
  | "cancel";
