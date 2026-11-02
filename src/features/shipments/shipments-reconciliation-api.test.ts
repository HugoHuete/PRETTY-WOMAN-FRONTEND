import { describe, expect, it, vi } from "vitest";
import type { AuthRequest } from "../sales/sales-api";
import {
  createShipmentReconciliation,
  getPendingReconciliationDeliveries,
  getPendingReconciliationReturns,
} from "./shipments-api";

describe("shipment reconciliation API", () => {
  it("loads pending deliveries filtered by agency", async () => {
    const request = vi.fn<AuthRequest>().mockResolvedValue(new Response("[]", { status: 200 }));

    await getPendingReconciliationDeliveries(request, 4);

    expect(request).toHaveBeenCalledWith("/api/v1/deliveryagencyreconciliations/pending-deliveries?deliveryAgencyId=4");
  });

  it("loads pending returns filtered by agency", async () => {
    const request = vi.fn<AuthRequest>().mockResolvedValue(new Response("[]", { status: 200 }));

    await getPendingReconciliationReturns(request, 4);

    expect(request).toHaveBeenCalledWith("/api/v1/deliveryagencyreconciliations/pending-returns?deliveryAgencyId=4");
  });

  it("posts the selected deliveries and returns and reads the reconciliation id", async () => {
    const payload = {
      deliveryAgencyId: 4,
      settlementExchangeRate: 36.5,
      deliveries: [{ saleDeliveryId: 21, amountCollectedNio: 100, amountCollectedUsd: 0, changeGivenNio: 0, shippingPaidToAgency: 25 }],
      returns: [{ saleReturnId: 31 }],
    };
    const request = vi.fn<AuthRequest>().mockResolvedValue(new Response("19", { status: 200 }));

    await expect(createShipmentReconciliation(request, payload)).resolves.toBe(19);

    expect(request).toHaveBeenCalledWith("/api/v1/deliveryagencyreconciliations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });
});
