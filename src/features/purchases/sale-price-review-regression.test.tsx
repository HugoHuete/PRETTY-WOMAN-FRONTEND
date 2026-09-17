import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderDTO } from "./purchase-order-types";
import { PurchaseOrderReceivePage } from "./purchase-order-receive-page";

const auth = vi.hoisted(() => ({ request: vi.fn() }));
const pageActions = vi.hoisted(() => ({ setAction: vi.fn(), setHeading: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request, status: "authenticated" }),
}));

vi.mock("../../shared/layout/page-actions-context", () => ({
  usePageActions: () => pageActions,
}));

const orderWithReceivedVariantWithoutSalePrice = {
  id: 48,
  orderStatusId: 1,
  products: [{
    id: 1001,
    name: "Vestido satinado",
    presentations: [{
      id: 501,
      name: "Azul",
      sizes: [{
        id: 301,
        sizeId: 12,
        sizeName: "M",
        quantity: 5,
        receivedQuantity: 2,
        salePrice: null,
      }],
    }],
  }],
} as unknown as OrderDTO;

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
}

afterEach(() => {
  auth.request.mockReset();
  pageActions.setAction.mockReset();
  pageActions.setHeading.mockReset();
});

describe("nullable sale price receipt regression", () => {
  it("sends null when receiving a previously received variant without a sale price", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/orders/48") return jsonResponse(orderWithReceivedVariantWithoutSalePrice);
      if (path === "/api/v1/orders/48/tracking-numbers") return jsonResponse([]);
      if (path === "/api/v1/orders/48/receipts" && init?.method === "POST") return jsonResponse({ id: 71 });
      return jsonResponse({});
    });

    render(
      <MemoryRouter initialEntries={["/purchases/orders/48/receive"]}>
        <Routes>
          <Route path="/purchases/orders/:id/receive" element={<PurchaseOrderReceivePage />} />
          <Route path="/purchases/orders/:id" element={<p>Detalle</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByLabelText("Precio de venta de Vestido satinado - Azul - M");
    await user.clear(screen.getByLabelText("Cantidad recibida de Vestido satinado - Azul - M"));
    await user.type(screen.getByLabelText("Cantidad recibida de Vestido satinado - Azul - M"), "1");
    await user.click(screen.getByRole("button", { name: "Guardar recepción" }));
    await user.click(screen.getByRole("button", { name: "Confirmar recepción" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/orders/48/receipts",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"salePrice":null'),
      }),
    ));
  });
});
