import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShipmentClientDialog } from "./shipment-client-dialog";

function renderClient(isAdmin: boolean) {
  const request = vi.fn().mockResolvedValueOnce(Response.json({
    id: 7, name: "Ana Pérez", phoneNumber: "12345678", address: "Managua", isBlocked: false,
  })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  render(<ShipmentClientDialog clientId={7} isAdmin={isAdmin} request={request} onClose={vi.fn()} />);
  return request;
}

describe("Ficha de clienta desde envíos", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
  });

  it("solicita un motivo y refleja el bloqueo confirmado", async () => {
    const request = renderClient(true);
    expect(await screen.findByText("12345678")).toBeVisible();
    expect(request).toHaveBeenCalledWith("/api/v1/clients/7");
    fireEvent.click(screen.getByRole("button", { name: "Bloquear clienta" }));
    const confirm = screen.getByRole("button", { name: "Confirmar bloqueo" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo del bloqueo"), { target: { value: " Motivo de prueba " } });
    fireEvent.click(confirm);
    expect(await screen.findByText("Bloqueada")).toBeVisible();
    expect(request).toHaveBeenCalledWith("/api/v1/clients/7/block", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ blockedReason: "Motivo de prueba" }),
    }));
    expect(screen.getByText("Motivo de prueba")).toBeVisible();
  });

  it("permite consultar la ficha sin permisos de bloqueo", async () => {
    renderClient(false);
    expect(await screen.findByText("Managua")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bloquear clienta" })).not.toBeInTheDocument();
  });
});
