import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShipmentReconciliationPage } from "./shipment-reconciliation-page";

const auth = vi.hoisted(() => ({
  request: vi.fn(),
  showToast: vi.fn(),
  setAction: vi.fn(),
  setHeading: vi.fn(),
}));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({
    request: auth.request,
    session: { user: { roles: ["Admin"] } },
  }),
}));

vi.mock("../../shared/layout/page-actions-context", () => ({
  usePageActions: () => ({ setAction: auth.setAction, setHeading: auth.setHeading }),
}));

vi.mock("../../shared/ui/toast-context", () => ({
  useToast: () => ({ showToast: auth.showToast }),
}));

vi.mock("../../shared/finance/exchange-rate-provider", () => ({
  useExchangeRate: () => ({ storeRate: 37.1, bankRate: 36.5, status: "ready", error: null }),
}));

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

afterEach(() => {
  auth.request.mockReset();
  auth.showToast.mockReset();
  auth.setAction.mockReset();
  auth.setHeading.mockReset();
});

describe("shipment reconciliation page", () => {
  it("loads pending deliveries and post-sale deliveries and submits their reconciliation amounts", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/deliveryagencies") return jsonResponse([{ id: 1, name: "Agencia COD", enabled: true, canCollectCashOnDelivery: true }]);
      if (path.endsWith("/pending-deliveries?deliveryAgencyId=1")) return jsonResponse([{
        saleDeliveryId: 7,
        code: "COD-07",
        createdAt: "2026-11-01T16:00:00Z",
        deliveryStatusId: 4,
        deliveryStatusName: "Sent",
        deliveryAgencyId: 1,
        deliveryAgencyName: "Agencia COD",
        saleId: 20,
        saleTotal: 400,
        clientId: 2,
        clientName: "Ana Pérez",
        deliveryAddress: "Managua",
        amountToCollect: 400,
        shippingChargedToClient: 50,
      }]);
      if (path.endsWith("/pending-post-sale-deliveries?deliveryAgencyId=1")) return jsonResponse([{
        id: 9,
        saleReturnId: 9,
        saleExchangeId: null,
        saleId: 20,
        statusId: 2,
        statusName: "InTransit",
        deliveryAgencyId: 1,
        deliveryAgencyName: "Agencia COD",
        code: "RET-09",
        clientName: "Ana Pérez",
        shippingChargedToClient: 0,
        shippingPaidToAgency: 35,
        amountToCollect: 0,
        createdAt: "2026-11-01T15:00:00Z",
      }, {
        id: 10,
        saleReturnId: null,
        saleExchangeId: 14,
        saleId: 20,
        statusId: 2,
        statusName: "InTransit",
        deliveryAgencyId: 1,
        deliveryAgencyName: "Agencia COD",
        code: "EX-10",
        clientName: "Ana Pérez",
        shippingChargedToClient: 25,
        shippingPaidToAgency: 25,
        amountToCollect: 200,
        createdAt: "2026-11-01T16:00:00Z",
      }]);
      if (path === "/api/v1/deliveryagencyreconciliations") return jsonResponse(12);
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<MemoryRouter><ShipmentReconciliationPage /></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: "Agencia de envío" }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Agencia COD" }));
    expect(await screen.findByText("COD-07")).toBeVisible();
    expect(await screen.findByText("RET-09")).toBeVisible();
    expect(await screen.findByText("EX-10")).toBeVisible();

    expect(screen.getByRole("checkbox", { name: "Incluir envío COD-07" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Incluir envío postventa RET-09" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Incluir envío postventa EX-10" })).toBeChecked();
    expect(screen.getByLabelText("Recibido en C$")).toHaveValue(400);
    await user.click(screen.getByRole("button", { name: "Registrar conciliación" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith("/api/v1/deliveryagencyreconciliations", expect.objectContaining({ method: "POST" })));
    const postRequest = auth.request.mock.calls.find(([path]) => path === "/api/v1/deliveryagencyreconciliations");
    const payload = JSON.parse(postRequest?.[1]?.body as string) as {
      deliveryAgencyId: number;
      reconciliationDate: string;
      deliveries: { saleDeliveryId: number; amountCollectedNio: number }[];
      postSaleDeliveries: { postSaleDeliveryId: number; amountCollectedNio: number; shippingPaidToAgency: number }[];
    };
    const actualTime = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Managua", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(payload.reconciliationDate));
    const timeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Managua", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const now = Date.now();
    expect([timeFormatter.format(new Date(now)), timeFormatter.format(new Date(now - 60_000))]).toContain(actualTime);
    expect(payload.deliveryAgencyId).toBe(1);
    expect(payload.deliveries).toEqual([expect.objectContaining({ saleDeliveryId: 7, amountCollectedNio: 400 })]);
    expect(payload.postSaleDeliveries).toEqual([
      expect.objectContaining({ postSaleDeliveryId: 9, amountCollectedNio: 0, shippingPaidToAgency: 35 }),
      expect.objectContaining({ postSaleDeliveryId: 10, amountCollectedNio: 200, shippingPaidToAgency: 25 }),
    ]);
    expect(auth.showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: "success" }));
  });
});
