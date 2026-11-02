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
  forSelection: boolean;
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

export function allocateGlobalManualDiscount(
  lines: SaleDraftLine[],
  type: SaleManualDiscountType,
  value: number,
): Map<number, number> {
  const discounts = new Map<number, number>();
  const eligibleLines = lines.filter((line) =>
    !line.forSelection &&
    Number.isFinite(line.unitPrice) && line.unitPrice > 0 &&
    Number.isInteger(line.quantity) && line.quantity > 0,
  );
  const grossSubtotal = eligibleLines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);

  if (!Number.isFinite(value) || value < 0 || grossSubtotal <= 0) {
    return discounts;
  }

  if (type === "percent") {
    if (value > 100) return discounts;
    eligibleLines.forEach((line) => {
      discounts.set(
        line.productVariantId,
        calculateManualDiscountAmount("percent", value, line.unitPrice),
      );
    });
    return discounts;
  }

  const requestedDiscount = type === "amount"
    ? value
    : grossSubtotal - value;
  if (requestedDiscount < 0 || requestedDiscount > grossSubtotal) return discounts;

  const targetCents = Math.round(requestedDiscount * 100);
  const grossCents = Math.round(grossSubtotal * 100);
  if (grossCents <= 0) {
    eligibleLines.forEach((line) => discounts.set(line.productVariantId, 0));
    return discounts;
  }
  const allocations = eligibleLines.map((line) => {
    const unitPriceCents = Math.round(line.unitPrice * 100);
    const exactUnitDiscountCents = targetCents * unitPriceCents / grossCents;
    const unitDiscountCents = Math.min(unitPriceCents, Math.floor(exactUnitDiscountCents));
    return {
      line,
      unitPriceCents,
      unitDiscountCents,
      fractionalRemainder: exactUnitDiscountCents - Math.floor(exactUnitDiscountCents),
    };
  });

  const allocatedCents = allocations.reduce(
    (total, allocation) => total + allocation.unitDiscountCents * allocation.line.quantity,
    0,
  );
  const remainingCents = targetCents - allocatedCents;
  const bestAllocations: ({ fractionalScore: number; indexes: number[] } | null)[] = Array(remainingCents + 1).fill(null);
  bestAllocations[0] = { fractionalScore: 0, indexes: [] };

  allocations.forEach((allocation, index) => {
    const incrementCents = allocation.line.quantity;
    if (allocation.unitDiscountCents >= allocation.unitPriceCents || incrementCents > remainingCents) return;

    for (let cents = remainingCents; cents >= incrementCents; cents -= 1) {
      const previous = bestAllocations[cents - incrementCents];
      if (!previous) continue;
      const current = bestAllocations[cents];
      const fractionalScore = previous.fractionalScore + allocation.fractionalRemainder;
      if (!current || fractionalScore > current.fractionalScore) {
        bestAllocations[cents] = {
          fractionalScore,
          indexes: [...previous.indexes, index],
        };
      }
    }
  });

  for (let cents = remainingCents; cents > 0; cents -= 1) {
    const best = bestAllocations[cents];
    if (!best) continue;
    best.indexes.forEach((index) => {
      allocations[index].unitDiscountCents += 1;
    });
    break;
  }

  allocations.forEach(({ line, unitDiscountCents }) => {
    discounts.set(line.productVariantId, unitDiscountCents / 100);
  });
  return discounts;
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
