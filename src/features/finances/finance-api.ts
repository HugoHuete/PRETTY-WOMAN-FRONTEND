import {
  financeMovementMaxPageSize,
  financeMovementPageSize,
  type FinanceMovementFilters,
  type FinancialMovement,
  type FinancialMovementType,
  type PaginatedFinanceMovements,
} from "./finance-types";

export type AuthenticatedRequest = (path: string, init?: RequestInit) => Promise<Response>;

type FinancialMovementApiDTO = {
  id: number;
  description: string;
  movementDate: string;
  createdAt: string;
  movementDirectionId: number;
  movementDirectionName: string | null;
  financialMovementTypeId: number;
  financialMovementTypeName: string | null;
  expenseCategoryId: number | null;
  orderId: number | null;
  salePaymentMovementId: number | null;
  deliveryAgencyReconciliationId: number | null;
  loanId: number | null;
  loanPaymentId: number | null;
  amount: number;
  exchangeRate: number;
  comments: string | null;
};

type FinancialMovementTypeApiDTO = {
  id: number;
  name: string;
};

type ExpenseCategoryApiDTO = {
  id: number;
  name: string;
};

export type CreateFinancialMovementInput = {
  description: string;
  movementDate?: string;
  financialMovementTypeId: number;
  movementDirectionId?: number;
  expenseCategoryId?: number;
  amount: number;
  comments?: string;
};

export type UpdateFinancialMovementInput = {
  description: string;
  movementDate?: string;
  financialMovementTypeId: number;
  movementDirectionId?: number | null;
  expenseCategoryId?: number | null;
  amount: number;
  comments?: string | null;
};

type PaginatedFinanceMovementsApiDTO = {
  items: FinancialMovementApiDTO[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number | null;
  hasPreviousPage?: boolean | null;
  hasNextPage?: boolean | null;
};

export class FinanceApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FinanceApiError";
    this.status = status;
  }
}

export function buildFinanceMovementsPath(filters: FinanceMovementFilters) {
  const page = Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  const pageSize = Number.isInteger(filters.pageSize) && filters.pageSize > 0
    ? Math.min(filters.pageSize, financeMovementMaxPageSize)
    : financeMovementPageSize;
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.financialMovementTypeId !== null) params.set("financialMovementTypeId", String(filters.financialMovementTypeId));
  if (filters.movementDirectionId !== null) params.set("movementDirectionId", String(filters.movementDirectionId));

  return `/api/v1/finances/movements?${params.toString()}`;
}

export async function readFinanceApiError(response: Response, fallback: string) {
  let message = fallback;
  try {
    const problem = (await response.json()) as { detail?: string; title?: string } | null;
    message = problem?.detail ?? problem?.title ?? fallback;
  } catch {
    // Respuestas no JSON conservan el mensaje genérico.
  }
  return new FinanceApiError(response.status, message);
}

export async function loadFinanceMovements(
  request: AuthenticatedRequest,
  filters: FinanceMovementFilters,
): Promise<PaginatedFinanceMovements> {
  const response = await request(buildFinanceMovementsPath(filters));
  if (!response.ok) throw await readFinanceApiError(response, "No se pudieron cargar los movimientos.");

  const result = (await response.json()) as PaginatedFinanceMovementsApiDTO;
  const totalPages = result.totalPages ?? Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  return {
    items: result.items.map(mapFinancialMovement),
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
    totalPages,
    hasPreviousPage: result.hasPreviousPage ?? result.page > 1,
    hasNextPage: result.hasNextPage ?? result.page < totalPages,
  };
}

export async function loadFinanceMovementTypes(
  request: AuthenticatedRequest,
): Promise<FinancialMovementType[]> {
  const response = await request("/api/v1/finances/movement-types");
  if (!response.ok) throw await readFinanceApiError(response, "No se pudieron cargar los tipos de movimiento.");

  const result = (await response.json()) as FinancialMovementTypeApiDTO[];
  return result.map(({ id, name }) => ({ id, name, label: financeMovementTypeLabel(id, name) }));
}

export async function loadExpenseCategories(
  request: AuthenticatedRequest,
): Promise<ExpenseCategoryApiDTO[]> {
  const response = await request("/api/v1/expensecategories");
  if (!response.ok) throw await readFinanceApiError(response, "No se pudieron cargar las categorías de gasto.");
  return (await response.json()) as ExpenseCategoryApiDTO[];
}

