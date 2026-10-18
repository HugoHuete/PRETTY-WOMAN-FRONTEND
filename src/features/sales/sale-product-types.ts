import type { ProductDTO, ProductVariantDTO } from "../products/product-types";

export type SaleDraftLine = {
  productVariantId: number;
  productName: string;
  productCode: number;
  presentationName: string;
  imageUrl: string | null;
  presentationVariants: ProductVariantDTO[];
  sizeName: string | null;
  availableQuantity: number;
  quantity: number;
  unitPrice: number;
  campaignDiscountAmount?: number;
  discountAmount: number;
  discountSourceId: number;
  discountCampaignId: number | null;
  campaignId?: number | null;
  manualDiscountType?: SaleManualDiscountType | null;
  manualDiscountValue?: number | null;
};

export type SaleManualDiscountType = "percent" | "amount" | "final";

export function calculateManualDiscountAmount(
  type: SaleManualDiscountType,
  value: number,
  unitPrice: number,
) {
  const amount = type === "percent"
    ? unitPrice * (value / 100)
    : type === "amount"
      ? value
      : unitPrice - value;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export type SaleVariantOption = {
  variant: ProductVariantDTO;
  product: ProductDTO;
  presentationId: number;
  presentationName: string;
  imageUrl: string | null;
  presentationVariants: ProductVariantDTO[];
};

export function saleVariants(products: ProductDTO[]): SaleVariantOption[] {
  return products.flatMap((product) => product.presentations.flatMap((presentation) => presentation.sizes
    .filter((variant) => variant.availableQuantity > 0)
    .map((variant) => ({
      product,
      variant,
      presentationId: presentation.id,
      presentationName: presentation.name?.trim() || "Presentación",
      imageUrl: presentation.primaryImageUrl || product.primaryImageUrl || null,
      presentationVariants: presentation.sizes,
    }))));
}
