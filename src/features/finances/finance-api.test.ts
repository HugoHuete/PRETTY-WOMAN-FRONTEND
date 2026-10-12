import { describe, expect, it, vi } from "vitest";
import {
  buildFinanceMovementsPath,
  canManageFinanceMovementManually,
  createFinanceMovement,
  deleteFinanceMovement,
  financeMovementDirectionLabel,
  financeMovementTypeLabel,
  isManualFinancialMovementType,
  loadExpenseCategories,
  loadFinanceMovementTypes,
  loadFinanceMovements,
  mapFinancialMovement,
  movementOriginLabel,
  readFinanceApiError,
  updateFinanceMovement,
  type AuthenticatedRequest,
} from "./finance-api";
import { defaultFinanceMovementFilters } from "./finance-types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function movementDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 81,
    description: "Abono de venta #204",
    movementDate: "2026-10-10T12:30:00Z",
    createdAt: "2026-10-10T12:31:00Z",
    movementDirectionId: 1,
    movementDirectionName: "In",
    financialMovementTypeId: 3,
    financialMovementTypeName: "SalePayment",
    expenseCategoryId: null,
    orderId: null,
    salePaymentMovementId: 204,
    deliveryAgencyReconciliationId: null,
    loanId: null,
    loanPaymentId: null,
    amount: 750,
    exchangeRate: 36.6,
    comments: null,
    ...overrides,
  };
}

