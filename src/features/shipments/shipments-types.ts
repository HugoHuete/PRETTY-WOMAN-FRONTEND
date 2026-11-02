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
