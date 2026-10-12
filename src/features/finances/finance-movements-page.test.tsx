import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PageActionsProvider, usePageActions } from "../../shared/layout/page-actions-context";
import { ToastProvider } from "../../shared/ui/toast-provider";
import { FinanceMovementsPage } from "./finance-movements-page";
import { financeMovementFiltersFromSearchParams, searchParamsFromFinanceMovementFilters } from "./finance-filter-state";
import { defaultFinanceMovementFilters } from "./finance-types";

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request, session: { user: { roles: ["Admin"] } } }),
}));

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function movement(overrides: Record<string, unknown> = {}) {
  return {
    id: 701,
    description: "Pago de proveedor",
    movementDate: "2026-10-10T15:30:00Z",
    createdAt: "2026-10-10T15:35:00Z",
    movementDirectionId: 2,
    movementDirectionName: "Out",
    financialMovementTypeId: 2,
    financialMovementTypeName: "SupplierPayment",
    expenseCategoryId: null,
    orderId: 84,
    salePaymentMovementId: null,
    deliveryAgencyReconciliationId: null,
    loanId: null,
    loanPaymentId: null,
    amount: 1250,
    exchangeRate: 36.7,
    comments: "Compra de temporada.",
    ...overrides,
  };
}

function localMidnightTimestamp(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function todayLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function listResponse(items = [movement()], overrides: Record<string, unknown> = {}) {
  return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPreviousPage: false, hasNextPage: false, ...overrides };
}

function mockFinanceApi(items = [movement()], listOverrides: Record<string, unknown> = {}) {
  auth.request.mockImplementation((path: string) => {
    if (path === "/api/v1/finances/movement-types") {
      return jsonResponse([
        { id: 2, name: "SupplierPayment" },
        { id: 44, name: "Expense" },
        { id: 45, name: "OwnerInvestment" },
        { id: 46, name: "OwnerWithdrawal" },
        { id: 47, name: "Adjustment" },
        { id: 99, name: "UnexpectedType" },
      ]);
    }
    if (path === "/api/v1/expensecategories") return jsonResponse([{ id: 8, name: "Empaque" }, { id: 9, name: "Servicios" }]);
    return jsonResponse(listResponse(items, listOverrides));
  });
}

function ActionHost() {
  const { action, heading } = usePageActions();
  return <>
    {heading ? <h1>{heading.title}</h1> : null}
    <div data-testid="page-actions">{action}</div>
  </>;
}

function renderFinanceAt(path = "/finances") {
  return render(<MemoryRouter initialEntries={[path]}><ToastProvider><PageActionsProvider><FinanceMovementsPage /><ActionHost /></PageActionsProvider></ToastProvider></MemoryRouter>);
}

afterEach(() => auth.request.mockReset());

