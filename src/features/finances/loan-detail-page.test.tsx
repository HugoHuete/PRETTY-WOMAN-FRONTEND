import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PageActionsProvider, usePageActions } from "../../shared/layout/page-actions-context";
import { ToastProvider } from "../../shared/ui/toast-provider";
import { LoanDetailPage } from "./loan-detail-page";
import type { Loan } from "./loans-types";

const auth = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../auth/auth-provider", () => ({ useAuth: () => ({ request: auth.request }) }));

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function loan(overrides: Partial<Loan> = {}): Loan {
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
    payments: [{ id: 3, paymentDate: "2026-10-11T16:30:00Z", createdAt: "2026-10-11T16:30:00Z", amount: 1000, interestAmount: 100, totalAmount: 1100, exchangeRate: 40, comments: "Primer abono" }],
    ...overrides,
  };
}

function ActionHost() {
  const { action, heading } = usePageActions();
  return <><nav aria-label="Breadcrumb">{heading?.breadcrumbs}</nav><h1>{heading?.title}</h1><div data-testid="page-actions">{action}</div></>;
}

function renderDetail() {
  return render(<MemoryRouter initialEntries={["/finances/loans/12"]}><ToastProvider><PageActionsProvider><Routes><Route path="/finances/loans/:id" element={<LoanDetailPage />} /></Routes><ActionHost /></PageActionsProvider></ToastProvider></MemoryRouter>);
}

afterEach(() => { cleanup(); auth.request.mockReset(); });

describe("LoanDetailPage", () => {
  it("shows loan summary and complete payment history with edit actions", async () => {
    auth.request.mockResolvedValue(jsonResponse(loan()));
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Detalle del préstamo" })).toBeVisible();
    expect(screen.getByRole("link", { name: "← Préstamos" })).toHaveAttribute("href", "/finances/loans");
    const summary = screen.getByRole("region", { name: "Resumen del préstamo" });
    expect(within(summary).getByText("María López")).toBeVisible();
    expect(within(summary).getByText("Activo")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Volver a préstamos" })).not.toBeInTheDocument();
    expect(screen.getByText("C$ 5,000.00")).toBeVisible();
    expect(screen.getByText("US$ 125.00")).toBeVisible();
    expect(screen.getByText("C$ 4,000.00")).toBeVisible();
    expect(screen.getAllByText("C$ 100.00")).toHaveLength(2);
    expect(screen.getByText("Primer abono")).toBeVisible();
    expect(screen.getByText("C$ 1,100.00")).toBeVisible();
    const paymentsHeading = screen.getByRole("heading", { name: "Historial de pagos" });
    const paymentsCount = screen.getByText("1 pago registrado");
    expect(paymentsHeading.parentElement).toBe(paymentsCount.parentElement);
    expect(await within(screen.getByTestId("page-actions")).findByRole("button", { name: "Registrar pago" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Editar pago 3" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Eliminar pago/ })).not.toBeInTheDocument();
    expect(auth.request).toHaveBeenCalledWith("/api/v1/loans/12");
  });

  it("hides loan edit and delete once payments exist", async () => {
    auth.request.mockResolvedValue(jsonResponse(loan()));
    renderDetail();
    await screen.findByText("Capital de trabajo");
    expect(screen.queryByRole("button", { name: "Editar préstamo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar préstamo" })).not.toBeInTheDocument();
  });

  it("allows editing/deleting an unpaid loan and requires delete confirmation", async () => {
    const user = userEvent.setup();
    const unpaid = loan({ payments: [], balance: 5000, interestPaidAmount: 0 });
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/loanowners") return jsonResponse([{ id: 1, name: "María López", enabled: true }]);
      if (path === "/api/v1/loans/12" && init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      return jsonResponse(unpaid);
    });
    renderDetail();
    await screen.findByText("Capital de trabajo");
    await user.click(screen.getByRole("button", { name: "Editar préstamo" }));
    expect(await screen.findByRole("dialog", { name: "Editar préstamo" })).toBeVisible();
    await user.click(within(screen.getByRole("dialog", { name: "Editar préstamo" })).getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar préstamo" }));
    expect(screen.getByRole("dialog", { name: "Eliminar préstamo" })).toBeVisible();
    expect(auth.request).not.toHaveBeenCalledWith("/api/v1/loans/12", { method: "DELETE" });
  });

  it("uses the updated loan DTO after recording a payment and shows a toast", async () => {
    const user = userEvent.setup();
    const before = loan({ payments: [], balance: 5000, interestPaidAmount: 0 });
    const after = loan({ balance: 4000, interestPaidAmount: 50, payments: [{ id: 9, paymentDate: "2026-10-11T16:30:00Z", createdAt: "2026-10-11T16:30:00Z", amount: 1000, interestAmount: 50, totalAmount: 1050, exchangeRate: 40, comments: "Abono" }] });
    auth.request.mockImplementation((path: string, init?: RequestInit) => path.endsWith("/payments") && init?.method === "POST" ? jsonResponse(after) : jsonResponse(before));
    renderDetail();
    await screen.findByText("Capital de trabajo");
    await user.click(await within(screen.getByTestId("page-actions")).findByRole("button", { name: "Registrar pago" }));
    const dialog = screen.getByRole("dialog", { name: "Registrar pago" });
    await user.type(within(dialog).getByLabelText("Abono al principal (C$)"), "1000");
    await user.type(within(dialog).getByLabelText("Intereses (C$)"), "50");
    await user.type(within(dialog).getByLabelText(/^Comentarios/), "Abono");
    await user.click(within(dialog).getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Pago registrado correctamente.");
    expect(await screen.findByText("C$ 4,000.00")).toBeVisible();
    expect(screen.getByText("C$ 1,050.00")).toBeVisible();
    expect(auth.request).toHaveBeenCalledWith("/api/v1/loans/12/payments", expect.objectContaining({ method: "POST" }));
  });

  it("shows a retry state when the loan no longer exists", async () => {
    auth.request.mockResolvedValue(new Response(JSON.stringify({ title: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } }));
    renderDetail();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar el préstamo");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});
