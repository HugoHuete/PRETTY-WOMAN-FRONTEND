export type InventoryIssueType =
  | "damaged"
  | "dirty"
  | "missing"
  | "under-review"
  | "repairing";

export type InventoryIssueStatus =
  | "open"
  | "resolved"
  | "discarded"
  | "lost"
  | "cancelled";

export type InventoryIssueFilters = {
  page: number;
  pageSize: number;
  productCode: string;
  type: InventoryIssueType | "";
  status: InventoryIssueStatus | "";
};

export const defaultInventoryIssueFilters: InventoryIssueFilters = {
  page: 1,
  pageSize: 20,
  productCode: "",
  type: "",
  status: "",
};

export type InventoryIssue = {
  id: number;
  productId: number;
  productVariantId: number;
  productName: string | null;
  productCode: number | null;
  sizeName: string | null;
  variantName: string | null;
  type: InventoryIssueType;
  typeName: string;
  status: InventoryIssueStatus;
  statusName: string;
  quantity: number;
  reportedAt: string;
  resolvedAt: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string | null;
  availabilityImpact: string;
};

export type PaginatedInventoryIssues = {
  items: InventoryIssue[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export const inventoryIssueTypeOptions: Array<{ value: InventoryIssueType; label: string; id: number }> = [
  { value: "damaged", label: "Dañada", id: 1 },
  { value: "dirty", label: "Sucia", id: 2 },
  { value: "missing", label: "No encontrada", id: 3 },
  { value: "under-review", label: "En revisión", id: 4 },
  { value: "repairing", label: "En reparación", id: 5 },
];

export const inventoryIssueStatusOptions: Array<{ value: InventoryIssueStatus; label: string; id: number }> = [
  { value: "open", label: "Abierta", id: 1 },
  { value: "resolved", label: "Disponible nuevamente", id: 2 },
  { value: "discarded", label: "Descartada", id: 3 },
  { value: "lost", label: "Pérdida confirmada", id: 4 },
  { value: "cancelled", label: "Cancelada", id: 5 },
];

export function inventoryIssueTypeLabel(type: InventoryIssueType) {
  return inventoryIssueTypeOptions.find((option) => option.value === type)?.label ?? "Tipo desconocido";
}

export function inventoryIssueStatusLabel(status: InventoryIssueStatus) {
  return inventoryIssueStatusOptions.find((option) => option.value === status)?.label ?? "Estado desconocido";
}

export function inventoryIssueStatusTone(status: InventoryIssueStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "open") return "warning";
  if (status === "cancelled") return "neutral";
  if (status === "resolved") return "success";
  if (status === "lost" || status === "discarded") return "danger";
  return "info";
}
