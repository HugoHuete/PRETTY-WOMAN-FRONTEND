import type { ProductDTO, PaginatedProducts } from "../products/product-types";
import type { ClientRecord } from "../clients/clients-page";
import type {
  ClientSearch,
  CreateSaleClientPayload,
  CreateSaleExchangePayload,
  CreateSaleExchangeSettlementPayload,
  CreateSalePayload,
  CreateSaleReturnPayload,
  PaginatedResult,
  ProductSearch,
  SaleRecord,
  SalesFilters,
} from "./sales-types";
import type {
  CreateSaleDeliveryPayload,
  CreateSalePaymentMovementPayload,
  CreateSaleSelectionProductPayload,
  PatchSaleDeliveryPayload,
  PatchSaleHeaderPayload,
  RefundSalePaymentMovementPayload,
  ReplaceSaleProductsPayload,
  ResolveSelectionHoldPayload,
  SaleDeliveryAction,
  SaleDeliveryAgency,
  SaleDetail,
  SaleExchange,
  SaleExchangeSettlement,
  SaleMunicipality,
  SaleReturn,
  ProcessSaleReturnPayload,
  ReceiveSaleReturnPayload,
  UpdateSalePaymentMovementPayload,
} from "./sales-types";

export type AuthRequest = (path: string, init?: RequestInit) => Promise<Response>;

export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.name = "ApiRequestError"; this.status = status; }
}

type ClientResponse = ClientRecord & {
  phoneNumber?: string | null;
  instagramUser?: string | null;
  messengerUser?: string | null;
};

function normalizeClient(client: ClientResponse): ClientRecord {
  return {
    ...client,
    phone: client.phone ?? client.phoneNumber,
    instagram: client.instagram ?? client.instagramUser,
    messenger: client.messenger ?? client.messengerUser,
  };
}

async function responseError(response: Response, fallback: string) {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };
    return problem.detail ?? problem.title ?? fallback;
  } catch {
    return fallback;
  }
}

async function requestJson<T>(request: AuthRequest, path: string, init?: RequestInit): Promise<T> {
  const response = init ? await request(path, init) : await request(path);
  if (!response.ok) throw new ApiRequestError(await responseError(response, "No se pudo completar la solicitud."), response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && String(value).length > 0) params.set(key, String(value));
  }
  return params.toString();
}

function localDayBoundary(value: string, end: boolean) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const boundary = new Date(year, month - 1, day + (end ? 1 : 0));
  if (!end) return boundary.toISOString();
  boundary.setMilliseconds(boundary.getMilliseconds() - 1);
  return boundary.toISOString().replace(/\.(\d{3})Z$/, (_match, milliseconds: string) => `.${milliseconds}9999Z`);
}

export async function getSales(request: AuthRequest, filters: SalesFilters) {
  const query = queryString({
    page: filters.page,
    pageSize: filters.pageSize,
    startDate: filters.startDate ? localDayBoundary(filters.startDate, false) : undefined,
    endDate: filters.endDate ? localDayBoundary(filters.endDate, true) : undefined,
    saleStatusId: filters.saleStatusId,
    salePaymentStatusId: filters.salePaymentStatusId,
    saleChannelId: filters.saleChannelId,
  });
  const result = await requestJson<PaginatedResult<SaleRecord>>(request, `/api/v1/sales?${query}`);
  return normalizePage(result);
}

export async function getSaleProducts(request: AuthRequest, search: ProductSearch) {
  const query = queryString({
    page: search.page,
    pageSize: search.pageSize,
    availability: 1,
    code: search.code,
  });
  const result = await requestJson<PaginatedProducts>(request, `/api/v1/products?${query}`);
  return normalizePage<ProductDTO>(result);
}

export async function getSaleClients(request: AuthRequest, search: ClientSearch) {
  const query = queryString({
    page: search.page,
    pageSize: search.pageSize,
    name: search.name,
    phoneNumber: search.phoneNumber,
    instagramUser: search.instagramUser,
    messengerUser: search.messengerUser,
  });
  const result = await requestJson<PaginatedResult<ClientResponse>>(request, `/api/v1/clients?${query}`);
  const page = normalizePage<ClientResponse>(result);
  return { ...page, items: page.items.map(normalizeClient) };
}

