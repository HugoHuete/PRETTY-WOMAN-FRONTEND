import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaleDetailClient } from "./sale-detail-client";
import type { SaleDetail } from "./sales-types";

vi.mock("./sale-client-fields", () => ({ SaleClientFields: ({ onSelect }: { onSelect: (client: unknown) => void }) => <button type="button" onClick={() => onSelect({ id: 7, name: "Ana" })}>Elegir clienta</button> }));
const sale = { id: 1, clientName: null } as SaleDetail;

describe("clienta del detalle de venta", () => {
  it("asocia la clienta elegida y cierra el diálogo tras guardar", async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const onSave = vi.fn().mockResolvedValue(true);
    render(<SaleDetailClient sale={sale} client={null} isAdmin busy={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar o crear clienta" }));
    const dialog = screen.getByRole("dialog", { name: "Buscar o crear clienta" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Elegir clienta" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ id: 7, name: "Ana" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("mantiene abierto el diálogo cuando falla la asociación", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<SaleDetailClient sale={sale} client={null} isAdmin busy={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar o crear clienta" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Elegir clienta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo asociar");
  });
});
