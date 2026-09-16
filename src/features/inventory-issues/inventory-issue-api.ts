import {
  inventoryIssueStatusLabel,
  inventoryIssueStatusOptions,
  inventoryIssueStatusTone,
  inventoryIssueTypeLabel,
  inventoryIssueTypeOptions,
  type InventoryIssue,
  type InventoryIssueFilters,
  type InventoryIssueStatus,
  type InventoryIssueType,
  type PaginatedInventoryIssues,
} from "./inventory-issue-types";
import type { ProductDTO } from "../products/product-types";

export type AuthenticatedRequest = (path: string, init?: RequestInit) => Promise<Response>;

type InventoryIssueApiDTO = {
  id: number;
  productId: number;
  productVariantId: number;
  productName: string | null;
  productCode: number | null;
  sizeName: string | null;
  variant: string | null;
  productInventoryIssueTypeId: number;
  productInventoryIssueTypeName: string | null;
  productInventoryIssueStatusId: number;
  productInventoryIssueStatusName: string | null;
  quantity: number;
  issueDate: string;
  resolvedAt: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type PaginatedInventoryIssueApiDTO = {
  items: InventoryIssueApiDTO[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
};

export class InventoryIssueApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "InventoryIssueApiError";
  }
}

export function buildInventoryIssuesPath(filters: InventoryIssueFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  if (filters.productCode.trim()) params.set("productCode", filters.productCode.trim());
  const type = inventoryIssueTypeOptions.find((option) => option.value === filters.type);
  if (type) params.set("productInventoryIssueTypeId", String(type.id));
  const status = inventoryIssueStatusOptions.find((option) => option.value === filters.status);
  if (status) params.set("productInventoryIssueStatusId", String(status.id));
  return `/api/v1/product-inventory-issues?${params.toString()}`;
}

export async function problemDetail(response: Response, fallback: string) {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };
    if (problem && typeof problem === "object") return problem.detail ?? problem.title ?? fallback;
  } catch {
    // El fallback cubre respuestas no JSON.
  }
  return fallback;
}

export async function loadInventoryIssues(request: AuthenticatedRequest, filters: InventoryIssueFilters): Promise<PaginatedInventoryIssues> {
  const response = await request(buildInventoryIssuesPath(filters));
  if (!response.ok) throw new InventoryIssueApiError(response.status, await problemDetail(response, "No se pudieron cargar las incidencias."));
  const result = (await response.json()) as PaginatedInventoryIssueApiDTO;
  return {
    items: result.items.map(mapInventoryIssue),
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
    totalPages: result.totalPages ?? Math.max(1, Math.ceil(result.totalCount / result.pageSize)),
    hasPreviousPage: result.hasPreviousPage ?? result.page > 1,
    hasNextPage: result.hasNextPage ?? result.page < (result.totalPages ?? 1),
  };
}


export type CreateInventoryIssuePayload = {
  productId: number;
  productInventoryIssueTypeId: number;
  quantity: number;
  issueDate?: string;
  comments?: string;
};

type ProductSearchResult = { items: ProductDTO[] };

export async function searchProductsByCode(request: AuthenticatedRequest, productCode: string) {
  const params = new URLSearchParams({ page: "1", pageSize: "20", code: productCode.trim(), availability: "1" });
  const response = await request("/api/v1/products?" + params.toString());
  if (!response.ok) throw new InventoryIssueApiError(response.status, await problemDetail(response, "No se pudo buscar el producto."));
  const result = (await response.json()) as ProductSearchResult;
  return result.items;
}

export async function createInventoryIssue(request: AuthenticatedRequest, payload: CreateInventoryIssuePayload) {
  const response = await request("/api/v1/product-inventory-issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new InventoryIssueApiError(response.status, await problemDetail(response, "No se pudo crear la incidencia."));
  return (await response.json()) as number;
}export async function loadInventoryIssue(request: AuthenticatedRequest, id: string): Promise<InventoryIssue> {
  const response = await request(`/api/v1/product-inventory-issues/${encodeURIComponent(id)}`);
  if (!response.ok) throw new InventoryIssueApiError(response.status, await problemDetail(response, "No se pudo cargar la incidencia."));
  return mapInventoryIssue((await response.json()) as InventoryIssueApiDTO);
}

export function mapInventoryIssue(dto: InventoryIssueApiDTO): InventoryIssue {
  const type = normalizeType(dto.productInventoryIssueTypeId, dto.productInventoryIssueTypeName);
  const status = normalizeStatus(dto.productInventoryIssueStatusId, dto.productInventoryIssueStatusName);
  return {
    id: dto.id,
    productId: dto.productId,
    productVariantId: dto.productVariantId,
    productName: dto.productName,
    productCode: dto.productCode,
    sizeName: dto.sizeName,
    variantName: dto.variant,
    type,
    typeName: inventoryIssueTypeLabel(type),
    status,
    statusName: inventoryIssueStatusLabel(status),
    quantity: dto.quantity,
    reportedAt: dto.issueDate,
    resolvedAt: dto.resolvedAt,
    comments: dto.comments,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    availabilityImpact: availabilityImpact(status),
  };
}

function normalizeType(id: number, name: string | null): InventoryIssueType {
  const byId = inventoryIssueTypeOptions.find((option) => option.id === id);
  if (byId) return byId.value;
  const normalized = name?.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  return inventoryIssueTypeOptions.find((option) => option.value === normalized)?.value ?? "under-review";
}

function normalizeStatus(id: number, name: string | null): InventoryIssueStatus {
  const byId = inventoryIssueStatusOptions.find((option) => option.id === id);
  if (byId) return byId.value;
  const normalized = name?.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  return inventoryIssueStatusOptions.find((option) => option.value === normalized)?.value ?? "open";
}

function availabilityImpact(status: InventoryIssueStatus) {
  if (status === "open") return "No disponible";
  if (status === "resolved" || status === "cancelled") return "Disponible nuevamente";
  return "Fuera de inventario";
}

export { inventoryIssueStatusTone };
