import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaleClientEditButton } from "./sale-client-edit-button";
import { SaleDetailClient } from "./sale-detail-client";
import type { SaleDetail } from "./sales-types";

const api = vi.hoisted(() => ({
  getSaleClients: vi.fn().mockResolvedValue({ items: [{ id: 7, name: "Ana" }], page: 1, totalPages: 1, totalCount: 1 }),
  getSaleClient: vi.fn().mockResolvedValue({ id: 7, name: "Ana", phone: "89494589", isFriend: true, comments: "Nota" }),
  updateSaleClient: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./sales-api", () => api);
vi.mock("../auth/auth-provider", () => ({ useAuth: () => ({ request: requestMock }) }));
const requestMock = vi.hoisted(() => vi.fn());

const sale = { id: 1, clientName: null } as SaleDetail;

async function selectAna(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: "Ana" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Buscar clienta" }));
  fireEvent.click(await screen.findByRole("button", { name: "Seleccionar" }));
}

describe("clienta del detalle de venta", () => {
  it("asocia la clienta elegida y cierra el diálogo tras guardar", async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const onSave = vi.fn().mockResolvedValue(true);
    render(<SaleDetailClient sale={sale} client={null} isAdmin busy={false} onSave={onSave} onClientUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar o crear clienta" }));
    const dialog = screen.getByRole("dialog", { name: "Buscar o crear clienta" });
    await selectAna(dialog);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 7, name: "Ana" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("actualiza el borrador tras una asociación fallida y espera un reintento explícito", async () => {
    const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<SaleDetailClient sale={sale} client={null} isAdmin busy={false} onSave={onSave} onClientUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar o crear clienta" }));
    const associationDialog = screen.getByRole("dialog", { name: "Buscar o crear clienta" });
    await selectAna(associationDialog);
    expect(await within(associationDialog).findByRole("alert")).toHaveTextContent("No se pudo asociar");

    fireEvent.click(within(associationDialog).getByRole("button", { name: "Editar clienta" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar clienta" }));
    fireEvent.change(await editor.findByLabelText("Nombre"), { target: { value: "Ana María" } });
    fireEvent.click(editor.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar clienta" })).not.toBeInTheDocument());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(within(associationDialog).getByText("Ana María")).toBeInTheDocument();

    fireEvent.click(within(associationDialog).getByRole("button", { name: "Reintentar asociación" }));
    expect(onSave).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 7, name: "Ana María" }));
    await waitFor(() => expect(associationDialog).not.toBeInTheDocument());
  });
  it("oculta el editor mientras el perfil cargado pertenece a la asociación anterior", () => {
    const props = { isAdmin: true, busy: false, onSave: vi.fn(), onClientUpdated: vi.fn() };
    const { rerender } = render(<SaleDetailClient {...props} sale={{ ...sale, clientId: 7 }} client={{ id: 7, name: "Ana" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar clienta" }));
    expect(screen.getByRole("dialog", { name: "Editar clienta" })).toBeVisible();

    rerender(<SaleDetailClient {...props} sale={{ ...sale, clientId: 8 }} client={{ id: 7, name: "Ana" }} />);
    expect(screen.queryByRole("dialog", { name: "Editar clienta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar clienta" })).not.toBeInTheDocument();

    rerender(<SaleDetailClient {...props} sale={{ ...sale, clientId: 8 }} client={{ id: 8, name: "Bea" }} />);
    expect(screen.getByRole("button", { name: "Editar clienta" })).toBeEnabled();
  });

  it("descarta el formulario anterior cuando cambia el ID del perfil", async () => {
    const onUpdated = vi.fn();
    api.getSaleClient.mockResolvedValueOnce({ id: 7, name: "Ana" }).mockResolvedValueOnce({ id: 8, name: "Bea" });
    const { rerender } = render(<SaleClientEditButton client={{ id: 7, name: "Ana" }} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar clienta" }));
    const name = await screen.findByLabelText("Nombre");
    fireEvent.change(name, { target: { value: "Nombre sin guardar" } });

    rerender(<SaleClientEditButton client={{ id: 8, name: "Bea" }} onUpdated={onUpdated} />);
    expect(screen.queryByDisplayValue("Nombre sin guardar")).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("Bea")).toBeVisible();
  });

  it("edita la ficha de la clienta sin volver a asociarla a la venta", async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const onSave = vi.fn();
    const onClientUpdated = vi.fn();
    render(<SaleDetailClient sale={{ ...sale, clientId: 7 }} client={{ id: 7, name: "Ana" }} isAdmin busy={false} onSave={onSave} onClientUpdated={onClientUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar clienta" }));
    const dialog = within(screen.getByRole("dialog", { name: "Editar clienta" }));
    const phone = await dialog.findByLabelText("Teléfono");
    expect(phone).toHaveValue("89494589");
    fireEvent.change(phone, { target: { value: "8858-1572" } });
    fireEvent.click(dialog.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClientUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 7, phone: "88581572" })));
    expect(api.updateSaleClient).toHaveBeenCalledWith(requestMock, 7, expect.objectContaining({ phoneNumber: "88581572", isFriend: true, comments: "Nota" }));
    expect(onSave).not.toHaveBeenCalled();
  });
  it("combina los campos editados con el perfil más reciente", async () => {
    const initial = { id: 7, name: "Ana", phone: "89494589", address: "Dirección anterior", isFriend: false, comments: "Nota anterior" };
    const latest = { ...initial, name: "Ana López", address: "Dirección nueva", isFriend: true, comments: "Nota nueva" };
    api.getSaleClient.mockResolvedValueOnce(initial).mockResolvedValueOnce(latest);
    const onClientUpdated = vi.fn();
    render(<SaleDetailClient sale={{ ...sale, clientId: initial.id }} client={initial} isAdmin busy={false} onSave={vi.fn()} onClientUpdated={onClientUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar clienta" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar clienta" }));
    fireEvent.change(await editor.findByLabelText("Teléfono"), { target: { value: "8858-1572" } });
    fireEvent.click(editor.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClientUpdated).toHaveBeenCalledWith(expect.objectContaining({ ...latest, phone: "88581572" })));
    expect(api.updateSaleClient).toHaveBeenLastCalledWith(requestMock, 7, expect.objectContaining({
      name: latest.name, phoneNumber: "88581572", address: latest.address, isFriend: true, comments: latest.comments,
    }));
  });

  it("quita el prefijo de Instagram antes de guardar", async () => {
    const onClientUpdated = vi.fn();
    render(<SaleDetailClient sale={{ ...sale, clientId: 7 }} client={{ id: 7, name: "Ana" }} isAdmin busy={false} onSave={vi.fn()} onClientUpdated={onClientUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar clienta" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar clienta" }));
    fireEvent.change(await editor.findByLabelText("Usuario de Instagram"), { target: { value: " @Ana.Tienda " } });
    fireEvent.click(editor.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClientUpdated).toHaveBeenCalledWith(expect.objectContaining({ instagram: "ana.tienda" })));
    expect(api.updateSaleClient).toHaveBeenLastCalledWith(requestMock, 7, expect.objectContaining({ instagramUser: "ana.tienda" }));
  });

  it.each([
    ["Nombre", 100],
    ["Usuario de Instagram", 50],
    ["Usuario de Messenger", 50],
    ["Dirección", 350],
  ])("rechaza %s si supera el límite antes de llamar a la API", async (label, maxLength) => {
    api.updateSaleClient.mockClear();
    render(<SaleDetailClient sale={{ ...sale, clientId: 7 }} client={{ id: 7, name: "Ana" }} isAdmin busy={false} onSave={vi.fn()} onClientUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar clienta" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar clienta" }));
    const field = await editor.findByLabelText(label);
    expect(field).toHaveAttribute("maxlength", String(maxLength));
    fireEvent.change(field, { target: { value: "x".repeat(maxLength + 1) } });
    fireEvent.click(editor.getByRole("button", { name: "Guardar cambios" }));
    expect(await editor.findByRole("alert")).toHaveTextContent(`${label} admite hasta ${maxLength} caracteres.`);
    expect(api.updateSaleClient).not.toHaveBeenCalled();
  });
});