describe("FinanceMovementsPage", () => {
  it("loads movement types and the initial server page", async () => {
    mockFinanceApi();
    renderFinanceAt();

    expect(await screen.findByText("Pago de proveedor")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Movimientos financieros" })).toBeVisible();
    expect(await within(screen.getByTestId("page-actions")).findByRole("button", { name: "Registrar movimiento" })).toBeVisible();
    expect(auth.request).toHaveBeenCalledWith("/api/v1/finances/movement-types");
    expect(auth.request).toHaveBeenCalledWith("/api/v1/finances/movements?page=1&pageSize=20");
    expect(screen.getAllByText("Egreso").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Pedido #84")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Monto" })).toBeVisible();
    expect(screen.getByText("C$ 1,250.00")).toBeVisible();
  });

  it("normalizes invalid URL page, pageSize, and filter IDs", () => {
    const filters = financeMovementFiltersFromSearchParams(new URLSearchParams("page=-4&pageSize=1000&financialMovementTypeId=nope&movementDirectionId=3"));
    expect(filters).toEqual({ ...defaultFinanceMovementFilters, pageSize: 100 });
    expect(searchParamsFromFinanceMovementFilters(filters).toString()).toBe("page=1&pageSize=100");
  });

  it("serializes date, type, and direction filters to the URL and API", async () => {
    mockFinanceApi();
    renderFinanceAt("/finances?fromDate=2026-10-01&toDate=2026-10-31&financialMovementTypeId=2&movementDirectionId=2");

    expect(await screen.findByText("Pago de proveedor")).toBeVisible();
    expect(auth.request).toHaveBeenCalledWith("/api/v1/finances/movements?page=1&pageSize=20&fromDate=2026-10-01&toDate=2026-10-31&financialMovementTypeId=2&movementDirectionId=2");
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-10-31");
  });

  it("resets to page 1 when a filter changes", async () => {
    const user = userEvent.setup();
    mockFinanceApi();
    renderFinanceAt("/finances?page=3&pageSize=20");

    await screen.findByText("Pago de proveedor");
    await user.click(screen.getByLabelText("Desde"));
    await user.type(screen.getByLabelText("Desde"), "2026-10-01");
    await waitFor(() => expect(auth.request).toHaveBeenLastCalledWith("/api/v1/finances/movements?page=1&pageSize=20&fromDate=2026-10-01"));
  });

  it("keeps pagination server-side and restores query state", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/finances/movement-types") return jsonResponse([{ id: 2, name: "SupplierPayment" }]);
      if (path.includes("page=2")) return jsonResponse(listResponse([movement({ id: 702, description: "Segundo movimiento" })], { page: 2, totalCount: 21, totalPages: 2, hasPreviousPage: true }));
      return jsonResponse(listResponse([movement()], { totalCount: 21, totalPages: 2, hasNextPage: true }));
    });
    renderFinanceAt("/finances?page=1&pageSize=20&fromDate=2026-10-01");

    await screen.findByText("Pago de proveedor");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByText("Segundo movimiento")).toBeVisible();
    expect(auth.request).toHaveBeenLastCalledWith("/api/v1/finances/movements?page=2&pageSize=20&fromDate=2026-10-01");
  });

  it("opens and closes the selected movement detail", async () => {
    const user = userEvent.setup();
    mockFinanceApi();
    renderFinanceAt();

    await screen.findByText("Pago de proveedor");
    await user.click(screen.getByRole("button", { name: "Ver detalle del movimiento 701" }));
    expect(screen.getByRole("complementary", { name: "Detalle del movimiento 701" })).toBeVisible();
    expect(screen.getByText("Compra de temporada.")).toBeVisible();
    const detail = within(screen.getByRole("complementary", { name: "Detalle del movimiento 701" }));
    expect(detail.getByText("1,250.00")).toBeVisible();
    expect(detail.queryByText(/C\$/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(screen.queryByRole("complementary", { name: "Detalle del movimiento 701" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar movimiento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar movimiento" })).not.toBeInTheDocument();
  });

  it("edits a manual movement, preserves its time when changing the date, and refreshes the list", async () => {
    const user = userEvent.setup();
    const manual = movement({
      description: "Aporte para caja",
      movementDate: "2026-10-10T16:45:00Z",
      movementDirectionId: 1,
      movementDirectionName: "In",
      financialMovementTypeId: 45,
      financialMovementTypeName: "OwnerInvestment",
      orderId: null,
      amount: 100,
      comments: "Inicial",
    });
    const expectedMovementDate = new Date(manual.movementDate);
    expectedMovementDate.setDate(expectedMovementDate.getDate() + 1);
    let updated = false;
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/finances/movement-types") return jsonResponse([{ id: 45, name: "OwnerInvestment" }]);
      if (path === "/api/v1/finances/movements/701" && init?.method === "PUT") {
        updated = true;
        return jsonResponse(manual);
      }
      return jsonResponse(listResponse([updated ? { ...manual, description: "Aporte actualizado", amount: 200 } : manual]));
    });
    renderFinanceAt();

    await screen.findByText("Aporte para caja");
    await user.click(screen.getByRole("button", { name: "Ver detalle del movimiento 701" }));
    await user.click(screen.getByRole("button", { name: "Editar movimiento" }));
    const dialog = screen.getByRole("dialog", { name: "Editar movimiento" });
    expect(within(dialog).getByLabelText("Descripción")).toHaveValue("Aporte para caja");
    expect(within(dialog).getByLabelText("Fecha")).toHaveValue("2026-10-10");
    expect(within(dialog).getByLabelText("Monto")).toHaveValue(100);

    await user.clear(within(dialog).getByLabelText("Descripción"));
    await user.type(within(dialog).getByLabelText("Descripción"), "Aporte actualizado");
    fireEvent.change(within(dialog).getByLabelText("Fecha"), { target: { value: "2026-10-11" } });
    await user.clear(within(dialog).getByLabelText("Monto"));
    await user.type(within(dialog).getByLabelText("Monto"), "200");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(auth.request).toHaveBeenCalledWith("/api/v1/finances/movements/701", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Aporte actualizado",
        movementDate: expectedMovementDate.toISOString(),
        financialMovementTypeId: 45,
        expenseCategoryId: null,
        amount: 200,
        comments: "Inicial",
      }),
    });
    expect(await screen.findByText("Movimiento actualizado correctamente.")).toBeVisible();
    expect(await screen.findByText("Aporte actualizado")).toBeVisible();
    await waitFor(() => expect(auth.request.mock.calls.filter(([path]) => String(path).startsWith("/api/v1/finances/movements?"))).toHaveLength(2));
  });

  it("preserves edited type and direction when closing and reopening an edit", async () => {
    const user = userEvent.setup();
    const expense = movement({
      description: "Compra de empaques",
      movementDirectionId: 2,
      movementDirectionName: "Out",
      financialMovementTypeId: 44,
      financialMovementTypeName: "Expense",
      expenseCategoryId: 8,
      orderId: null,
    });
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/finances/movement-types") return jsonResponse([{ id: 44, name: "Expense" }, { id: 47, name: "Adjustment" }]);
      if (path === "/api/v1/expensecategories") return jsonResponse([{ id: 8, name: "Empaque" }, { id: 9, name: "Servicios" }]);
      return jsonResponse(listResponse([expense]));
    });
    renderFinanceAt();

    await screen.findByText("Compra de empaques");
    await user.click(screen.getByRole("button", { name: "Ver detalle del movimiento 701" }));
    await user.click(screen.getByRole("button", { name: "Editar movimiento" }));
    let dialog = screen.getByRole("dialog", { name: "Editar movimiento" });
    await user.click(within(dialog).getByRole("button", { name: "Tipo de movimiento" }));
    await user.click(within(within(dialog).getByRole("listbox", { name: "Tipo de movimiento" })).getByRole("option", { name: "Ajuste" }));
    await user.click(within(dialog).getByRole("button", { name: "Dirección del ajuste" }));
    await user.click(within(within(dialog).getByRole("listbox", { name: "Dirección del ajuste" })).getByRole("option", { name: "Ingreso" }));

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Editar movimiento" }));
    dialog = screen.getByRole("dialog", { name: "Editar movimiento" });
    expect(within(dialog).getByRole("button", { name: "Tipo de movimiento" })).toHaveTextContent("Ajuste");
    expect(within(dialog).getByRole("button", { name: "Dirección del ajuste" })).toHaveTextContent("Ingreso");
  });

  it("omits the fixed direction when updating an expense", async () => {
    const user = userEvent.setup();
    const expense = movement({
      description: "Compra de empaques",
      movementDirectionId: 2,
      movementDirectionName: "Out",
      financialMovementTypeId: 44,
      financialMovementTypeName: "Expense",
      expenseCategoryId: 8,
      orderId: null,
    });
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/finances/movement-types") return jsonResponse([{ id: 44, name: "Expense" }]);
      if (path === "/api/v1/expensecategories") return jsonResponse([{ id: 8, name: "Empaque" }]);
      if (path === "/api/v1/finances/movements/701" && init?.method === "PUT") return jsonResponse(expense);
      return jsonResponse(listResponse([expense]));
    });
    renderFinanceAt();

    await screen.findByText("Compra de empaques");
    await user.click(screen.getByRole("button", { name: "Ver detalle del movimiento 701" }));
    await user.click(screen.getByRole("button", { name: "Editar movimiento" }));
    const dialog = screen.getByRole("dialog", { name: "Editar movimiento" });
    await screen.findByRole("button", { name: "Categoría de gasto" });
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith("/api/v1/finances/movements/701", expect.objectContaining({ method: "PUT" })));
    const updateCall = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/finances/movements/701" && init?.method === "PUT");
    const payload = JSON.parse(String(updateCall?.[1]?.body));
    expect(payload).not.toHaveProperty("movementDirectionId");
    expect(payload).toHaveProperty("expenseCategoryId", 8);
  });

  it("requires confirmation before deleting a manual movement and refreshes the list", async () => {
    const user = userEvent.setup();
    const manual = movement({
      description: "Retiro de caja",
      financialMovementTypeId: 46,
      financialMovementTypeName: "OwnerWithdrawal",
      orderId: null,
    });
    let deleted = false;
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/finances/movement-types") return jsonResponse([{ id: 46, name: "OwnerWithdrawal" }]);
      if (path === "/api/v1/finances/movements/701" && init?.method === "DELETE") {
        deleted = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return jsonResponse(listResponse(deleted ? [] : [manual]));
    });
    renderFinanceAt();

    await screen.findByText("Retiro de caja");
    await user.click(screen.getByRole("button", { name: "Ver detalle del movimiento 701" }));
    await user.click(screen.getByRole("button", { name: "Eliminar movimiento" }));
    const dialog = screen.getByRole("dialog", { name: "Confirmar eliminación" });
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(auth.request).not.toHaveBeenCalledWith("/api/v1/finances/movements/701", { method: "DELETE" });

    await user.click(screen.getByRole("button", { name: "Eliminar movimiento" }));
    await user.click(within(screen.getByRole("dialog", { name: "Confirmar eliminación" })).getByRole("button", { name: "Eliminar" }));
    expect(auth.request).toHaveBeenCalledWith("/api/v1/finances/movements/701", { method: "DELETE" });
    expect(await screen.findByText("Movimiento eliminado correctamente.")).toBeVisible();
    expect(await screen.findByText("Aún no hay movimientos financieros")).toBeVisible();
  });

  it("renders dashes for nullable fields", async () => {
    const nullable = movement({ description: "Ajuste sin referencia", orderId: null, comments: null, expenseCategoryId: null });
    mockFinanceApi([nullable]);
    renderFinanceAt();

    await screen.findByText("Ajuste sin referencia");
    await userEvent.setup().click(screen.getByRole("button", { name: "Ver detalle del movimiento 701" }));
    const panel = screen.getByRole("complementary", { name: "Detalle del movimiento 701" });
    expect(within(panel).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("renders empty and filtered-empty states", async () => {
    mockFinanceApi([]);
    renderFinanceAt();
    expect(await screen.findByText("Aún no hay movimientos financieros")).toBeVisible();

    cleanup();
    auth.request.mockReset();
    mockFinanceApi([]);
    renderFinanceAt("/finances?fromDate=2026-10-01");
    expect(await screen.findByText("No hay movimientos que coincidan")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Limpiar filtros" }).length).toBeGreaterThanOrEqual(1);
  });

  it("shows retry for recoverable errors", async () => {
    auth.request.mockImplementation((path: string) => path.endsWith("movement-types")
      ? jsonResponse([{ id: 2, name: "SupplierPayment" }])
      : jsonResponse({ detail: "Servicio no disponible." }, 500));
    renderFinanceAt();

    expect(await screen.findByText("Servicio no disponible.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  it("offers only handoff-approved manual movement types and loads expense categories", async () => {
    const user = userEvent.setup();
    mockFinanceApi([]);
    renderFinanceAt();

    await screen.findByText("Aún no hay movimientos financieros");
    await user.click(await screen.findByRole("button", { name: "Registrar movimiento" }));

    const dialog = screen.getByRole("dialog", { name: "Registrar movimiento" });
    expect(within(dialog).getByRole("button", { name: "Tipo de movimiento" })).toHaveAttribute("aria-required", "true");
    await user.click(within(dialog).getByRole("button", { name: "Tipo de movimiento" }));
    expect(within(within(dialog).getByRole("listbox")).getAllByRole("option").map((option) => option.textContent?.replace("✓", ""))).toEqual([
      "Selecciona un tipo",
      "Gasto",
      "Aporte de propietaria",
      "Retiro de propietaria",
      "Ajuste",
    ]);
    await user.click(within(within(dialog).getByRole("listbox")).getByRole("option", { name: "Gasto" }));
    expect(await within(dialog).findByRole("button", { name: "Categoría de gasto" })).toBeVisible();
    await waitFor(() => expect(auth.request).toHaveBeenCalledWith("/api/v1/expensecategories"));
    await user.click(within(dialog).getByRole("button", { name: "Categoría de gasto" }));
    expect(within(within(dialog).getByRole("listbox")).getByRole("option", { name: "Empaque" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Categoría de gasto" })).toHaveAttribute("aria-required", "true");
    expect(within(dialog).queryByLabelText("Dirección del ajuste")).not.toBeInTheDocument();
  });

  it("creates an expense with its category and refreshes the current list", async () => {
    const user = userEvent.setup();
    let created = false;
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/finances/movement-types") return jsonResponse([{ id: 44, name: "Expense" }]);
      if (path === "/api/v1/expensecategories") return jsonResponse([{ id: 8, name: "Empaque" }]);
      if (init?.method === "POST") {
        created = true;
        return jsonResponse(movement({ id: 702, description: "Compra de empaques" }), 201);
      }
      return jsonResponse(listResponse(created ? [movement({ id: 702, description: "Compra de empaques" })] : [movement()]));
    });
    renderFinanceAt();

    await screen.findByText("Pago de proveedor");
    await user.click(await screen.findByRole("button", { name: "Registrar movimiento" }));
    const dialog = screen.getByRole("dialog", { name: "Registrar movimiento" });
    await user.click(within(dialog).getByRole("button", { name: "Tipo de movimiento" }));
    await user.click(within(within(dialog).getByRole("listbox")).getByRole("option", { name: "Gasto" }));
    await user.type(within(dialog).getByLabelText("Descripción"), "Compra de empaques");
    fireEvent.change(within(dialog).getByLabelText("Fecha"), { target: { value: "2026-10-11" } });
    await user.type(within(dialog).getByLabelText("Monto"), "2500");
    await user.click(within(dialog).getByRole("button", { name: "Categoría de gasto" }));
    await user.click(within(within(dialog).getByRole("listbox")).getByRole("option", { name: "Empaque" }));
    await user.type(within(dialog).getByLabelText("Comentarios"), "Bolsas y cajas");
    await user.click(within(dialog).getByRole("button", { name: "Guardar movimiento" }));

    expect(auth.request).toHaveBeenCalledWith("/api/v1/finances/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Compra de empaques",
        movementDate: localMidnightTimestamp("2026-10-11"),
        financialMovementTypeId: 44,
        expenseCategoryId: 8,
        amount: 2500,
        comments: "Bolsas y cajas",
      }),
    });
    expect(await screen.findByText("Movimiento registrado correctamente.")).toBeVisible();
    expect(await screen.findByText("Compra de empaques")).toBeVisible();
    await waitFor(() => {
      const listRequests = auth.request.mock.calls.filter(([path]) => String(path).startsWith("/api/v1/finances/movements?"));
      expect(listRequests).toHaveLength(2);
    });
  });

  it("requires an explicit direction for an adjustment and omits the expense category", async () => {
    const user = userEvent.setup();
    mockFinanceApi();
    renderFinanceAt();

    await screen.findByText("Pago de proveedor");
    await user.click(await screen.findByRole("button", { name: "Registrar movimiento" }));
    const dialog = screen.getByRole("dialog", { name: "Registrar movimiento" });
    await user.click(within(dialog).getByRole("button", { name: "Tipo de movimiento" }));
    await user.click(within(within(dialog).getByRole("listbox")).getByRole("option", { name: "Ajuste" }));
    expect(within(dialog).getByLabelText("Dirección del ajuste")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Dirección del ajuste" })).toHaveAttribute("aria-required", "true");
    expect(within(dialog).queryByLabelText("Categoría de gasto")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Descripción"), "Corrección de caja");
    await user.click(within(dialog).getByRole("button", { name: "Dirección del ajuste" }));
    await user.click(within(within(dialog).getByRole("listbox")).getByRole("option", { name: "Ingreso" }));
    await user.type(within(dialog).getByLabelText("Monto"), "350");
    await user.click(within(dialog).getByRole("button", { name: "Guardar movimiento" }));

    expect(auth.request).toHaveBeenCalledWith("/api/v1/finances/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Corrección de caja",
        movementDate: localMidnightTimestamp(todayLocalDate()),
        financialMovementTypeId: 47,
        movementDirectionId: 1,
        amount: 350,
      }),
    });
  });

  it("keeps the form open and displays the API reason when creation fails", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/finances/movement-types") return jsonResponse([{ id: 45, name: "OwnerInvestment" }]);
      if (init?.method === "POST") return jsonResponse({ detail: "El movimiento no se pudo guardar." }, 400);
      return jsonResponse(listResponse());
    });
    renderFinanceAt();

    await screen.findByText("Pago de proveedor");
    await user.click(await screen.findByRole("button", { name: "Registrar movimiento" }));
    const dialog = screen.getByRole("dialog", { name: "Registrar movimiento" });
    await user.click(within(dialog).getByRole("button", { name: "Tipo de movimiento" }));
    await user.click(within(within(dialog).getByRole("listbox")).getByRole("option", { name: "Aporte de propietaria" }));
    await user.type(within(dialog).getByLabelText("Descripción"), "Aporte para caja");
    await user.type(within(dialog).getByLabelText("Monto"), "1");
    await user.click(within(dialog).getByRole("button", { name: "Guardar movimiento" }));

    expect(await within(dialog).findByText("El movimiento no se pudo guardar.")).toBeVisible();
    expect(dialog).toBeVisible();
  });

  it("shows permission state on 403 without write controls", async () => {
    auth.request.mockImplementation(() => jsonResponse({ detail: "No autorizado." }, 403));
    renderFinanceAt();

    expect(await screen.findByText("No tienes permiso para ver esta sección.")).toBeVisible();
    expect(within(screen.getByTestId("page-actions")).queryByRole("button", { name: "Registrar movimiento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nuevo|crear|editar|eliminar/i })).not.toBeInTheDocument();
  });
});
