import { describe, expect, it, vi } from "vitest";
import {
  createLoan,
  createLoanPayment,
  deleteLoan,
  loadLoan,
  loadLoanOwners,
  loadLoans,
  updateLoan,
  updateLoanPayment,
} from "./loans-api";
import type { Loan } from "./loans-types";
import type { AuthenticatedRequest } from "./finance-api";

function loanDto(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 1,
    loanDate: "2026-10-11T16:30:00Z",
    createdAt: "2026-10-11T16:30:00Z",
    loanOwnerId: 7,
    loanOwnerName: "María López",
    initialAmount: 5000,
    initialAmountUsd: 125,
    balance: 4000,
    interestPaidAmount: 50,
    closedAt: null,
    comments: "Préstamo para el negocio",
    exchangeRate: 40,
    isActive: true,
    payments: [{
      id: 15,
      paymentDate: "2026-10-12T17:00:00Z",
      createdAt: "2026-10-12T17:00:00Z",
      amount: 1000,
      interestAmount: 50,
      totalAmount: 1050,
      exchangeRate: 40,
      comments: "Primer abono",
    }],
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("loan API", () => {
  it("loads paginated loans with only the selected filters", async () => {
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse({
      items: [loanDto()],
      page: 2,
      pageSize: 10,
      totalCount: 11,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    }));

    const result = await loadLoans(request, {
      page: 2,
      pageSize: 10,
      loanOwnerId: 7,
      isActive: false,
    });

    expect(request).toHaveBeenCalledWith("/api/v1/loans?page=2&pageSize=10&loanOwnerId=7&isActive=false");
    expect(result).toMatchObject({ page: 2, totalCount: 11, items: [loanDto()] });
  });

  it("omits unset list filters and caps the page size at 100", async () => {
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse({
      items: [], page: 1, pageSize: 100, totalCount: 0,
    }));

    await loadLoans(request, {
      page: 0,
      pageSize: 500,
      loanOwnerId: null,
      isActive: null,
    });

    expect(request).toHaveBeenCalledWith("/api/v1/loans?page=1&pageSize=100");
  });

  it("loads one loan including its payments", async () => {
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse(loanDto()));

    const result = await loadLoan(request, 1);

    expect(request).toHaveBeenCalledWith("/api/v1/loans/1");
    expect(result.payments[0]).toMatchObject({ id: 15, amount: 1000, interestAmount: 50, totalAmount: 1050 });
  });

  it("loads responsible people with the confirmed DTO", async () => {
    const owners = [{ id: 1, name: "Nombre del responsable", enabled: true }];
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse(owners));

    await expect(loadLoanOwners(request)).resolves.toEqual(owners);
    expect(request).toHaveBeenCalledWith("/api/v1/loanowners");
  });

  it("creates a loan and returns the LoanDTO from the 201 response", async () => {
    const created = loanDto({ payments: [], balance: 5000 });
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse(created, 201));
    const input = { loanDate: "2026-10-11T16:30:00.000Z", loanOwnerId: 7, initialAmount: 5000, comments: "Préstamo para el negocio" };

    await expect(createLoan(request, input)).resolves.toEqual(created);

    expect(request).toHaveBeenCalledWith("/api/v1/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("updates a loan and returns the updated LoanDTO", async () => {
    const updated = loanDto({ initialAmount: 6000, balance: 6000, payments: [] });
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse(updated));
    const input = { loanDate: "2026-10-11T16:30:00.000Z", loanOwnerId: 7, initialAmount: 6000, comments: "Actualizado" };

    await expect(updateLoan(request, 1, input)).resolves.toEqual(updated);

    expect(request).toHaveBeenCalledWith("/api/v1/loans/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("deletes a loan without a request body", async () => {
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteLoan(request, 1)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith("/api/v1/loans/1", { method: "DELETE" });
  });

  it("registers a payment and returns the updated loan", async () => {
    const updated = loanDto({ balance: 4000 });
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse(updated));
    const input = { paymentDate: "2026-10-12T17:00:00.000Z", amount: 1000, interestAmount: 50, comments: "Primer abono" };

    await expect(createLoanPayment(request, 1, input)).resolves.toEqual(updated);

    expect(request).toHaveBeenCalledWith("/api/v1/loans/1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("updates a payment and returns the updated loan", async () => {
    const updated = loanDto({ balance: 4200 });
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse(updated));
    const input = { paymentDate: "2026-10-12T18:00:00.000Z", amount: 800, interestAmount: 25, comments: "Pago corregido" };

    await expect(updateLoanPayment(request, 1, 15, input)).resolves.toEqual(updated);

    expect(request).toHaveBeenCalledWith("/api/v1/loans/1/payments/15", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("surfaces backend validation details for loan failures", async () => {
    const request = vi.fn<AuthenticatedRequest>().mockResolvedValue(jsonResponse({ detail: "El monto debe ser mayor que cero." }, 400));

    await expect(loadLoan(request, 99)).rejects.toMatchObject({
      name: "FinanceApiError",
      status: 400,
      message: "El monto debe ser mayor que cero.",
    });
  });
});
