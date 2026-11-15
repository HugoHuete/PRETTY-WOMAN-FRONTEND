import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaleDetailLogistics } from "./sale-detail-logistics";
import type { SaleDetail } from "./sales-types";

function renderDelivery(overrides: Partial<SaleDetail> = {}, isAdmin = true) {
  const onPickup = vi.fn().mockResolvedValue(true);
  const sale = { id: 1, saleChannelId: 2, saleStatusId: 2, salePaymentStatusId: 3, deliveries: [], selectionHolds: [], paymentMovements: [], ...overrides } as SaleDetail;
  render(<SaleDetailLogistics sale={sale} isAdmin={isAdmin} busy={false} municipalities={[]} deliveryAgencies={[]} deliveryCatalogLoading={false} deliveryCatalogError={null} onRetryDeliveryCatalogs={() => {}} onDeliveryAction={vi.fn()} onEditDelivery={vi.fn()} onCreateDelivery={vi.fn()} onCompletePickup={onPickup} />);
  return onPickup;
}

describe("retiro en tienda", () => {
  it("solicita confirmación antes de completar la venta", async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const onPickup = renderDelivery();
    fireEvent.click(screen.getByRole("button", { name: "Registrar retiro en tienda" }));
    expect(onPickup).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Confirmar retiro en tienda" })).getByRole("button", { name: "Confirmar retiro" }));
    await waitFor(() => expect(onPickup).toHaveBeenCalledOnce());
  });

  it("no muestra errores anteriores al abrir la confirmación", () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const sale = { id: 1, saleChannelId: 2, saleStatusId: 2, salePaymentStatusId: 3, deliveries: [], selectionHolds: [], paymentMovements: [] } as unknown as SaleDetail;
    render(<SaleDetailLogistics sale={sale} isAdmin busy={false} municipalities={[]} deliveryAgencies={[]} deliveryCatalogLoading={false} deliveryCatalogError={null} onRetryDeliveryCatalogs={() => {}} onDeliveryAction={vi.fn()} onEditDelivery={vi.fn()} onCreateDelivery={vi.fn()} onCompletePickup={vi.fn()} pickupError="Error al corregir el pago" />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar retiro en tienda" }));
    expect(within(screen.getByRole("dialog", { name: "Confirmar retiro en tienda" })).queryByText("Error al corregir el pago")).not.toBeInTheDocument();
  });

  it("explica los requisitos y no permite la acción sin pago", () => {
    renderDelivery({ salePaymentStatusId: 2 });
    expect(screen.getByRole("button", { name: "Registrar retiro en tienda" })).toBeDisabled();
    expect(screen.getByText(/pagar completamente/i)).toBeVisible();
  });

  it("bloquea el retiro si hay envío activo", () => {
    renderDelivery({ deliveries: [{ id: 4, deliveryStatusId: 1, createdAt: "2026-01-01" }] as SaleDetail["deliveries"] });
    expect(screen.getByRole("button", { name: "Registrar retiro en tienda" })).toBeDisabled();
    expect(screen.getByText(/cancela el envío activo/i)).toBeVisible();

  });

  it("permite registrar el retiro a vendedores", () => {
    renderDelivery({}, false);
    expect(screen.getByRole("button", { name: "Registrar retiro en tienda" })).toBeEnabled();
  });
});
