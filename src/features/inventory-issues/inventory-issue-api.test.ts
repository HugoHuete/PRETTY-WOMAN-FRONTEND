import { describe, expect, it, vi } from "vitest";
import {
  buildInventoryIssuesPath,
  deleteInventoryIssue,
  loadInventoryIssue,
  loadInventoryIssues,
  problemDetail,
  resolveInventoryIssue,
  searchProductsByCode,
} from "./inventory-issue-api";
import {
  defaultInventoryIssueFilters,
  inventoryIssueStatusLabel,
  inventoryIssueStatusTone,
  inventoryIssueTypeLabel,
} from "./inventory-issue-types";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function issueDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 1042,
    productId: 42,
    productVariantId: 70,
    productName: "Vestido satinado",
    productCode: 1042,
    sizeName: "M",
    variant: "Coral",
    productInventoryIssueTypeId: 1,
    productInventoryIssueTypeName: "Damaged",
    productInventoryIssueStatusId: 1,
    productInventoryIssueStatusName: "Open",
    quantity: 1,
    issueDate: "2026-08-22T13:10:00Z",
    resolvedAt: null,
    comments: "Presenta una mancha visible.",
    createdAt: "2026-08-22T13:10:00Z",
    updatedAt: null,
    ...overrides,
  };
}

describe("inventory issue API", () => {
  it("serializes the backend-supported filters", () => {
    expect(buildInventoryIssuesPath({ ...defaultInventoryIssueFilters, page: 2, productCode: "1042", type: "damaged", status: "open" })).toBe(
      "/api/v1/product-inventory-issues?page=2&pageSize=20&productCode=1042&productInventoryIssueTypeId=1&productInventoryIssueStatusId=1",
    );
  });

  it("searches products by code among available products only", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));

    await searchProductsByCode(request, "1042");

    expect(request).toHaveBeenCalledWith("/api/v1/products?page=1&pageSize=20&code=1042&availability=1");
  });

  it("resolves an issue with the selected inventory status", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(issueDto({ productInventoryIssueStatusId: 2 })));

    await resolveInventoryIssue(request, "1042", 2);

    expect(request).toHaveBeenCalledWith("/api/v1/product-inventory-issues/1042/resolution", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productInventoryIssueStatusId: 2 }),
    });
  });

  it("deletes an issue through the backend cancellation action", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(issueDto({ productInventoryIssueStatusId: 5 })));

    await deleteInventoryIssue(request, "1042");

    expect(request).toHaveBeenCalledWith("/api/v1/product-inventory-issues/1042", { method: "DELETE" });
  });

  it("localizes issue types and statuses", () => {
    expect(inventoryIssueTypeLabel("damaged")).toBe("Dañada");
    expect(inventoryIssueStatusLabel("resolved")).toBe("Disponible nuevamente");
    expect(inventoryIssueStatusTone("cancelled")).toBe("neutral");
  });

  it("maps a paginated list and detail to the UI model", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [issueDto()], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false }))
      .mockResolvedValueOnce(jsonResponse(issueDto({ productInventoryIssueStatusId: 4, productInventoryIssueStatusName: "ConfirmedLost" })));

    const page = await loadInventoryIssues(request, defaultInventoryIssueFilters);
    const detail = await loadInventoryIssue(request, "1042");

    expect(page.items[0]).toMatchObject({ productName: "Vestido satinado", productCode: 1042, variantName: "Coral", sizeName: "M", type: "damaged", status: "open", availabilityImpact: "No disponible" });
    expect(detail).toMatchObject({ status: "lost", statusName: "Pérdida confirmada", availabilityImpact: "Fuera de inventario" });
    expect(request).toHaveBeenNthCalledWith(2, "/api/v1/product-inventory-issues/1042");
  });

  it("prefers ProblemDetails detail, then title, then fallback", async () => {
    expect(await problemDetail(await jsonResponse({ detail: "No disponible" }), "Fallback")).toBe("No disponible");
    expect(await problemDetail(await jsonResponse({ title: "Error de consulta" }), "Fallback")).toBe("Error de consulta");
    expect(await problemDetail(await jsonResponse("invalid"), "Fallback")).toBe("Fallback");
  });

  it("throws an error with status and backend detail for non-OK responses", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ detail: "No tienes permiso." }, 403));
    await expect(loadInventoryIssues(request, defaultInventoryIssueFilters)).rejects.toMatchObject({ status: 403, message: "No tienes permiso." });
  });
});
