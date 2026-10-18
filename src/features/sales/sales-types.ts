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
