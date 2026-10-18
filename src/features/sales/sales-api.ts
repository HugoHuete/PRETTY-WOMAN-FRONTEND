import type { ProductDTO, PaginatedProducts } from "../products/product-types";
import type { ClientRecord } from "../clients/clients-page";
import type {
  ClientSearch,
  CreateSaleClientPayload,
  CreateSalePayload,
  PaginatedResult,
  ProductSearch,
  SaleRecord,
  SalesFilters,
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
