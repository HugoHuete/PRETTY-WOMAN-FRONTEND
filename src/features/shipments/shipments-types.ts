import type { SaleDeliveryAction } from "../sales/sales-types";

export type Shipment = {
  id: number;
  saleId: number;
  createdAt: string;
  code: string;
  deliveryStatusId: number;
  deliveryStatusName: string | null;
  deliveryAgencyId: number;
  deliveryAgencyName: string | null;
  municipalityId: number;
  municipalityName: string | null;
  clientId: number | null;
  clientName: string | null;
  clientPhone: string | null;
  clientInstagramUser: string | null;
  clientMessengerUser: string | null;
  amountToCollect: number;
  shippingChargedToClient: number;
  shippingPaidToAgency: number;
  deliveryAddress: string | null;
  comments: string | null;
};

export type ShipmentFilters = {
  page: number;
  pageSize: number;
  clientSearch: string;
  date: string;
  deliveryStatusId: string;
  deliveryAgencyId: string;
};

export type ShipmentAction = Extract<SaleDeliveryAction, "send" | "complete" | "delivered-pending-selection" | "fail" | "cancel">;

export type PendingReconciliationDelivery = {
  saleDeliveryId: number;
  code: string;
  createdAt: string;
  deliveryStatusId: number;
  deliveryStatusName: string | null;
  deliveryAgencyId: number;
  deliveryAgencyName: string | null;
  saleId: number;
  saleTotal: number;
  clientId: number | null;
  clientName: string | null;
  deliveryAddress: string | null;
  amountToCollect: number;
  shippingChargedToClient: number;
};

export type PendingPostSaleDelivery = {
  id: number;
  saleReturnId: number | null;
  saleExchangeId: number | null;
  saleId: number;
  deliveryAgencyId: number;
  deliveryAgencyName: string | null;
  statusId: number;
  statusName: string;
  code: string | null;
  clientName: string | null;
  shippingChargedToClient: number;
  shippingPaidToAgency: number;
  amountToCollect: number;
  createdAt: string;
};

export type CreateShipmentReconciliationPayload = {
  deliveryAgencyId: number;
  reconciliationDate?: string;
  settlementExchangeRate: number;
  comments?: string;
  deliveries: {
    saleDeliveryId: number;
    amountCollectedNio: number;
    amountCollectedUsd: number;
    changeGivenNio: number;
    collectionExchangeRate?: number;
    shippingPaidToAgency: number;
  }[];
  postSaleDeliveries: {
    postSaleDeliveryId: number;
    amountCollectedNio: number;
    amountCollectedUsd: number;
    changeGivenNio: number;
    shippingPaidToAgency: number;
    collectionExchangeRate?: number;
  }[];
};
