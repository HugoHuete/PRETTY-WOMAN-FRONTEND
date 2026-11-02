import type { SalesFilters } from "./sales-types";

export const salesPageSize = 20;

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localTodayDate(now = new Date()) {
  return localDateString(now);
}

export const defaultSalesFilters = (): SalesFilters => {
  const today = localTodayDate();
  return {
    page: 1,
    pageSize: salesPageSize,
    startDate: today,
    endDate: today,
    saleStatusId: "",
    salePaymentStatusId: "",
    saleChannelId: "",
  };
};

function positiveInteger(value: string | null, fallback: number, maximum?: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
}

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? value : "";
}

export function readSalesFilters(params: URLSearchParams): SalesFilters {
  const defaults = defaultSalesFilters();
  const readDate = (key: "startDate" | "endDate", fallback: string) => {
    if (!params.has(key)) return fallback;
    const value = params.get(key) ?? "";
    return value === "" ? "" : validDate(value) || fallback;
  };
  const startDate = readDate("startDate", defaults.startDate);
  const endDate = readDate("endDate", defaults.endDate);
  const pageSize = positiveInteger(params.get("pageSize"), defaults.pageSize, 100);

  return {
    page: positiveInteger(params.get("page"), defaults.page),
    pageSize,
    startDate,
    endDate: startDate && endDate && endDate < startDate ? startDate : endDate,
    saleStatusId: params.get("saleStatusId") ?? "",
    salePaymentStatusId: params.get("salePaymentStatusId") ?? "",
    saleChannelId: params.get("saleChannelId") ?? "",
  };
}

export function buildSalesSearchParams(filters: SalesFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  params.set("startDate", filters.startDate);
  params.set("endDate", filters.endDate);
  if (filters.saleStatusId) params.set("saleStatusId", filters.saleStatusId);
  if (filters.salePaymentStatusId) params.set("salePaymentStatusId", filters.salePaymentStatusId);
  if (filters.saleChannelId) params.set("saleChannelId", filters.saleChannelId);
  return params;
}