export async function createFinanceMovement(
  request: AuthenticatedRequest,
  input: CreateFinancialMovementInput,
): Promise<void> {
  const response = await request("/api/v1/finances/movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readFinanceApiError(response, "No se pudo registrar el movimiento.");
}

export async function updateFinanceMovement(
  request: AuthenticatedRequest,
  id: number,
  input: UpdateFinancialMovementInput,
): Promise<void> {
  const response = await request(`/api/v1/finances/movements/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readFinanceApiError(response, "No se pudo actualizar el movimiento.");
}

export async function deleteFinanceMovement(
  request: AuthenticatedRequest,
  id: number,
): Promise<void> {
  const response = await request(`/api/v1/finances/movements/${id}`, { method: "DELETE" });
  if (!response.ok) throw await readFinanceApiError(response, "No se pudo eliminar el movimiento.");
}

const movementTypeLabels: Record<string, string> = {
  OwnerInvestment: "Aporte de propietaria",
  SupplierPayment: "Pago a proveedor",
  SalePayment: "Pago de venta",
  Expense: "Gasto",
  OwnerWithdrawal: "Retiro de propietaria",
  SupplierRefund: "Reembolso de proveedor",
  CustomerRefund: "Reembolso a cliente",
  LoanReceived: "Préstamo recibido",
  LoanPayment: "Pago de préstamo",
  WarehouseShippingPayment: "Pago de envío a bodega",
  Adjustment: "Ajuste",
  DeliveryAgencyReconciliation: "Conciliación de agencia",
};

export function isManualFinancialMovementType(name: string) {
  return ["Expense", "OwnerInvestment", "OwnerWithdrawal", "Adjustment"].includes(name);
}

export function canManageFinanceMovementManually(movement: FinancialMovement) {
  const manualType = isManualFinancialMovementType(movement.financialMovementTypeName ?? "");
  return manualType
    && movement.orderId === null
    && movement.salePaymentMovementId === null
    && movement.deliveryAgencyReconciliationId === null
    && movement.loanId === null
    && movement.loanPaymentId === null;
}

export function mapFinancialMovement(dto: FinancialMovementApiDTO): FinancialMovement {
  const movement = {
    id: dto.id,
    description: dto.description,
    movementDate: dto.movementDate,
    createdAt: dto.createdAt,
    movementDirectionId: dto.movementDirectionId,
    movementDirectionName: dto.movementDirectionName,
    movementDirectionLabel: financeMovementDirectionLabel(dto.movementDirectionId),
    financialMovementTypeId: dto.financialMovementTypeId,
    financialMovementTypeName: dto.financialMovementTypeName,
    financialMovementTypeLabel: financeMovementTypeLabel(dto.financialMovementTypeId, dto.financialMovementTypeName),
    expenseCategoryId: dto.expenseCategoryId,
    orderId: dto.orderId,
    salePaymentMovementId: dto.salePaymentMovementId,
    deliveryAgencyReconciliationId: dto.deliveryAgencyReconciliationId,
    loanId: dto.loanId,
    loanPaymentId: dto.loanPaymentId,
    amount: dto.amount,
    exchangeRate: dto.exchangeRate,
    comments: dto.comments,
  };
  return { ...movement, originLabel: movementOriginLabel(movement) };
}

export function financeMovementTypeLabel(id: number, name: string | null = null) {
  return (name && movementTypeLabels[name]) ?? humanize(name) ?? `Tipo desconocido (${id})`;
}

export function financeMovementDirectionLabel(id: number) {
  if (id === 1) return "Ingreso";
  if (id === 2) return "Egreso";
  return `Dirección desconocida (${id})`;
}

export function movementOriginLabel(movement: Omit<FinancialMovement, "originLabel">) {
  if (movement.salePaymentMovementId !== null) return `Pago de venta #${movement.salePaymentMovementId}`;
  if (movement.deliveryAgencyReconciliationId !== null) return `Conciliación #${movement.deliveryAgencyReconciliationId}`;
  if (movement.loanPaymentId !== null) return `Pago de préstamo #${movement.loanPaymentId}`;
  if (movement.loanId !== null) return `Préstamo #${movement.loanId}`;
  if (movement.orderId !== null) return `Pedido #${movement.orderId}`;
  if (movement.expenseCategoryId !== null) return `Categoría #${movement.expenseCategoryId}`;
  if (isManualFinancialMovementType(movement.financialMovementTypeName ?? "")) return "Manual";
  return "—";
}

function humanize(name: string | null) {
  if (!name?.trim()) return null;
  const label = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return label.charAt(0).toLocaleUpperCase("es-NI") + label.slice(1);
}
