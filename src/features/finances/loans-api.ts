import {
  FinanceApiError,
  readFinanceApiError,
  type AuthenticatedRequest,
} from "./finance-api";
import {
  loanMaxPageSize,
  loanPageSize,
  type CreateLoanInput,
  type Loan,
  type LoanFilters,
  type LoanOwner,
  type LoanPaymentInput,
  type PaginatedLoans,
  type UpdateLoanInput,
} from "./loans-types";

type PaginatedLoansApiDTO = {
  items: Loan[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number | null;
  hasPreviousPage?: boolean | null;
  hasNextPage?: boolean | null;
};

export function buildLoansPath(filters: LoanFilters) {
  const page = Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  const pageSize = Number.isInteger(filters.pageSize) && filters.pageSize > 0
    ? Math.min(filters.pageSize, loanMaxPageSize)
    : loanPageSize;
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

  if (filters.loanOwnerId !== null) params.set("loanOwnerId", String(filters.loanOwnerId));
  if (filters.isActive !== null) params.set("isActive", String(filters.isActive));

  return `/api/v1/loans?${params.toString()}`;
}

async function readLoanResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await readFinanceApiError(response, fallback);
  return (await response.json()) as T;
}

export async function loadLoans(
  request: AuthenticatedRequest,
  filters: LoanFilters,
): Promise<PaginatedLoans> {
  const response = await request(buildLoansPath(filters));
  if (!response.ok) throw await readFinanceApiError(response, "No se pudieron cargar los préstamos.");

  const result = (await response.json()) as PaginatedLoansApiDTO;
  const totalPages = result.totalPages ?? Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  return {
    items: result.items,
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
    totalPages,
    hasPreviousPage: result.hasPreviousPage ?? result.page > 1,
    hasNextPage: result.hasNextPage ?? result.page < totalPages,
  };
}

export async function loadLoan(request: AuthenticatedRequest, id: number): Promise<Loan> {
  const response = await request(`/api/v1/loans/${id}`);
  return readLoanResponse(response, "No se pudo cargar el préstamo.");
}

export async function loadLoanOwners(request: AuthenticatedRequest): Promise<LoanOwner[]> {
  const response = await request("/api/v1/loanowners");
  return readLoanResponse(response, "No se pudieron cargar los responsables.");
}

export async function createLoan(request: AuthenticatedRequest, input: CreateLoanInput): Promise<Loan> {
  const response = await request("/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readLoanResponse(response, "No se pudo crear el préstamo.");
}

export async function updateLoan(
  request: AuthenticatedRequest,
  id: number,
  input: UpdateLoanInput,
): Promise<Loan> {
  const response = await request(`/api/v1/loans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readLoanResponse(response, "No se pudo actualizar el préstamo.");
}

export async function deleteLoan(request: AuthenticatedRequest, id: number): Promise<void> {
  const response = await request(`/api/v1/loans/${id}`, { method: "DELETE" });
  if (!response.ok) throw await readFinanceApiError(response, "No se pudo eliminar el préstamo.");
}

export async function createLoanPayment(
  request: AuthenticatedRequest,
  id: number,
  input: LoanPaymentInput,
): Promise<Loan> {
  const response = await request(`/api/v1/loans/${id}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readLoanResponse(response, "No se pudo registrar el pago.");
}

export async function updateLoanPayment(
  request: AuthenticatedRequest,
  id: number,
  paymentId: number,
  input: LoanPaymentInput,
): Promise<Loan> {
  const response = await request(`/api/v1/loans/${id}/payments/${paymentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readLoanResponse(response, "No se pudo actualizar el pago.");
}

export { FinanceApiError };
