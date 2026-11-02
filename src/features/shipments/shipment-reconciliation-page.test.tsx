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
  it("loads pending deliveries and returns and submits only the selected rows", async () => {
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
      if (path.endsWith("/pending-returns?deliveryAgencyId=1")) return jsonResponse([{
        saleReturnId: 9,
        originalSaleId: 20,
        statusId: 2,
        statusName: "PickedUpAndRefunded",
        deliveryAgencyId: 1,
        deliveryAgencyName: "Agencia COD",
        returnCode: "RET-09",
        clientName: "Ana Pérez",
        productRefundTotal: 350,
        returnShippingChargedToClient: 0,
        returnShippingPaidToAgency: 35,
        originalShippingRefund: 0,
        refundTotal: 350,
        createdAt: "2026-11-01T15:00:00Z",
        pickedUpAt: "2026-11-01T16:00:00Z",
        receivedAt: null,
        comments: null,
      }]);
      if (path === "/api/v1/deliveryagencyreconciliations") return jsonResponse(12);
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<MemoryRouter><ShipmentReconciliationPage /></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: "Agencia de envío" }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Agencia COD" }));
    expect(await screen.findByText("COD-07")).toBeVisible();
    expect(await screen.findByText("RET-09")).toBeVisible();

    expect(screen.getByRole("checkbox", { name: "Incluir envío COD-07" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Incluir devolución RET-09" }));
    expect(screen.getByLabelText("Recibido en C$")).toHaveValue(400);
    await user.click(screen.getByRole("button", { name: "Registrar conciliación" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith("/api/v1/deliveryagencyreconciliations", expect.objectContaining({ method: "POST" })));
    const postRequest = auth.request.mock.calls.find(([path]) => path === "/api/v1/deliveryagencyreconciliations");
    const payload = JSON.parse(postRequest?.[1]?.body as string) as {
      deliveryAgencyId: number;
      deliveries: { saleDeliveryId: number; amountCollectedNio: number }[];
      returns: { saleReturnId: number }[];
    };
    expect(payload.deliveryAgencyId).toBe(1);
    expect(payload.deliveries).toEqual([expect.objectContaining({ saleDeliveryId: 7, amountCollectedNio: 400 })]);
    expect(payload.returns).toEqual([{ saleReturnId: 9 }]);
    expect(auth.showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: "success" }));
  });
});
