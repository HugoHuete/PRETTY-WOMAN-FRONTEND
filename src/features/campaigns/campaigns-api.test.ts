import { describe, expect, it } from "vitest";
import {
  buildCampaignCsvTemplate,
  buildCampaignPayload,
  parseCampaignCsv,
  type CampaignLineInput,
} from "./campaigns-api";

describe("campaign API contract", () => {
  it("builds targets with productId or productPresentationId and never productVariantId", () => {
    const lines: CampaignLineInput[] = [
      { key: "product-101", productId: 101, label: "Producto", detail: "", discountTypeId: 2, discountValue: 20 },
      { key: "presentation-45", productPresentationId: 45, label: "Presentación", detail: "", discountTypeId: 3, discountValue: 450 },
    ];

    expect(buildCampaignPayload({ name: "Promo", startDate: "2026-10-01", endDate: "2026-10-31" }, lines)).toEqual({
      name: "Promo",
      startDate: "2026-10-01T00:00:00.000Z",
      endDate: "2026-10-31T23:59:59.000Z",
      targets: [
        { productId: 101, productPresentationId: null, discountTypeId: 2, discountValue: 20 },
        { productId: null, productPresentationId: 45, discountTypeId: 3, discountValue: 450 },
      ],
    });
  });

  it("parses the documented CSV columns and adds row numbers", () => {
    expect(parseCampaignCsv("productCode,productPresentationId,discountTypeId,discountValue\n101,,2,20\n102,45,3,450\n", ",")).toEqual({
      rows: [
        { rowNumber: 2, productCode: 101, productPresentationId: null, discountTypeId: 2, discountValue: 20 },
        { rowNumber: 3, productCode: 102, productPresentationId: 45, discountTypeId: 3, discountValue: 450 },
      ],
      errors: [],
    });
  });

  it("rejects malformed CSV rows before calling the backend", () => {
    expect(parseCampaignCsv("productCode,productPresentationId,discountTypeId,discountValue\nabc,,4,-2\n", ",")).toEqual({
      rows: [],
      errors: [
        "Fila 2: productCode debe ser un entero.",
        "Fila 2: discountTypeId debe ser 1, 2 o 3.",
        "Fila 2: discountValue debe ser un número mayor que cero.",
      ],
    });
  });

  it("parses semicolon-separated CSV by default", () => {
    const result = parseCampaignCsv(
      "productCode;productPresentationId;discountTypeId;discountValue\n101;;2;20",
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { rowNumber: 2, productCode: 101, productPresentationId: null, discountTypeId: 2, discountValue: 20 },
    ]);
  });

  it("parses CSV using the selected delimiter", () => {
    const result = parseCampaignCsv(
      "productCode,productPresentationId,discountTypeId,discountValue\n101,45,3,450",
      ",",
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ productCode: 101, productPresentationId: 45, discountTypeId: 3, discountValue: 450 });
  });

  it("builds a template with the selected delimiter", () => {
    expect(buildCampaignCsvTemplate(";")).toBe("productCode;productPresentationId;discountTypeId;discountValue\n");
    expect(buildCampaignCsvTemplate(",")).toBe("productCode,productPresentationId,discountTypeId,discountValue\n");
  });});
