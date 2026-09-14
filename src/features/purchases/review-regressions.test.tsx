import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderDTO, OrderTrackingNumberDTO, PaginatedResult } from "./purchase-order-types";
import { PurchaseOrderReceivePage } from "./purchase-order-receive-page";
import { TrackingNumbersPage } from "./tracking-numbers-page";

const auth = vi.hoisted(() => ({ request: vi.fn() }));
const pageActions = vi.hoisted(() => ({ setAction: vi.fn(), setHeading: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request, status: "authenticated" }),
}));

vi.mock("../../shared/layout/page-actions-context", () => ({
  usePageActions: () => pageActions,
}));

const canceledOrder = {
  id: 48,
  orderStatusId: 4,
  products: [],
} as unknown as OrderDTO;

const trackingFixture = {
  id: 22,
  orderId: 48,
  shippingCompanyId: 2,
  trackingNumber: "SOHO-782190",
  supplierShipmentDate: "2026-07-15T00:00:00Z",
  warehouseDeliveryDate: null,
  productReceiptId: null,
  weight: 1.25,
  shippingCost: 3.5,
  shippingCompanyName: "Cargo Express",
} satisfies OrderTrackingNumberDTO;

const trackingPage = {
  items: [trackingFixture],
  page: 1,
  pageSize: 20,
  totalCount: 1,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
} satisfies PaginatedResult<OrderTrackingNumberDTO>;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

afterEach(() => {
  auth.request.mockReset();
  pageActions.setAction.mockReset();
  pageActions.setHeading.mockReset();
});

describe("PurchaseOrderReceivePage review regressions", () => {
  it("blocks direct receipt access for canceled orders", async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/orders/48") return jsonResponse(canceledOrder);
      if (path === "/api/v1/orders/48/tracking-numbers") return jsonResponse([]);
      return jsonResponse({});
    });

    render(
      <MemoryRouter initialEntries={["/purchases/orders/48/receive"]}>
        <Routes>
          <Route path="/purchases/orders/:id/receive" element={<PurchaseOrderReceivePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "No se puede registrar la recepción" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar recepción" })).not.toBeInTheDocument();
    expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/orders/48/receipts" && init?.method === "POST")).toBe(false);
  });
});

describe("TrackingNumbersPage review regressions", () => {
  it("shows failed deletion feedback while keeping confirmation open", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return jsonResponse({ detail: "No se pudo eliminar el tracking." }, 400);
      if (path.startsWith("/api/v1/tracking-numbers")) return jsonResponse(trackingPage);
      if (path === "/api/v1/shipping-companies") return jsonResponse([{ id: 2, name: "Cargo Express", url: null }]);
      if (path === "/api/v1/orders/statuses") return jsonResponse([{ id: 2, name: "Recepción parcial" }]);
      return jsonResponse([]);
    });

    render(
      <MemoryRouter initialEntries={["/purchases/tracking-numbers"]}>
        <Routes>
          <Route path="/purchases/tracking-numbers" element={<TrackingNumbersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("SOHO-782190");
    await user.click(screen.getByRole("button", { name: "Eliminar tracking SOHO-782190" }));
    await user.click(screen.getByRole("button", { name: "Confirmar eliminación" }));

    expect(await screen.findByText("No se pudo eliminar el tracking.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar eliminación" })).toBeEnabled();
    await waitFor(() => expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/orders/48/tracking-numbers/22",
      { method: "DELETE" },
    ));
  });
});