export async function createSale(request: AuthRequest, payload: CreateSalePayload) {
  return requestJson<number>(request, "/api/v1/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createSaleClient(request: AuthRequest, payload: CreateSaleClientPayload) {
  return requestJson<number>(request, "/api/v1/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getSaleClient(request: AuthRequest, id: number) {
  const client = await requestJson<ClientResponse>(request, `/api/v1/clients/${id}`);
  return normalizeClient(client);
}

export async function getSalePaymentTerminals(request: AuthRequest) {
  const terminals = await requestJson<Array<{ id: number; name: string; enabled: boolean }>>(
    request,
    "/api/v1/paymentterminals",
  );
  return terminals.filter((terminal) => terminal.enabled);
}

function normalizePage<T>(result: PaginatedResult<T> | PaginatedProducts): PaginatedResult<T> {
  const page = result.page ?? 1;
  const pageSize = result.pageSize ?? result.items.length;
  const totalCount = result.totalCount ?? result.items.length;
  const totalPages = result.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items: result.items as T[],
    page,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: result.hasPreviousPage ?? page > 1,
    hasNextPage: result.hasNextPage ?? page < totalPages,
  };
}

export async function getSale(request: AuthRequest, id: number) {
  return requestJson<SaleDetail>(request, `/api/v1/sales/${id}`);
}
async function sendSaleCommand(request: AuthRequest, path: string, method: string, body?: unknown) {
  return requestJson<void>(request, path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
export function cancelSale(request: AuthRequest, id: number) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/cancel`, "POST");
}
export function patchSaleHeader(request: AuthRequest, id: number, payload: PatchSaleHeaderPayload) {
  return sendSaleCommand(request, `/api/v1/sales/${id}`, "PATCH", payload);
}
export function replaceSaleProducts(request: AuthRequest, id: number, payload: ReplaceSaleProductsPayload) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/products`, "PUT", payload);
}
export function addSalePayment(request: AuthRequest, id: number, payload: CreateSalePaymentMovementPayload) {
  return requestJson<number>(request, `/api/v1/sales/${id}/payment-movements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export function updateSalePayment(request: AuthRequest, id: number, movementId: number, payload: UpdateSalePaymentMovementPayload) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/payment-movements/${movementId}`, "PATCH", payload);
}
export function refundSalePayment(request: AuthRequest, id: number, movementId: number, payload: RefundSalePaymentMovementPayload) {
  return requestJson<number>(request, `/api/v1/sales/${id}/payment-movements/${movementId}/refunds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export function createSaleDelivery(request: AuthRequest, id: number, payload: CreateSaleDeliveryPayload) {
  return requestJson<number>(request, `/api/v1/sales/${id}/deliveries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export async function getSaleMunicipalities(request: AuthRequest) {
  return requestJson<SaleMunicipality[]>(request, "/api/v1/municipalities");
}
export async function getSaleDeliveryAgencies(request: AuthRequest) {
  const agencies = await requestJson<SaleDeliveryAgency[]>(request, "/api/v1/deliveryagencies");
  return agencies.filter((agency) => agency.enabled);
}
export function updateSaleDelivery(request: AuthRequest, id: number, deliveryId: number, payload: PatchSaleDeliveryPayload) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/deliveries/${deliveryId}`, "PATCH", payload);
}
export function runSaleDeliveryAction(request: AuthRequest, id: number, deliveryId: number, action: SaleDeliveryAction) {
  const paths: Record<SaleDeliveryAction, string> = {
    send: "send",
    "delivered-pending-selection": "delivered-pending-selection",
    complete: "complete",
    fail: "fail",
    cancel: "cancel",
  };
  return sendSaleCommand(request, `/api/v1/sales/${id}/deliveries/${deliveryId}/${paths[action]}`, "POST");
}
export function addSaleSelectionHolds(request: AuthRequest, id: number, payload: CreateSaleSelectionProductPayload[]) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/selection-holds`, "POST", payload);
}
export function resolveSaleSelectionHold(request: AuthRequest, id: number, holdId: number, payload: ResolveSelectionHoldPayload) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/selection-holds/${holdId}/resolve`, "POST", payload);
}
export function returnSaleSelectionHold(request: AuthRequest, id: number, holdId: number) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/selection-holds/${holdId}/return`, "POST");
}

export function undoSaleSelectionHoldResolution(request: AuthRequest, id: number, holdId: number) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/selection-holds/${holdId}/undo-resolution`, "POST");
}

export function getSaleExchanges(request: AuthRequest, id: number) {
  return requestJson<SaleExchange[]>(request, `/api/v1/sales/${id}/exchanges`);
}
export function createSaleExchange(request: AuthRequest, id: number, payload: CreateSaleExchangePayload) {
  return requestJson<number>(request, `/api/v1/sales/${id}/exchanges`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
export function settleSaleExchange(request: AuthRequest, id: number, exchangeId: number, payload: CreateSaleExchangeSettlementPayload) {
  return requestJson<SaleExchangeSettlement>(request, `/api/v1/sales/${id}/exchanges/${exchangeId}/settlement`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
export function completeSaleExchangeHandover(request: AuthRequest, id: number, exchangeId: number) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/exchanges/${exchangeId}/handover`, "POST");
}
export function receiveSaleExchangeReturnItem(request: AuthRequest, id: number, exchangeId: number, returnItemId: number) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/exchanges/${exchangeId}/return-items/${returnItemId}/received`, "POST");
}
export function cancelSaleExchange(request: AuthRequest, id: number, exchangeId: number) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/exchanges/${exchangeId}/cancel`, "POST");
}
export function getSaleReturns(request: AuthRequest, id: number) {
  return requestJson<SaleReturn[]>(request, `/api/v1/sales/${id}/returns`);
}
export function createSaleReturn(request: AuthRequest, id: number, payload: CreateSaleReturnPayload) {
  return requestJson<number>(request, `/api/v1/sales/${id}/returns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
export function registerSaleReturnPickup(request: AuthRequest, id: number, returnId: number, payload: ProcessSaleReturnPayload) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/returns/${returnId}/pickup`, "POST", payload);
}
export function receiveSaleReturn(request: AuthRequest, id: number, returnId: number, payload: ReceiveSaleReturnPayload) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/returns/${returnId}/receive`, "POST", payload);
}
export function cancelSaleReturn(request: AuthRequest, id: number, returnId: number) {
  return sendSaleCommand(request, `/api/v1/sales/${id}/returns/${returnId}/cancel`, "POST");
}

export async function getSaleProductCatalog(request: AuthRequest) {
  const pageSize = 100;
  const firstQuery = new URLSearchParams({ page: "1", pageSize: String(pageSize) });
  const first = normalizePage<ProductDTO>(await requestJson<PaginatedProducts>(request, `/api/v1/products?${firstQuery}`));
  if (first.totalPages <= 1) return first.items;
  const pages = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => {
    const query = new URLSearchParams({ page: String(index + 2), pageSize: String(pageSize) });
    return requestJson<PaginatedProducts>(request, `/api/v1/products?${query}`).then((result) => normalizePage<ProductDTO>(result).items);
  }));
  return [...first.items, ...pages.flat()];
}
