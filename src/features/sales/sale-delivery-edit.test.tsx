import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleDetailLogistics } from "./sale-detail-logistics";
import type { SaleDelivery, SaleDetail } from "./sales-types";

vi.mock("../auth/auth-provider", () => ({ useAuth: () => ({ request }) }));
const request = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({
  getSaleClient: vi.fn().mockResolvedValue({ id: 7, name: "Ana", phone: "89494589" }),
  getSaleClients: vi.fn(),
  createSaleClient: vi.fn(),
  updateSaleClient: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./sales-api", () => api);

function renderDelivery(deliveryStatusId: number, saleStatusId = 2, clientId: number | null = null, onClientUpdated = vi.fn(), deliveryAddress: string | null = "Dirección actual") {
  const delivery = {
    id: 4, createdAt: "2026-01-01", code: "ENV-4", deliveryStatusId,
    shippingChargedToClient: 80, deliveryAddress, clientId,
    municipalityId: 1, municipalityName: "Managua", deliveryAgencyId: 1, deliveryAgencyName: "Anterior",
  } as SaleDelivery;
  const sale = {
    id: 1, saleChannelId: 2, saleStatusId, clientId, salePaymentStatusId: 3,
    deliveries: [delivery], selectionHolds: [], paymentMovements: [],
  } as unknown as SaleDetail;
  const onEdit = vi.fn().mockResolvedValue(true);

  render(<SaleDetailLogistics sale={sale} isAdmin={false} busy={false}
    municipalities={[{ id: 2, name: "Masaya", departmentId: 2, departmentName: "Masaya" }]}
    deliveryAgencies={[{ id: 2, name: "Nueva agencia", enabled: true, phoneNumber: "", canCollectCashOnDelivery: false }]}
    deliveryCatalogLoading={false} deliveryCatalogError={null} onRetryDeliveryCatalogs={vi.fn()}
    onDeliveryClientSelected={onClientUpdated} onDeliveryAction={vi.fn()} onEditDelivery={onEdit} onCreateDelivery={vi.fn()} onCompletePickup={vi.fn()} />);
  return onEdit;
}

describe("edición del envío de una venta", () => {
  beforeEach(() => {
    api.getSaleClient.mockReset().mockResolvedValue({ id: 7, name: "Ana", phone: "89494589" });
    api.getSaleClients.mockReset();
    api.createSaleClient.mockReset();
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
  });

  it.each([
    ["Agencia", "Agencia de envío"],
    ["Municipio", "Municipio de entrega"],
  ])("abre el selector visible al pulsar la etiqueta %s", (label, name) => {
    renderDelivery(1);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    const visibleLabel = editor.getByText(label, { selector: "label" }) as HTMLLabelElement;
    expect(visibleLabel.control).toBe(editor.getByRole("button", { name }));
    fireEvent.click(visibleLabel);
    expect(screen.getByRole("listbox", { name })).toBeVisible();
  });

  it("conserva la dirección enviada al crear la nueva clienta si falla la consulta del perfil", async () => {
    api.getSaleClient.mockResolvedValueOnce({ id: 7, name: "Ana" }).mockRejectedValueOnce(new Error("Sin conexión"));
    api.getSaleClients.mockResolvedValue({ items: [], page: 1, totalPages: 1, totalCount: 0 });
    api.createSaleClient.mockResolvedValueOnce(8);
    const onEdit = renderDelivery(1, 2, 7, vi.fn(), null);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    await editor.findByText("Ana");
    fireEvent.click(editor.getByRole("button", { name: "Cambiar clienta" }));
    fireEvent.change(editor.getByLabelText("Nombre *"), { target: { value: "Bea" } });
    fireEvent.change(editor.getByLabelText("Teléfono *"), { target: { value: "88581572" } });
    fireEvent.change(editor.getByLabelText("Dirección (opcional)"), { target: { value: " Dirección de Bea " } });
    fireEvent.click(editor.getByRole("button", { name: "Crear clienta" }));

    const recipientAddress = await editor.findByRole("radio", { name: /Usar la dirección de la nueva clienta/ });
    await waitFor(() => expect(recipientAddress).toBeEnabled());
    fireEvent.click(recipientAddress);
    fireEvent.click(editor.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(4, { clientId: 8, deliveryAddress: "Dirección de Bea" }));
  });

  it("permite a un vendedor cambiar agencia y municipio de un envío pendiente", async () => {
    const onEdit = renderDelivery(1);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    expect(editor.getByLabelText("Código del envío")).toHaveValue("ENV-4");
    fireEvent.click(editor.getByRole("button", { name: "Agencia de envío" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Agencia de envío" })).getByRole("option", { name: "Nueva agencia" }));
    fireEvent.click(editor.getByRole("button", { name: "Municipio de entrega" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Municipio de entrega" })).getByRole("option", { name: "Masaya · Masaya" }));
    fireEvent.click(editor.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(4, { deliveryAgencyId: 2, municipalityId: 2 }));
    expect(screen.queryByRole("dialog", { name: "Editar envío" })).not.toBeInTheDocument();
  });

  it.each(["pendiente", "disponible", "sin cambios"])("omite la dirección sugerida al guardar con la consulta %s", async (state) => {
    const profile = { id: 7, name: "Ana", address: "Dirección del perfil" };
    let finishLookup!: (client: typeof profile) => void;
    api.getSaleClient.mockReturnValueOnce(new Promise<typeof profile>((resolve) => { finishLookup = resolve; }));
    const onEdit = renderDelivery(1, 2, 7, vi.fn(), null);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    if (state !== "pendiente") {
      await act(async () => { finishLookup(profile); });
      expect(editor.getByText("Dirección del perfil")).toBeVisible();
    }
    expect(editor.getByLabelText("Dirección de entrega")).toHaveValue("");
    if (state !== "sin cambios") {
      fireEvent.change(editor.getByLabelText("Código del envío"), { target: { value: "ENV-5" } });
    }
    const save = editor.getByRole("button", { name: "Guardar cambios" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar envío" })).not.toBeInTheDocument());
    if (state === "sin cambios") {
      expect(onEdit).not.toHaveBeenCalled();
    } else {
      expect(onEdit).toHaveBeenCalledWith(4, { code: "ENV-5" });
    }
  });

  it("guarda la dirección sugerida después de elegirla", async () => {
    api.getSaleClient.mockResolvedValueOnce({ id: 7, name: "Ana", address: "Dirección del perfil" });
    const onEdit = renderDelivery(1, 2, 7, vi.fn(), null);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    await editor.findByText("Ana");
    fireEvent.click(editor.getByRole("button", { name: "Usar dirección del perfil" }));
    expect(editor.getByLabelText("Dirección de entrega")).toHaveValue("Dirección del perfil");
    fireEvent.change(editor.getByLabelText("Código del envío"), { target: { value: "ENV-5" } });
    fireEvent.click(editor.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(4, { code: "ENV-5", deliveryAddress: "Dirección del perfil" }));
  });

  it("conserva la dirección recién editada cuando la consulta inicial llega tarde", async () => {
    const previousClient = { id: 7, name: "Ana", phone: "89494589", address: "Dirección anterior" };
    let resolveInitialLookup!: (client: typeof previousClient) => void;
    const initialLookup = new Promise<typeof previousClient>((resolve) => { resolveInitialLookup = resolve; });
    api.getSaleClient.mockReturnValueOnce(initialLookup).mockResolvedValueOnce(previousClient);
    const onClientUpdated = vi.fn();
    renderDelivery(1, 2, 7, onClientUpdated, null);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    fireEvent.click(editor.getByRole("button", { name: "Editar clienta" }));
    const clientEditor = within(screen.getByRole("dialog", { name: "Editar clienta" }));
    fireEvent.change(await clientEditor.findByLabelText("Dirección"), { target: { value: "Dirección nueva" } });
    fireEvent.click(clientEditor.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClientUpdated).toHaveBeenCalledWith(expect.objectContaining({ address: "Dirección nueva" })));
    await act(async () => { resolveInitialLookup(previousClient); });

    expect(editor.getByText("Dirección nueva")).toBeVisible();
    expect(editor.queryByText("Dirección anterior")).not.toBeInTheDocument();
    expect(editor.getByLabelText("Dirección de entrega")).toHaveValue("");
  });

  it("conserva la clienta mientras se busca un reemplazo", async () => {
    const onEdit = renderDelivery(1, 2, 7);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    expect(await editor.findByText("Ana")).toBeVisible();
    fireEvent.click(editor.getByRole("button", { name: "Cambiar clienta" }));
    expect(editor.getByText("Clienta actual:")).toBeVisible();
    fireEvent.change(editor.getByLabelText("Código del envío"), { target: { value: "ENV-5" } });
    fireEvent.click(editor.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(4, { code: "ENV-5" }));
  });

  it.each([
    ["Conservar la dirección del envío", "Dirección actual", { clientId: 8 }],
    ["Usar la dirección escrita", null, { clientId: 8, deliveryAddress: "Dirección actual" }],
    ["Usar la dirección de la nueva clienta", "Dirección actual", { clientId: 8, deliveryAddress: "Dirección de Bea" }],
  ])("requiere confirmar la dirección al cambiar de clienta: %s", async (choice, deliveryAddress, payload) => {
    const replacement = { id: 8, name: "Bea", address: "Dirección de Bea" };
    api.getSaleClient.mockImplementation(async (_request, id) => id === 8 ? replacement : { id: 7, name: "Ana", address: "Dirección actual" });
    api.getSaleClients.mockResolvedValueOnce({ items: [replacement], page: 1, totalPages: 1, totalCount: 1 });
    const onEdit = renderDelivery(1, 2, 7, vi.fn(), deliveryAddress);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    expect(await editor.findByText("Ana")).toBeVisible();
    fireEvent.click(editor.getByRole("button", { name: "Cambiar clienta" }));
    fireEvent.change(editor.getByLabelText("Nombre *"), { target: { value: "Bea" } });
    fireEvent.click(editor.getByRole("button", { name: "Buscar clienta" }));
    const matches = within(await screen.findByRole("dialog", { name: "Coincidencias de clientas" }));
    fireEvent.click(matches.getByRole("button", { name: "Seleccionar" }));

    const save = editor.getByRole("button", { name: "Guardar cambios" });
    if (!deliveryAddress) {
      const useSuggestion = await editor.findByRole("button", { name: "Usar dirección del perfil" });
      await waitFor(() => expect(useSuggestion).toBeEnabled());
      fireEvent.click(useSuggestion);
    }
    const addressOption = await editor.findByRole("radio", { name: new RegExp(choice) });
    expect(editor.getByText("Dirección actual", { selector: "strong" })).toBeVisible();
    expect(save).toBeDisabled();
    fireEvent.click(addressOption);
    fireEvent.click(save);
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(4, payload));
  });

  it.each(["reintentar", "escribir"])("protege el cambio de clienta si no pudo obtener la dirección original: %s", async (action) => {
    const replacement = { id: 8, name: "Bea" };
    api.getSaleClient.mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce(replacement)
      .mockResolvedValueOnce({ id: 7, name: "Ana", address: "Dirección recuperada" });
    api.getSaleClients.mockResolvedValueOnce({ items: [replacement], page: 1, totalPages: 1, totalCount: 1 });
    const onEdit = renderDelivery(1, 2, 7, vi.fn(), null);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    const retry = await editor.findByRole("button", { name: "Reintentar consulta de dirección" });
    const save = editor.getByRole("button", { name: "Guardar cambios" });
    expect(save).toBeEnabled();
    fireEvent.click(editor.getByRole("button", { name: "Cambiar clienta" }));
    fireEvent.change(editor.getByLabelText("Nombre *"), { target: { value: "Bea" } });
    fireEvent.click(editor.getByRole("button", { name: "Buscar clienta" }));
    const matches = within(await screen.findByRole("dialog", { name: "Coincidencias de clientas" }));
    fireEvent.click(matches.getByRole("button", { name: "Seleccionar" }));

    await editor.findByText("Confirma la dirección para Bea");
    expect(editor.queryByRole("radio", { name: "Dejar el envío sin dirección" })).not.toBeInTheDocument();
    expect(save).toBeDisabled();
    const address = editor.getByLabelText("Dirección de entrega");
    const expectedAddress = action === "reintentar" ? "Dirección recuperada" : "Dirección escrita";
    if (action === "reintentar") {
      await waitFor(() => expect(retry).toBeEnabled());
      fireEvent.click(retry);
      await editor.findByText(expectedAddress);
      fireEvent.click(editor.getByRole("button", { name: "Usar dirección del perfil" }));
      expect(address).toHaveValue(expectedAddress);
    } else {
      fireEvent.change(address, { target: { value: expectedAddress } });
    }
    const choice = editor.getByRole("radio", { name: /Conservar la dirección del envío|Usar la dirección escrita/ });
    await waitFor(() => expect(choice).toBeEnabled());
    fireEvent.click(choice);
    fireEvent.click(save);
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(4, { clientId: 8, deliveryAddress: expectedAddress }));
  });

  it.each([
    [null, { clientId: 8 }],
    ["Dirección actual", { clientId: 8, deliveryAddress: null }],
  ])("permite confirmar un cambio de clienta sin dirección de entrega cuando la dirección guardada es %s", async (savedAddress, payload) => {
    const replacement = { id: 8, name: "Bea" };
    api.getSaleClient.mockImplementation(async (_request, id) => id === 8 ? replacement : { id: 7, name: "Ana" });
    api.getSaleClients.mockResolvedValueOnce({ items: [replacement], page: 1, totalPages: 1, totalCount: 1 });
    const onEdit = renderDelivery(1, 2, 7, vi.fn(), savedAddress);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    await editor.findByText("Ana");
    fireEvent.click(editor.getByRole("button", { name: "Cambiar clienta" }));
    fireEvent.change(editor.getByLabelText("Nombre *"), { target: { value: "Bea" } });
    fireEvent.click(editor.getByRole("button", { name: "Buscar clienta" }));
    const matches = within(await screen.findByRole("dialog", { name: "Coincidencias de clientas" }));
    fireEvent.click(matches.getByRole("button", { name: "Seleccionar" }));

    if (savedAddress) {
      await editor.findByRole("radio", { name: /Conservar la dirección del envío/ });
      expect(editor.queryByRole("radio", { name: "Dejar el envío sin dirección" })).not.toBeInTheDocument();
      fireEvent.change(editor.getByLabelText("Dirección de entrega"), { target: { value: "" } });
    }
    const withoutAddress = await editor.findByRole("radio", { name: "Dejar el envío sin dirección" });
    const save = editor.getByRole("button", { name: "Guardar cambios" });
    expect(save).toBeDisabled();
    await waitFor(() => expect(withoutAddress).toBeEnabled());
    fireEvent.click(withoutAddress);
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(4, payload));
  });

  it("permite escribir otra dirección después de elegir la dirección registrada", async () => {
    const replacement = { id: 8, name: "Bea", address: "Dirección de Bea" };
    api.getSaleClient.mockImplementation(async (_request, id) => id === 8 ? replacement : { id: 7, name: "Ana" });
    api.getSaleClients.mockResolvedValueOnce({ items: [replacement], page: 1, totalPages: 1, totalCount: 1 });
    const onEdit = renderDelivery(1, 2, 7, vi.fn(), null);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    expect(await editor.findByText("Ana")).toBeVisible();
    fireEvent.click(editor.getByRole("button", { name: "Cambiar clienta" }));
    fireEvent.change(editor.getByLabelText("Nombre *"), { target: { value: "Bea" } });
    fireEvent.click(editor.getByRole("button", { name: "Buscar clienta" }));
    const matches = within(await screen.findByRole("dialog", { name: "Coincidencias de clientas" }));
    fireEvent.click(matches.getByRole("button", { name: "Seleccionar" }));

    fireEvent.click(await editor.findByRole("radio", { name: /Usar la dirección de la nueva clienta/ }));
    const address = editor.getByLabelText("Dirección de entrega");
    const save = editor.getByRole("button", { name: "Guardar cambios" });
    expect(address).toHaveAttribute("readonly");
    fireEvent.click(editor.getByRole("radio", { name: "Escribir otra dirección" }));
    expect(address).not.toHaveAttribute("readonly");
    expect(save).toBeDisabled();
    fireEvent.change(address, { target: { value: "Otra dirección" } });
    fireEvent.click(save);
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(4, { clientId: 8, deliveryAddress: "Otra dirección" }));
  });

  it("refresca la clienta de la venta sin guardar un cambio en el envío", async () => {
    const onClientUpdated = vi.fn();
    const onEdit = renderDelivery(1, 2, 7, onClientUpdated);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const editor = within(screen.getByRole("dialog", { name: "Editar envío" }));
    fireEvent.click(editor.getByRole("button", { name: "Editar clienta" }));
    const clientEditor = within(screen.getByRole("dialog", { name: "Editar clienta" }));
    fireEvent.change(await clientEditor.findByLabelText("Teléfono"), { target: { value: "8858-1572" } });
    fireEvent.click(clientEditor.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(onClientUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 7, phone: "88581572" })));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it.each(["Agencia de envío", "Municipio de entrega"])("consume Escape mientras está abierto el selector %s", (label) => {
    renderDelivery(1);
    fireEvent.click(screen.getByRole("button", { name: "Editar envío" }));
    const dialog = screen.getByRole("dialog", { name: "Editar envío" });
    const editor = within(dialog);
    fireEvent.change(editor.getByLabelText("Código del envío"), { target: { value: "ENV-5" } });
    fireEvent.click(editor.getByRole("button", { name: label }));
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    fireEvent(screen.getByRole("listbox", { name: label }), escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(screen.queryByRole("listbox", { name: label })).not.toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(editor.getByLabelText("Código del envío")).toHaveValue("ENV-5");
  });

  it.each([[4, 2], [1, 4]])("oculta la edición con estado de envío %i y estado de venta %i", (deliveryStatus, saleStatus) => {
    renderDelivery(deliveryStatus, saleStatus);
    expect(screen.queryByRole("button", { name: "Editar envío" })).not.toBeInTheDocument();
  });
});
