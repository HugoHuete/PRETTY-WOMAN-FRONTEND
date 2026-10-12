import {
  financeMovementMaxPageSize,
  financeMovementPageSize,
  type FinanceMovementFilters,
} from "./finance-types";

const validMovementDirections = new Set([1, 2]);

export function financeMovementFiltersFromSearchParams(params: URLSearchParams): FinanceMovementFilters {
  const page = Number(params.get("page"));
  const requestedPageSize = Number(params.get("pageSize"));
  const movementTypeId = Number(params.get("financialMovementTypeId"));
  const directionId = Number(params.get("movementDirectionId"));
  const fromDate = params.get("fromDate") ?? "";
  const toDate = params.get("toDate") ?? "";
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(requestedPageSize, financeMovementMaxPageSize) : financeMovementPageSize,
    fromDate: isDateFilter(fromDate) ? fromDate : "",
    toDate: isDateFilter(toDate) ? toDate : "",
    financialMovementTypeId: Number.isInteger(movementTypeId) && movementTypeId > 0 ? movementTypeId : null,
    movementDirectionId: validMovementDirections.has(directionId) ? directionId as FinanceMovementFilters["movementDirectionId"] : null,
  };
}

export function searchParamsFromFinanceMovementFilters(filters: FinanceMovementFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.financialMovementTypeId !== null) params.set("financialMovementTypeId", String(filters.financialMovementTypeId));
  if (filters.movementDirectionId !== null) params.set("movementDirectionId", String(filters.movementDirectionId));
  return params;
}

function isDateFilter(value: string) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
