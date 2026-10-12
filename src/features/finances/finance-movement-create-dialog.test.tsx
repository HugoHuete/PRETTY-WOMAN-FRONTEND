import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceMovementCreateDialog } from "./finance-movement-create-dialog";

const request = vi.fn();
const todayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function renderDialog() {
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  render(<FinanceMovementCreateDialog
    isOpen
    onOpenChange={onOpenChange}
    request={request}
    movementTypes={[{ id: 1, name: "OwnerInvestment", label: "Aporte de propietaria" }]}
    onSaved={onSaved}
  />);
  return { onSaved, onOpenChange };
}

afterEach(() => {
  cleanup();
  request.mockReset();
});

describe("FinanceMovementCreateDialog", () => {
  it("defaults the date to today and omits the explanatory subtitle", () => {
    renderDialog();

    expect(screen.getByLabelText("Fecha")).toHaveValue(todayLocal());
    expect(screen.queryByText("Los movimientos de ventas, compras y préstamos se registran desde sus propios módulos.")).not.toBeInTheDocument();
  });

  it("submits the selected calendar date as a local-midnight timestamp", async () => {
    const user = userEvent.setup();
    request.mockResolvedValue(new Response(null, { status: 201 }));
    const { onSaved } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Tipo de movimiento" }));
    await user.click(within(screen.getByRole("listbox", { name: "Tipo de movimiento" })).getByRole("option", { name: "Aporte de propietaria" }));
    await user.type(screen.getByLabelText("Descripción"), "Aporte inicial");
    await user.type(screen.getByLabelText("Monto"), "250");
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-11" } });
    await user.click(screen.getByRole("button", { name: "Guardar movimiento" }));

    await waitFor(() => expect(request).toHaveBeenCalled());
    const [, init] = request.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      description: "Aporte inicial",
      movementDate: new Date("2026-10-11T00:00:00").toISOString(),
    });
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
