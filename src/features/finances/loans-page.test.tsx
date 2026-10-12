import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PageActionsProvider, usePageActions } from "../../shared/layout/page-actions-context";
import { ToastProvider } from "../../shared/ui/toast-provider";
import { LoansPage } from "./loans-page";

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({ useAuth: () => ({ request: auth.request }) }));

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function loan(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    loanDate: "2026-10-10T15:30:00Z",
    createdAt: "2026-10-10T15:30:00Z",
    loanOwnerId: 1,
    loanOwnerName: "María López",
    initialAmount: 5000,
    initialAmountUsd: 125,
    balance: 4000,
    interestPaidAmount: 100,
    closedAt: null,
    comments: "Capital de trabajo",
    exchangeRate: 40,
    isActive: true,
    payments: [],
    ...overrides,
  };
}

function pageResult(items = [loan()], overrides: Record<string, unknown> = {}) {
  return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPreviousPage: false, hasNextPage: false, ...overrides };
}

function ActionHost() {
  const { action, heading } = usePageActions();
  return <><div data-testid="heading">{heading?.title}</div><div data-testid="page-actions">{action}</div></>;
}

function renderPage(path = "/finances/loans") {
  return render(<MemoryRouter initialEntries={[path]}><ToastProvider><PageActionsProvider><LoansPage /><ActionHost /></PageActionsProvider></ToastProvider></MemoryRouter>);
}

function mockLoans(items = [loan()], overrides: Record<string, unknown> = {}) {
  auth.request.mockImplementation((path: string) => {
    if (path === "/api/v1/loanowners") return jsonResponse([{ id: 1, name: "María López", enabled: true }, { id: 2, name: "Deshabilitado", enabled: false }]);
    return jsonResponse(pageResult(items, overrides));
  });
}

afterEach(() => { cleanup(); auth.request.mockReset(); });

describe("LoansPage", () => {
  it("loads active loans by default and displays the agreed summary columns", async () => {
    mockLoans();
    renderPage();

    expect(await screen.findByRole("link", { name: "María López" })).toBeVisible();
    expect(screen.getByTestId("heading")).toHaveTextContent("Préstamos recibidos");
    expect(auth.request).toHaveBeenCalledWith("/api/v1/loans?page=1&pageSize=20&isActive=true");
    expect(screen.getByRole("columnheader", { name: "Monto inicial (C$)" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Equivalente (USD)" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Saldo pendiente" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Intereses pagados" })).toBeVisible();
    expect(screen.getByText("C$ 5,000.00")).toBeVisible();
    expect(screen.getByText("US$ 125.00")).toBeVisible();
    expect(screen.getByText("C$ 4,000.00")).toBeVisible();
  });

  it("applies status and owner filters and resets pagination", async () => {
    const user = userEvent.setup();
    mockLoans([loan()], { page: 3, totalPages: 3 });
    renderPage("/finances/loans?page=3&pageSize=20&isActive=false");
    await screen.findByRole("link", { name: "María López" });

    await user.click(screen.getByRole("button", { name: "Responsable" }));
    await user.click(within(screen.getByRole("listbox", { name: "Responsable" })).getByRole("option", { name: "María López" }));
    await waitFor(() => expect(auth.request).toHaveBeenLastCalledWith("/api/v1/loans?page=1&pageSize=20&loanOwnerId=1&isActive=false"));

    await user.click(screen.getByRole("button", { name: "Estado" }));
    await user.click(within(screen.getByRole("listbox", { name: "Estado" })).getByRole("option", { name: "Todos" }));
    await waitFor(() => expect(auth.request).toHaveBeenLastCalledWith("/api/v1/loans?page=1&pageSize=20&loanOwnerId=1"));
  });

  it("paginates using the API and preserves active filters", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/loanowners") return jsonResponse([{ id: 1, name: "María López", enabled: true }]);
      if (path.includes("page=2")) return jsonResponse(pageResult([loan({ id: 13, loanOwnerName: "Segunda página" })], { page: 2, totalCount: 21, totalPages: 2, hasPreviousPage: true }));
      return jsonResponse(pageResult([loan()], { totalCount: 21, totalPages: 2, hasNextPage: true }));
    });
    renderPage("/finances/loans?loanOwnerId=1&isActive=true");
    await screen.findByRole("link", { name: "María López" });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("Segunda página")).toBeVisible();
    expect(auth.request).toHaveBeenLastCalledWith("/api/v1/loans?page=2&pageSize=20&loanOwnerId=1&isActive=true");
  });

  it("shows an empty state and supports retry after a list error", async () => {
    let failed = true;
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/loanowners") return jsonResponse([]);
      return failed ? Promise.resolve(new Response(JSON.stringify({ title: "Service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } })) : jsonResponse(pageResult([]));
    });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los préstamos");
    failed = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Aún no hay préstamos recibidos")).toBeVisible();
  });

  it("offers creation from the page action and only enabled owners", async () => {
    const user = userEvent.setup();
    mockLoans([]);
    renderPage();
    await screen.findByText("Aún no hay préstamos recibidos");
    await user.click(await within(screen.getByTestId("page-actions")).findByRole("button", { name: "Nuevo préstamo" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo préstamo" });
    await user.click(within(dialog).getByRole("button", { name: "Responsable" }));
    expect(within(screen.getByRole("listbox", { name: "Responsable" })).getByRole("option", { name: "María López" })).toBeVisible();
    expect(within(screen.getByRole("listbox", { name: "Responsable" })).queryByRole("option", { name: "Deshabilitado" })).not.toBeInTheDocument();
  });

  it("explains when no enabled loan owners are available", async () => {
    auth.request.mockImplementation((path: string) => path === "/api/v1/loanowners" ? jsonResponse([{ id: 2, name: "Deshabilitado", enabled: false }]) : jsonResponse(pageResult([])));
    renderPage();
    await screen.findByText("Aún no hay préstamos recibidos");
    expect(within(screen.getByTestId("page-actions")).queryByRole("button", { name: "Nuevo préstamo" })).not.toBeInTheDocument();
    expect(screen.getByText("No hay responsables habilitados para crear un préstamo.")).toBeVisible();
  });
});
