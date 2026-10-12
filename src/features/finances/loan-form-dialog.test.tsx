import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "./finance-api";
import { LoanFormDialog } from "./loan-form-dialog";
import type { Loan, LoanOwner } from "./loans-types";

const request = vi.fn<AuthenticatedRequest>();
const owners: LoanOwner[] = [
  { id: 1, name: "María López", enabled: true },
  { id: 2, name: "Responsable deshabilitada", enabled: false },
];

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 6,
    loanDate: "2026-10-11T16:30:00Z",
    createdAt: "2026-10-11T16:30:00Z",
    loanOwnerId: 1,
    loanOwnerName: "María López",
    initialAmount: 5000,
    initialAmountUsd: 125,
    balance: 5000,
    interestPaidAmount: 0,
    closedAt: null,
    comments: "Uso operativo",
    exchangeRate: 40,
    isActive: true,
    payments: [],
    ...overrides,
  };
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function renderForm(values: Partial<React.ComponentProps<typeof LoanFormDialog>> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<LoanFormDialog open request={request} owners={owners} onSaved={onSaved} onClose={onClose} {...values} />);
  return { onSaved, onClose };
}

afterEach(() => {
  cleanup();
  request.mockReset();
});

describe("LoanFormDialog", () => {
  it("defaults the new-loan datetime to the current local moment", () => {
    renderForm();

    const date = new Date();
    const expected = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-")
      + `T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    expect(screen.getByLabelText("Fecha y hora")).toHaveValue(expected);
  });

  it("creates a loan with the selected enabled owner and UTC datetime", async () => {
    const user = userEvent.setup();
    request.mockResolvedValue(response(loan()));
    const { onSaved } = renderForm();

    await user.click(screen.getByRole("button", { name: "Responsable" }));
    await user.click(within(screen.getByRole("listbox", { name: "Responsable" })).getByRole("option", { name: "María López" }));
    await user.type(screen.getByLabelText("Monto inicial (C$)"), "5000");
    fireEvent.change(screen.getByLabelText("Fecha y hora"), { target: { value: "2026-10-11T10:30" } });
    await user.type(screen.getByLabelText(/^Comentarios/), "Uso operativo");
    await user.click(screen.getByRole("button", { name: "Crear préstamo" }));

    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    const [, init] = request.mock.calls[0] as [string, RequestInit];
    expect(request).toHaveBeenCalledWith("/api/v1/loans", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(init.body))).toMatchObject({
      loanDate: new Date("2026-10-11T10:30").toISOString(),
      loanOwnerId: 1,
      initialAmount: 5000,
      comments: "Uso operativo",
    });
    expect(onSaved).toHaveBeenCalledWith(loan());
  });

  it("omits a cleared optional date and retains entered values after API validation fails", async () => {
    const user = userEvent.setup();
    request.mockResolvedValue(response({ detail: "Revisa el responsable." }, 400));
    renderForm();

    await user.click(screen.getByRole("button", { name: "Responsable" }));
    await user.click(within(screen.getByRole("listbox", { name: "Responsable" })).getByRole("option", { name: "María López" }));
    await user.type(screen.getByLabelText("Monto inicial (C$)"), "5400");
    fireEvent.change(screen.getByLabelText("Fecha y hora"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Crear préstamo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Revisa el responsable.");
    const [, init] = request.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("loanDate");
    expect(screen.getByLabelText("Monto inicial (C$)")).toHaveValue(5400);
  });

  it("edits an unpaid loan with its existing values", async () => {
    const user = userEvent.setup();
    const updated = loan({ initialAmount: 6000, balance: 6000, comments: "Actualizado" });
    request.mockResolvedValue(response(updated));
    const { onSaved } = renderForm({ loan: loan() });

    expect(screen.getByRole("heading", { name: "Editar préstamo" })).toBeVisible();
    expect(screen.getByLabelText("Monto inicial (C$)")).toHaveValue(5000);
    fireEvent.change(screen.getByLabelText("Monto inicial (C$)"), { target: { value: "6000" } });
    fireEvent.change(screen.getByLabelText(/^Comentarios/), { target: { value: "Actualizado" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(request).toHaveBeenCalledWith("/api/v1/loans/6", expect.objectContaining({ method: "PUT" })));
    const [, init] = request.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ loanOwnerId: 1, initialAmount: 6000, comments: "Actualizado" });
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it("does not offer disabled responsible people and enforces the comment limit", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Responsable" }));

    expect(screen.queryByRole("option", { name: "Responsable deshabilitada" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByLabelText(/^Comentarios/)).toHaveAttribute("maxLength", "500");
  });
});