describe("finance movement API", () => {
  it("serializes only supplied backend filters and pagination", () => {
    expect(buildFinanceMovementsPath(defaultFinanceMovementFilters)).toBe(
      "/api/v1/finances/movements?page=1&pageSize=20",
    );
    expect(buildFinanceMovementsPath({
      ...defaultFinanceMovementFilters,
      page: 3,
      pageSize: 50,
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      financialMovementTypeId: 4,
      movementDirectionId: 2,
    })).toBe(
      "/api/v1/finances/movements?page=3&pageSize=50&fromDate=2026-10-01&toDate=2026-10-31&financialMovementTypeId=4&movementDirectionId=2",
    );
  });

  it("preserves date-only filters without shifting their calendar day", () => {
    const path = buildFinanceMovementsPath({
      ...defaultFinanceMovementFilters,
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
    });

    expect(path).toContain("fromDate=2026-01-01");
    expect(path).toContain("toDate=2026-01-31");
  });

  it("normalizes invalid pagination and clamps page size to the backend maximum", () => {
    expect(buildFinanceMovementsPath({
      ...defaultFinanceMovementFilters,
      page: 0,
      pageSize: 250,
    })).toBe("/api/v1/finances/movements?page=1&pageSize=100");
  });

  it("loads and localizes movement type options from the backend", async () => {
    const request: AuthenticatedRequest = vi.fn().mockResolvedValue(jsonResponse([
      { id: 3, name: "SalePayment" },
      { id: 4, name: "Expense" },
    ]));

    await expect(loadFinanceMovementTypes(request)).resolves.toEqual([
      { id: 3, name: "SalePayment", label: "Pago de venta" },
      { id: 4, name: "Expense", label: "Gasto" },
    ]);
    expect(request).toHaveBeenCalledWith("/api/v1/finances/movement-types");
  });

  it("localizes manual types by their API names rather than assuming fixed IDs", async () => {
    const request: AuthenticatedRequest = vi.fn().mockResolvedValue(jsonResponse([
      { id: 44, name: "Expense" },
      { id: 45, name: "OwnerInvestment" },
      { id: 46, name: "OwnerWithdrawal" },
      { id: 47, name: "Adjustment" },
      { id: 48, name: "SalePayment" },
    ]));

    const types = await loadFinanceMovementTypes(request);
    expect(types.map(({ id, label }) => [id, label])).toEqual([
      [44, "Gasto"],
      [45, "Aporte de propietaria"],
      [46, "Retiro de propietaria"],
      [47, "Ajuste"],
      [48, "Pago de venta"],
    ]);
    expect(types.filter(({ name }) => isManualFinancialMovementType(name)).map(({ id }) => id)).toEqual([44, 45, 46, 47]);
    expect(isManualFinancialMovementType("SalePayment")).toBe(false);
  });

  it("identifies manual controls and origins by type name instead of fixed IDs", () => {
    const manual = mapFinancialMovement(movementDto({
      financialMovementTypeId: 44,
      financialMovementTypeName: "Expense",
      salePaymentMovementId: null,
    }));
    expect(canManageFinanceMovementManually(manual)).toBe(true);
    expect(manual.originLabel).toBe("Manual");
    expect(canManageFinanceMovementManually({ ...manual, financialMovementTypeId: 4, financialMovementTypeName: null })).toBe(false);
    expect(canManageFinanceMovementManually({ ...manual, financialMovementTypeId: 4, financialMovementTypeName: "SupplierPayment" })).toBe(false);
    expect(canManageFinanceMovementManually({ ...manual, orderId: 8 })).toBe(false);
    expect(canManageFinanceMovementManually(mapFinancialMovement(movementDto()))).toBe(false);
    expect(mapFinancialMovement(movementDto({ financialMovementTypeId: 4, financialMovementTypeName: "SupplierPayment", orderId: null, salePaymentMovementId: null })).originLabel).toBe("—");
  });

  it("loads expense categories for the manual expense form", async () => {
    const request: AuthenticatedRequest = vi.fn().mockResolvedValue(jsonResponse([
      { id: 2, name: "Empaque" },
      { id: 7, name: "Servicios" },
    ]));

    await expect(loadExpenseCategories(request)).resolves.toEqual([
      { id: 2, name: "Empaque" },
      { id: 7, name: "Servicios" },
    ]);
    expect(request).toHaveBeenCalledWith("/api/v1/expensecategories");
  });

  it("posts a manual movement using only the supplied contract fields", async () => {
    const request: AuthenticatedRequest = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await createFinanceMovement(request, {
      description: "Compra de empaques",
      movementDate: "2026-10-11T00:00:00Z",
      financialMovementTypeId: 44,
      expenseCategoryId: 2,
      amount: 2500,
      comments: "Bolsas y cajas",
    });

    expect(request).toHaveBeenCalledWith("/api/v1/finances/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Compra de empaques",
        movementDate: "2026-10-11T00:00:00Z",
        financialMovementTypeId: 44,
        expenseCategoryId: 2,
        amount: 2500,
        comments: "Bolsas y cajas",
      }),
    });
  });

  it("surfaces backend validation errors when a manual movement is rejected", async () => {
    const request: AuthenticatedRequest = vi.fn().mockResolvedValue(jsonResponse({ detail: "La categoría no es válida." }, 400));

    await expect(createFinanceMovement(request, {
      description: "Compra",
      financialMovementTypeId: 44,
      expenseCategoryId: 2,
      amount: 10,
    })).rejects.toMatchObject({ status: 400, message: "La categoría no es válida." });
  });

  it("updates a manual movement using its ID and the supplied contract fields", async () => {
    const request: AuthenticatedRequest = vi.fn().mockResolvedValue(jsonResponse(movementDto({
      id: 123,
      description: "Compra de materiales",
      financialMovementTypeId: 4,
      financialMovementTypeName: "Expense",
    })));

    await updateFinanceMovement(request, 123, {
      description: "Compra de materiales",
      movementDate: "2026-10-11T10:30:00Z",
      financialMovementTypeId: 4,
      expenseCategoryId: 2,
      amount: 350,
      comments: "Compra para el local",
    });

    expect(request).toHaveBeenCalledWith("/api/v1/finances/movements/123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Compra de materiales",
        movementDate: "2026-10-11T10:30:00Z",
        financialMovementTypeId: 4,
        expenseCategoryId: 2,
        amount: 350,
        comments: "Compra para el local",
      }),
    });
  });

  it("deletes a movement without a body and surfaces backend errors", async () => {
    const requestMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const request: AuthenticatedRequest = requestMock;
    await deleteFinanceMovement(request, 123);
    expect(request).toHaveBeenCalledWith("/api/v1/finances/movements/123", { method: "DELETE" });

    requestMock.mockResolvedValueOnce(jsonResponse({ detail: "Solo se pueden eliminar movimientos manuales." }, 400));
    await expect(deleteFinanceMovement(request, 999)).rejects.toMatchObject({
      status: 400,
      message: "Solo se pueden eliminar movimientos manuales.",
    });
  });

  it("maps every movement field and paginated metadata from the backend", async () => {
    const request: AuthenticatedRequest = vi.fn().mockResolvedValue(jsonResponse({
      items: [movementDto()],
      page: 2,
      pageSize: 20,
      totalCount: 41,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    }));

    await expect(loadFinanceMovements(request, { ...defaultFinanceMovementFilters, page: 2 })).resolves.toEqual({
      items: [{
        id: 81,
        description: "Abono de venta #204",
        movementDate: "2026-10-10T12:30:00Z",
        createdAt: "2026-10-10T12:31:00Z",
        movementDirectionId: 1,
        movementDirectionName: "In",
        movementDirectionLabel: "Ingreso",
        financialMovementTypeId: 3,
        financialMovementTypeName: "SalePayment",
        financialMovementTypeLabel: "Pago de venta",
        expenseCategoryId: null,
        orderId: null,
        salePaymentMovementId: 204,
        deliveryAgencyReconciliationId: null,
        loanId: null,
        loanPaymentId: null,
        amount: 750,
        exchangeRate: 36.6,
        comments: null,
        originLabel: "Pago de venta #204",
      }],
      page: 2,
      pageSize: 20,
      totalCount: 41,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
    expect(request).toHaveBeenCalledWith("/api/v1/finances/movements?page=2&pageSize=20");
  });

  it("derives a fallback total page count when the API omits it", async () => {
    const request: AuthenticatedRequest = vi.fn().mockResolvedValue(jsonResponse({
      items: [],
      page: 2,
      pageSize: 20,
      totalCount: 41,
    }));

    await expect(loadFinanceMovements(request, { ...defaultFinanceMovementFilters, page: 2 })).resolves.toMatchObject({
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it("preserves unknown IDs and supplies readable labels", () => {
    const movement = mapFinancialMovement(movementDto({
      movementDirectionId: 9,
      movementDirectionName: "UnmappedDirection",
      financialMovementTypeId: 99,
      financialMovementTypeName: "SpecialAdjustment",
      salePaymentMovementId: null,
    }));

    expect(movement).toMatchObject({
      movementDirectionId: 9,
      movementDirectionLabel: "Dirección desconocida (9)",
      financialMovementTypeId: 99,
      financialMovementTypeLabel: "Special Adjustment",
      originLabel: "—",
    });
    expect(financeMovementTypeLabel(99, "SpecialAdjustment")).toBe("Special Adjustment");
    expect(financeMovementDirectionLabel(9)).toBe("Dirección desconocida (9)");
  });

  it("derives origin labels from the movement's linked records", () => {
    expect(movementOriginLabel(mapFinancialMovement(movementDto({ salePaymentMovementId: null, orderId: 52 })))).toBe("Pedido #52");
    expect(movementOriginLabel(mapFinancialMovement(movementDto({ salePaymentMovementId: null, deliveryAgencyReconciliationId: 12 })))).toBe("Conciliación #12");
    expect(movementOriginLabel(mapFinancialMovement(movementDto({ salePaymentMovementId: null, loanPaymentId: 6 })))).toBe("Pago de préstamo #6");
    expect(movementOriginLabel(mapFinancialMovement(movementDto({ salePaymentMovementId: null, loanId: 7 })))).toBe("Préstamo #7");
    expect(movementOriginLabel(mapFinancialMovement(movementDto({ salePaymentMovementId: null, financialMovementTypeId: 4, financialMovementTypeName: "Expense", expenseCategoryId: 16 })))).toBe("Categoría #16");
    expect(movementOriginLabel(mapFinancialMovement(movementDto({ salePaymentMovementId: null, financialMovementTypeId: 4, financialMovementTypeName: "Expense", expenseCategoryId: null })))).toBe("Manual");
    expect(movementOriginLabel(mapFinancialMovement(movementDto({ salePaymentMovementId: null })))).toBe("—");
  });

  it("uses ProblemDetails detail and falls back for non-JSON errors", async () => {
    const responseWithDetail = jsonResponse({ detail: "No tienes permiso." }, 403);
    const nonJsonResponse = new Response("upstream unavailable", { status: 502 });

    await expect(readFinanceApiError(responseWithDetail, "Error de consulta")).resolves.toMatchObject({
      name: "FinanceApiError",
      status: 403,
      message: "No tienes permiso.",
    });
    await expect(readFinanceApiError(nonJsonResponse, "Error de consulta")).resolves.toMatchObject({
      status: 502,
      message: "Error de consulta",
    });
  });
});
