export type ProductVariantDTO = {
  id: number;
  sizeId: number;
  sizeName: string | null;
  sizeGroupId: number | null;
  sizeGroupName: string | null;
  quantity: number;
  receivedQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  unavailableQuantity: number;
  salePrice: number;
  discountedSalePrice: number | null;
  discountCampaignId: number | null;
  discountCampaignName: string | null;
};

export type ProductPresentationDTO = {
  id: number;
  name: string | null;
  sortOrder: number;
  primaryImageUrl: string | null;
  sizes: ProductVariantDTO[];
};

export type ProductDTO = {
  id: number;
  supplierProductCode: string;
  code: number;
  name: string;
  subcategoryId: number;
  subcategoryName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  primaryImageUrl: string | null;
  presentations: ProductPresentationDTO[];
};

export type ProductCategory = { id: number; name: string };
export type ProductSize = { id: number; name: string };

export type PaginatedProducts = {
  items: ProductDTO[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type ProductFilters = {
  page: number;
  pageSize: number;
  availability: string;
  code: string;
  categoryId: string;
  subcategoryId: string;
  sizeId: string;
};

export type ProductAvailability = "available" | "reserved" | "unavailable";

export const defaultProductFilters: ProductFilters = {
  page: 1,
  pageSize: 20,
  availability: "",
  code: "",
  categoryId: "",
  subcategoryId: "",
  sizeId: "",
};

export function buildProductsPath(filters: ProductFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  if (filters.availability.trim()) params.set("availability", filters.availability.trim());
  if (filters.code.trim()) params.set("code", filters.code.trim());
  if (filters.categoryId.trim()) params.set("categoryId", filters.categoryId.trim());
  if (filters.subcategoryId.trim()) params.set("subcategoryId", filters.subcategoryId.trim());
  if (filters.sizeId.trim()) params.set("sizeId", filters.sizeId.trim());

  return `/api/v1/products?${params.toString()}`;
}

export function productTotals(product: ProductDTO) {
  return product.presentations.reduce(
    (totals, presentation) =>
      presentation.sizes.reduce(
        (next, size) => ({
          available: next.available + size.availableQuantity,
          reserved: next.reserved + size.reservedQuantity,
          unavailable: next.unavailable + size.unavailableQuantity,
        }),
        totals,
      ),
    { available: 0, reserved: 0, unavailable: 0 },
  );
}

export function productAvailability(product: ProductDTO): ProductAvailability {
  const totals = productTotals(product);
  if (totals.available > 0) return "available";
  if (totals.reserved > 0) return "reserved";
  return "unavailable";
}

export function productAvailabilityLabel(value: ProductAvailability): string {
  return {
    available: "Disponible",
    reserved: "Reservado",
    unavailable: "No disponible",
  }[value];
}

export function productAvailabilityTone(
  value: ProductAvailability,
): "success" | "warning" | "danger" {
  return { available: "success", reserved: "warning", unavailable: "danger" }[value] as "success" | "warning" | "danger";
}

export function formatProductPrice(value: number): string {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(value);
}

export function productPresentationLabel(count: number): string {
  return `${count} ${count === 1 ? "presentación" : "presentaciones"}`;
}

export function productSizeCount(product: ProductDTO): number {
  return new Set(product.presentations.flatMap((presentation) => presentation.sizes.map((size) => size.sizeId))).size;
}