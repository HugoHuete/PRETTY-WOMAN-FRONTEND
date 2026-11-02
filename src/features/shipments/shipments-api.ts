import { ApiRequestError, type AuthRequest } from "../sales/sales-api";
import type { PaginatedResult, SaleDeliveryAgency } from "../sales/sales-types";
import type {
  CreateShipmentReconciliationPayload,
  PendingReconciliationDelivery,
  PendingReconciliationReturn,
  Shipment,
  ShipmentFilters,
} from "./shipments-types";

async function responseError(response: Response) {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };
    return problem.detail ?? problem.title ?? "No se pudo completar la solicitud.";
  } catch {
    return "No se pudo completar la solicitud.";
  }
}

function normalizePage<T>(result: PaginatedResult<T>): PaginatedResult<T> {
  const page = result.page ?? 1;
  const pageSize = result.pageSize ?? result.items.length;
  const totalCount = result.totalCount ?? result.items.length;
  const totalPages = result.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items: result.items,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: result.hasPreviousPage ?? page > 1,
    hasNextPage: result.hasNextPage ?? page < totalPages,
  };
}

export async function getShipments(request: AuthRequest, filters: ShipmentFilters) {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) });
  if (filters.clientSearch) query.set("clientSearch", filters.clientSearch);
  if (filters.date) query.set("date", filters.date);
  if (filters.deliveryStatusId) query.set("deliveryStatusId", filters.deliveryStatusId);
  if (filters.deliveryAgencyId) query.set("deliveryAgencyId", filters.deliveryAgencyId);

  const response = await request(`/api/v1/sales/deliveries?${query}`);
  if (!response.ok) throw new ApiRequestError(await responseError(response), response.status);
  return normalizePage(await response.json() as PaginatedResult<Shipment>);
}

export async function getShipmentAgencies(request: AuthRequest) {
  const response = await request("/api/v1/deliveryagencies");
  if (!response.ok) throw new ApiRequestError(await responseError(response), response.status);
  return (await response.json() as SaleDeliveryAgency[]).filter((agency) => agency.enabled);
}

export async function getPendingReconciliationDeliveries(request: AuthRequest, deliveryAgencyId: number) {
  const query = new URLSearchParams({ deliveryAgencyId: String(deliveryAgencyId) });
  const response = await request(`/api/v1/deliveryagencyreconciliations/pending-deliveries?${query}`);
  if (!response.ok) throw new ApiRequestError(await responseError(response), response.status);
  return await response.json() as PendingReconciliationDelivery[];
}

export async function getPendingReconciliationReturns(request: AuthRequest, deliveryAgencyId: number) {
  const query = new URLSearchParams({ deliveryAgencyId: String(deliveryAgencyId) });
  const response = await request(`/api/v1/deliveryagencyreconciliations/pending-returns?${query}`);
  if (!response.ok) throw new ApiRequestError(await responseError(response), response.status);
  return await response.json() as PendingReconciliationReturn[];
}

export async function createShipmentReconciliation(request: AuthRequest, payload: CreateShipmentReconciliationPayload) {
  const response = await request("/api/v1/deliveryagencyreconciliations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new ApiRequestError(await responseError(response), response.status);
  return await response.json() as number;
}
