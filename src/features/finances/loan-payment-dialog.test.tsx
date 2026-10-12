import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "./finance-api";
import { LoanPaymentDialog } from "./loan-payment-dialog";
import type { Loan, LoanPayment } from "./loans-types";

const request = vi.fn<AuthenticatedRequest>();

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 6,
    loanDate: "2026-10-11T16:30:00Z",
    createdAt: "2026-10-11T16:30:00Z",
    loanOwnerId: 1,
    loanOwnerName: "María López",
    initialAmount: 5000,
    initialAmountUsd: 125,
    balance: 4000,
    interestPaidAmount: 50,
    closedAt: null,
    comments: null,
    exchangeRate: 40,
    isActive: true,
    payments: [],
    ...overrides,
  };
}

const existingPayment: LoanPayment = {
  id: 15,
  paymentDate: "2026-10-12T17:00:00Z",
  createdAt: "2026-10-12T17:00:00Z",
  amount: 1000,
  interestAmount: 50,
  totalAmount: 1050,
  exchangeRate: 40,
  comments: "Primer abono",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function renderDialog(values: Partial<React.ComponentProps<typeof LoanPaymentDialog>> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<LoanPaymentDialog open request={request} loan={loan()} onSaved={onSaved} onClose={onClose} {...values} />);
  return { onSaved, onClose };
}

afterEach(() => {
  cleanup();
  request.mockReset();
});

describe("LoanPaymentDialog", () => {
  it("registers a payment with principal and interest separately", async () => {
    const user = userEvent.setup();
    const updated = loan({ balance: 3000 });
    request.mockResolvedValue(response(updated));
    const { onSaved } = renderDialog();

    await user.type(screen.getByLabelText("Abono al principal (C$)"), "1000");
    await user.type(screen.getByLabelText("Intereses (C$)"), "50");
    fireEvent.change(screen.getByLabelText("Fecha y hora"), { target: { value: "2026-10-12T11:00" } });
    await user.type(screen.getByLabelText(/^Comentarios/), "Primer abono");
    expect(screen.getByText("C$ 1,050.00")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(request).toHaveBeenCalledWith("/api/v1/loans/6/payments", expect.objectContaining({ method: "POST" })));
    const [, init] = request.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      paymentDate: new Date("2026-10-12T11:00").toISOString(),
      amount: 1000,
      interestAmount: 50,
      comments: "Primer abono",
    });
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it("allows principal equal to the balance and blocks a larger payment", async () => {
    const user = userEvent.setup();
    request.mockResolvedValue(response(loan({ balance: 0, isActive: false })));
    renderDialog({ loan: loan({ balance: 1000 }) });
    const amount = screen.getByLabelText("Abono al principal (C$)");

    await user.type(amount, "1000");
    expect(amount).toHaveAttribute("max", "1000");
    await user.clear(amount);
    await user.type(amount, "1000.01");
    await user.click(screen.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El abono al principal no puede superar el saldo disponible.");
    expect(request).not.toHaveBeenCalled();
  });

  it("includes the replaced principal in the available amount when editing a payment", async () => {
    const user = userEvent.setup();
    const updated = loan({ balance: 300 });
    request.mockResolvedValue(response(updated));
    const { onSaved } = renderDialog({ loan: loan({ balance: 1000 }), payment: existingPayment });
    const amount = screen.getByLabelText("Abono al principal (C$)");

    expect(amount).toHaveAttribute("max", "2000");
    await user.clear(amount);
    await user.type(amount, "1500");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(request).toHaveBeenCalledWith("/api/v1/loans/6/payments/15", expect.objectContaining({ method: "PUT" })));
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it("keeps entered payment values after a backend validation error", async () => {
    const user = userEvent.setup();
    request.mockResolvedValue(response({ detail: "El interés no es válido." }, 400));
    renderDialog();

    await user.type(screen.getByLabelText("Abono al principal (C$)"), "700");
    await user.type(screen.getByLabelText("Intereses (C$)"), "0");
    await user.type(screen.getByLabelText(/^Comentarios/), "Pago en caja");
    await user.click(screen.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El interés no es válido.");
    expect(screen.getByLabelText("Abono al principal (C$)")).toHaveValue(700);
    expect(screen.getByLabelText(/^Comentarios/)).toHaveValue("Pago en caja");
  });

  it("enforces zero-or-more interest and the payment comment limit", () => {
    renderDialog();

    expect(screen.getByLabelText("Intereses (C$)")).toHaveAttribute("min", "0");
    expect(screen.getByLabelText(/^Comentarios/)).toHaveAttribute("maxLength", "300");
    const optionalHint = screen.getByText("(opcional)");
    expect(optionalHint.parentElement).toHaveClass("flex", "items-center");
    expect(optionalHint.parentElement).toHaveTextContent("Comentarios(opcional)");
  });
});
