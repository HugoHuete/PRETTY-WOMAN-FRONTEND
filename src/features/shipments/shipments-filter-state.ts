import type { ShipmentFilters } from "./shipments-types";

export const shipmentsPageSize = 20;

function todayInManagua() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Managua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const defaultShipmentFilters = (): ShipmentFilters => ({
  page: 1,
  pageSize: shipmentsPageSize,
  clientSearch: "",
  date: todayInManagua(),
  deliveryStatusId: "",
  deliveryAgencyId: "",
});

function positiveInteger(value: string | null, fallback: number, maximum?: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
}

function optionalId(value: string | null) {
  return value && /^[1-9]\d*$/.test(value) ? value : "";
}

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? value : "";
}

export function readShipmentFilters(params: URLSearchParams): ShipmentFilters {
  const defaults = defaultShipmentFilters();
  const rawDate = params.get("date");
  return {
    page: positiveInteger(params.get("page"), defaults.page),
    pageSize: positiveInteger(params.get("pageSize"), defaults.pageSize, 100),
    clientSearch: (params.get("clientSearch") ?? "").trim(),
    date: rawDate === null ? defaults.date : validDate(rawDate),
    deliveryStatusId: optionalId(params.get("deliveryStatusId")),
    deliveryAgencyId: optionalId(params.get("deliveryAgencyId")),
  };
}

export function buildShipmentSearchParams(filters: ShipmentFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  if (filters.date) params.set("date", filters.date);
  if (filters.clientSearch) params.set("clientSearch", filters.clientSearch);
  if (filters.deliveryStatusId) params.set("deliveryStatusId", filters.deliveryStatusId);
  if (filters.deliveryAgencyId) params.set("deliveryAgencyId", filters.deliveryAgencyId);
  return params;
}
