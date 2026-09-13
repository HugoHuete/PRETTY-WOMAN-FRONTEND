import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderDTO, OrderTrackingNumberDTO } from "./purchase-order-types";
import { PurchaseOrderDetailPage } from "./purchase-order-detail-page";
import { AppShell } from "../../shared/layout/app-shell";

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request }),
}));

const orderFixture = {
  id: 48,
  createdAt: "2026-07-15T14:20:00Z",
  purchaseDate: "2026-07-12",
  orderStatusId: 2,
  orderStatusName: "Recepción parcial",
  supplierId: 7,
  supplierName: "SOHO",
  purchaseCurrencyId: 2,
  purchaseCurrencyName: "Dólar estadounidense",
  amountUsd: 153,
  receivedAmountNio: 5600,
  comments: "Separar las blusas blancas y negras en bolsas individuales.",
  merchandiseTotalNio: 5600,
  supplierShippingCostUsd: 15,
  warehouseShippingCostUsd: 0,
  totalCostNio: 6150,
  exchangeRate: 36.62,
  products: [
    {
      id: 1001,
      supplierProductCode: "SOHO25120",
      code: 25120,
      name: "Vestido satinado",
      subcategoryId: 4,
      subcategoryName: "Vestidos",
      presentations: [
        {
          id: 501,
          name: "Pañuelo cuadrado",
          sortOrder: 0,
          sizes: [
            {
              id: 301,
              sizeId: 12,
              sizeName: "M",
              quantity: 3,
              receivedQuantity: 1,
              availableQuantity: 1,
              reservedQuantity: 1,
              unitCostUsd: 8.5,
              merchandiseTotalCostNio: 935.05,
              allocatedShippingCostNio: 75,
              totalCostNio: 1010.05,
              unitCostNio: 310.02,
              salePrice: 1250,
            },
          ],
        },
      ],
    },
  ],
  purchaseShortages: [
    {
      id: 1,
      productId: 1001,
      quantity: 2,
      lossAmountNio: 250,
      shortageDate: "2026-07-15",
      refundStatus: 1,
    },
  ],
  supplierRefund: {
    id: 9,
    financialMovementId: 77,
    amountNio: 250,
    refundedAt: "2026-07-20",
    reference: "CR-001",
    comments: null,
  },
  totalShortageLossNio: 250,
  totalSupplierRefundNio: 250,
  netShortageLossNio: 0,
  supplierRefundDeclinedAt: null,
  supplierRefundDeclineComments: null,
} satisfies OrderDTO;

const trackingFixture = {
  id: 22,
  orderId: 48,
  shippingCompanyId: 2,
  trackingNumber: "SOHO-782190",
  supplierShipmentDate: "2026-07-13",
  warehouseDeliveryDate: null,
  productReceiptId: null,
  weight: 1.25,
  shippingCost: 350,
  shippingCompanyName: "Cargo Express",
} satisfies OrderTrackingNumberDTO;

const receivedTrackingFixture = {
  ...trackingFixture,
  productReceiptId: 17,
} satisfies OrderTrackingNumberDTO;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function renderDetail(path = "/purchases/orders/48") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            path="/purchases/orders/:id"
            element={<PurchaseOrderDetailPage />}
          />
          <Route path="/purchases/orders" element={<p>Listado de compras</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function DetailRoute() {
  return (
    <>
      <Link to="/purchases/orders/49">Siguiente orden</Link>
      <PurchaseOrderDetailPage />
    </>
  );
}

afterEach(() => auth.request.mockReset());

describe("PurchaseOrderDetailPage", () => {
  it("places the single detail title and working back link in the shell header", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    await screen.findByText("Vestido satinado");
    const header = within(screen.getByRole("banner"));
    expect(
      await header.findByRole("heading", { level: 1, name: "Orden #48" }),
    ).toBeInTheDocument();
    expect(header.getByRole("button", { name: "Editar orden" })).toBeDisabled();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await user.click(header.getByRole("link", { name: /regresar a compras/i }));
    expect(await screen.findByText("Listado de compras")).toBeInTheDocument();
    expect(
      header.queryByRole("heading", { name: "Orden #48" }),
    ).not.toBeInTheDocument();
    expect(
      header.queryByRole("link", { name: /regresar a compras/i }),
    ).not.toBeInTheDocument();
  });

  it.each([{ products: undefined }, { products: null }, { products: [] }])(
    "shows a contextual empty state for products: $products",
    async ({ products }) => {
      auth.request.mockImplementation((path: string) =>
        jsonResponse(
          path.endsWith("tracking-numbers")
            ? []
            : { ...orderFixture, products },
        ),
      );
      renderDetail();
      expect(
        await screen.findByText(
          "No hay productos registrados para esta orden.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("C$6,150.00")).toBeInTheDocument();
    },
  );

  it.each([
    { presentations: undefined },
    { presentations: null },
    { presentations: [] },
  ])(
    "shows a contextual empty state for presentations: $presentations",
    async ({ presentations }) => {
      auth.request.mockImplementation((path: string) =>
        jsonResponse(
          path.endsWith("tracking-numbers")
            ? []
            : {
                ...orderFixture,
                products: [{ ...orderFixture.products[0], presentations }],
              },
        ),
      );
      renderDetail();
      expect(
        await screen.findByText(
          "No hay variantes registradas para este producto.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Vestido satinado")).toBeInTheDocument();
    },
  );

  it.each([undefined, null])(
    "shows a contextual empty state when shortages are %s",
    async (purchaseShortages) => {
      auth.request.mockImplementation((path: string) =>
        jsonResponse(
          path.endsWith("tracking-numbers")
            ? []
            : { ...orderFixture, purchaseShortages },
        ),
      );
      renderDetail();
      expect(
        await screen.findByText(
          "No hay faltantes registrados para esta orden.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Vestido satinado")).toBeInTheDocument();
    },
  );

  it("loads the order and tracking collection for the route id", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(
        path.endsWith("tracking-numbers") ? [trackingFixture] : orderFixture,
      ),
    );
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: /orden #?48/i }),
    ).toBeInTheDocument();
    expect(auth.request).toHaveBeenCalledWith("/api/v1/orders/48");
    expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/orders/48/tracking-numbers",
    );
  });

  it("shows a not-found state for a missing order", async () => {
    auth.request.mockImplementation((path: string) =>
      path.endsWith("tracking-numbers")
        ? jsonResponse([])
        : jsonResponse({ title: "No existe" }, 404),
    );
    renderDetail();
    expect(
      await screen.findByText("No encontramos esta orden"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /volver a órdenes/i }),
    ).toHaveAttribute("href", "/purchases/orders");
  });

  it("shows loading state while detail is pending", async () => {
    const pendingOrder = deferred<Response>();
    auth.request.mockImplementation((path: string) =>
      path.endsWith("tracking-numbers")
        ? jsonResponse([])
        : pendingOrder.promise,
    );
    renderDetail();
    await waitFor(() =>
      expect(auth.request).toHaveBeenCalledWith("/api/v1/orders/48"),
    );
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("shows ErrorState for a failed detail request", async () => {
    auth.request.mockImplementation((path: string) =>
      path.endsWith("tracking-numbers")
        ? jsonResponse([])
        : jsonResponse({ detail: "La orden no está disponible." }, 500),
    );
    renderDetail();
    expect(
      await screen.findByText("La orden no está disponible."),
    ).toBeInTheDocument();
  });

  it("shows PermissionDeniedState for a 403", async () => {
    auth.request.mockImplementation((path: string) =>
      path.endsWith("tracking-numbers")
        ? jsonResponse([])
        : jsonResponse({ detail: "Sin permiso" }, 403),
    );
    renderDetail();
    expect(await screen.findByText("Acceso restringido")).toBeInTheDocument();
  });

  it("renders each product variant with received and pending quantities", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    expect(await screen.findByText("Vestido satinado")).toBeInTheDocument();
    const productRow = screen.getByRole("row", {
      name: /Pañuelo cuadrado M 3 1 2/,
    });
    expect(
      within(productRow).getByRole("cell", { name: /^1$/ }),
    ).toBeInTheDocument();
    expect(
      within(productRow).getByRole("cell", { name: /^2$/ }),
    ).toBeInTheDocument();
    expect(productRow).not.toHaveTextContent("Recibidas:");
    expect(productRow).not.toHaveTextContent("Pendientes:");
  });

  it("centers quantity values and shows price and profit for each variant", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    await screen.findByText("Vestido satinado");
    const productRow = screen.getByRole("row", {
      name: /Pañuelo cuadrado M 3 1 2/,
    });

    expect(within(productRow).getByRole("cell", { name: "3" })).toHaveClass(
      "text-center",
    );
    expect(
      within(productRow).getByRole("cell", { name: "C$310.02" }),
    ).toBeInTheDocument();
    expect(
      within(productRow).getByRole("cell", { name: "C$1,250.00" }),
    ).toBeInTheDocument();
    expect(
      within(productRow).getByRole("cell", { name: "C$939.98" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Talla" })).toHaveClass(
      "text-center",
    );
    expect(
      screen.getByRole("columnheader", { name: "Costo unitario" }),
    ).toHaveClass("text-center");
    expect(
      screen.getByRole("columnheader", { name: "Precio venta" }),
    ).toHaveClass("text-center");
    expect(screen.getByRole("columnheader", { name: "Ganancia" })).toHaveClass(
      "text-center",
    );
    expect(screen.getByText("SOHO25120")).toHaveClass("font-mono");
    expect(screen.getByText("Producto")).toBeInTheDocument();
  });

  it("removes the explanatory sentence from the products section", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    await screen.findByText("Vestido satinado");
    expect(
      screen.queryByText(
        "Cantidad solicitada, recepción y costo por presentación y talla.",
      ),
    ).not.toBeInTheDocument();
  });

  it("aligns financial summary values for faster scanning", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    await screen.findByText("Vestido satinado");
    const summary = screen.getByRole("complementary", {
      name: "Resumen financiero de la orden",
    });
    const merchandiseCosts = within(summary).getAllByText("C$5,600.00");
    const merchandiseCost = merchandiseCosts[0];
    expect(merchandiseCost).toHaveClass("tabular-nums");
    expect(merchandiseCost.parentElement).toHaveClass(
      "flex",
      "justify-between",
    );
  });

  it("shows the received amount in cordobas in the financial summary", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    await screen.findByText("Vestido satinado");
    const summary = screen.getByRole("complementary", {
      name: "Resumen financiero de la orden",
    });

    expect(within(summary).getByText("Valor recibido")).toBeInTheDocument();
    expect(
      within(summary).getByText("Valor recibido").parentElement,
    ).toHaveTextContent("C$5,600.00");
  });

  it("groups order metadata into readable fields", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    await screen.findByText("Vestido satinado");
    const metadata = screen.getByRole("region", { name: "Datos de la orden" });

    expect(within(metadata).getByText("Proveedor").parentElement).toHaveClass(
      "rounded-lg",
      "border",
    );
    expect(
      within(metadata).getByText("Fecha de compra").parentElement,
    ).toHaveClass("rounded-lg", "border");
  });
  it("formats the exchange rate as an operational currency instruction", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    expect(await screen.findByText("C$ 36.62 por $1")).toBeInTheDocument();
  });

  it("gives the financial summary and product table descriptive landmarks", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    await screen.findByText("Vestido satinado");
    expect(
      screen.getByRole("complementary", {
        name: "Resumen financiero de la orden",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "Presentaciones de Vestido satinado",
      }),
    ).toBeInTheDocument();
  });

  it("provides a shortcut to the tracking section", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    const summary = await screen.findByRole("complementary", {
      name: "Resumen financiero de la orden",
    });
    expect(
      await within(summary).findByRole("link", {
        name: "Ir a números de seguimiento",
      }),
    ).toHaveAttribute("href", "#tracking-section");
    expect(
      within(summary).getByRole("button", { name: "Registrar recepción" }),
    ).toBeDisabled();
    expect(
      within(summary).getByRole("button", { name: "Cerrar con faltantes" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("navigation", { name: "Accesos rápidos" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector("#tracking-section")).toBeInTheDocument();
  });

  it("renders the backend presentation and size shape instead of treating it as empty", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    expect(await screen.findByText("SOHO25120")).toBeInTheDocument();
    expect(screen.getByText("Pañuelo cuadrado")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(
      screen.queryByText("No hay variantes registradas para este producto."),
    ).not.toBeInTheDocument();
  });

  it("renders totalShortageLossNio, totalSupplierRefundNio, and netShortageLossNio from the API", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    expect(await screen.findByText("Pérdida total")).toBeInTheDocument();
    expect(screen.getAllByText("C$250.00")).toHaveLength(2);
    expect(screen.getByText("C$0.00")).toBeInTheDocument();
  });

  it("keeps the detail sections in the documented reading order", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    await screen.findByRole("heading", { name: /orden #?48/i });
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Datos de la orden",
      "Resumen de compra",
      "Productos de la orden",
      "Faltantes",
      "Números de seguimiento",
      "Comentario interno",
    ]);
  });

  it("shows a tracking pending state while the tracking request is unresolved", async () => {
    const pendingTracking = deferred<Response>();
    auth.request.mockImplementation((path: string) =>
      path.endsWith("tracking-numbers")
        ? pendingTracking.promise
        : jsonResponse(orderFixture),
    );
    renderDetail();
    expect(
      await screen.findByRole("status", {
        name: /cargando números de seguimiento/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows a scoped permission state for a 403 tracking request", async () => {
    auth.request.mockImplementation((path: string) =>
      path.endsWith("tracking-numbers")
        ? jsonResponse({ detail: "Sin permiso para tracking." }, 403)
        : jsonResponse(orderFixture),
    );
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Acceso restringido" }),
    ).toBeInTheDocument();
  });

  it("shows a scoped not-found state for a 404 tracking request", async () => {
    auth.request.mockImplementation((path: string) =>
      path.endsWith("tracking-numbers")
        ? jsonResponse({ title: "No existe tracking." }, 404)
        : jsonResponse(orderFixture),
    );
    renderDetail();
    expect(
      await screen.findByRole("heading", {
        name: "No encontramos los números de seguimiento",
      }),
    ).toBeInTheDocument();
  });

  it("shows ErrorState for another failed tracking request", async () => {
    auth.request.mockImplementation((path: string) =>
      path.endsWith("tracking-numbers")
        ? jsonResponse(
            { detail: "El historial de paquetes no está disponible." },
            500,
          )
        : jsonResponse(orderFixture),
    );
    renderDetail();
    expect(
      await screen.findByText("El historial de paquetes no está disponible."),
    ).toBeInTheDocument();
  });

  it("shows the contextual empty state when tracking is empty", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();
    expect(
      await screen.findByText(/aún no hay números de seguimiento/i),
    ).toBeInTheDocument();
  });
  it("creates a tracking number from the order detail", async () => {
    const user = userEvent.setup();
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      requests.push({ path, init });
      if (path === "/api/v1/shipping-companies") {
        return jsonResponse([{ id: 2, name: "Cargo Express", url: null }]);
      }
      if (path.endsWith("/tracking-numbers") && init?.method === "POST") {
        return jsonResponse([trackingFixture]);
      }
      if (path.endsWith("/tracking-numbers")) {
        return jsonResponse([]);
      }
      return jsonResponse(orderFixture);
    });
    renderDetail();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Agregar tracking" }));
    await user.click(screen.getByRole("button", { name: "Empresa de envío" }));
    await user.click(
      within(
        screen.getByRole("listbox", { name: "Empresa de envío" }),
      ).getByRole("option", { name: "Cargo Express" }),
    );
    await user.type(screen.getByLabelText("Número de tracking"), "SOHO-782190");
    fireEvent.change(screen.getByLabelText("Fecha de envío"), {
      target: { value: "2026-07-13" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar tracking" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Agregar tracking" }),
      ).not.toBeInTheDocument(),
    );

    const createRequest = requests.find(
      ({ path, init }) =>
        path.endsWith("/tracking-numbers") && init?.method === "POST",
    );
    expect(createRequest?.init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(createRequest?.init?.body))).toEqual([
      {
        shippingCompanyId: 2,
        trackingNumber: "SOHO-782190",
        supplierShipmentDate: "2026-07-13T00:00:00.000Z",
        warehouseDeliveryDate: null,
        productReceiptId: null,
      },
    ]);
  });

  it("rejects future tracking dates before creating a tracking number", async () => {
    const user = userEvent.setup();
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      requests.push({ path, init });
      if (path === "/api/v1/shipping-companies") {
        return jsonResponse([{ id: 2, name: "Cargo Express", url: null }]);
      }
      if (path.endsWith("/tracking-numbers")) return jsonResponse([]);
      return jsonResponse(orderFixture);
    });

    renderDetail();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Agregar tracking" }));
    await user.click(screen.getByRole("button", { name: "Empresa de envío" }));
    await user.click(
      within(
        screen.getByRole("listbox", { name: "Empresa de envío" }),
      ).getByRole("option", { name: "Cargo Express" }),
    );
    await user.type(screen.getByLabelText("Número de tracking"), "SOHO-782190");
    fireEvent.change(screen.getByLabelText("Fecha de envío"), {
      target: { value: "2999-12-31" },
    });
    fireEvent.submit(
      screen
        .getByRole("heading", { name: "Agregar tracking" })
        .closest("form")!,
    );

    expect(
      await screen.findByText("Las fechas de tracking no pueden ser futuras."),
    ).toBeInTheDocument();
    expect(
      requests.some(
        ({ path, init }) =>
          path.endsWith("/tracking-numbers") && init?.method === "POST",
      ),
    ).toBe(false);
  });

  it("keeps only one cancel action in the tracking form", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/shipping-companies") {
        return jsonResponse([{ id: 2, name: "Cargo Express", url: null }]);
      }
      if (path.endsWith("/tracking-numbers")) return jsonResponse([]);
      return jsonResponse(orderFixture);
    });

    renderDetail();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Agregar tracking" }));

    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(1);
  });

  it("omits the redundant tracking section description", async () => {
    auth.request.mockImplementation((path: string) =>
      jsonResponse(path.endsWith("/tracking-numbers") ? [] : orderFixture),
    );
    renderDetail();

    await screen.findByRole("heading", { name: "Números de seguimiento" });
    expect(
      screen.queryByText("Paquetes asociados a esta orden."),
    ).not.toBeInTheDocument();
  });

  it("edits an existing tracking number", async () => {
    const user = userEvent.setup();
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      requests.push({ path, init });
      if (path === "/api/v1/shipping-companies") {
        return jsonResponse([{ id: 2, name: "Cargo Express", url: null }]);
      }
      if (path.endsWith("/tracking-numbers/22") && init?.method === "PUT") {
        return jsonResponse({
          ...receivedTrackingFixture,
          trackingNumber: "SOHO-782191",
        });
      }
      if (path.endsWith("/tracking-numbers")) {
        return jsonResponse([receivedTrackingFixture]);
      }
      return jsonResponse(orderFixture);
    });

    renderDetail();
    await screen.findByText("SOHO-782190");
    await user.click(
      screen.getByRole("button", { name: "Editar tracking SOHO-782190" }),
    );
    const trackingInput = await screen.findByLabelText("Número de tracking");
    await user.clear(trackingInput);
    await user.type(trackingInput, "SOHO-782191");
    await user.click(screen.getByRole("button", { name: "Guardar tracking" }));

    const updateRequest = requests.find(
      ({ path, init }) =>
        path === "/api/v1/orders/48/tracking-numbers/22" &&
        init?.method === "PUT",
    );
    expect(JSON.parse(String(updateRequest?.init?.body))).toEqual({
      shippingCompanyId: 2,
      trackingNumber: "SOHO-782191",
      supplierShipmentDate: "2026-07-13T00:00:00.000Z",
      warehouseDeliveryDate: null,
      productReceiptId: 17,
    });
  });

  it("deletes an existing tracking number after confirmation", async () => {
    const user = userEvent.setup();
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      requests.push({ path, init });
      if (path.endsWith("/tracking-numbers/22") && init?.method === "DELETE") {
        return jsonResponse(null, 204);
      }
      if (path.endsWith("/tracking-numbers")) {
        return jsonResponse([trackingFixture]);
      }
      return jsonResponse(orderFixture);
    });

    renderDetail();
    await screen.findByText("SOHO-782190");
    await user.click(
      screen.getByRole("button", { name: "Eliminar tracking SOHO-782190" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    );

    expect(requests).toContainEqual(
      expect.objectContaining({
        path: "/api/v1/orders/48/tracking-numbers/22",
        init: expect.objectContaining({ method: "DELETE" }),
      }),
    );
  });

  it("resets the tracking form when navigating to another order", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/shipping-companies") {
        return jsonResponse([{ id: 2, name: "Cargo Express", url: null }]);
      }
      if (path.endsWith("tracking-numbers")) return jsonResponse([]);
      return jsonResponse(
        path.endsWith("/49") ? { ...orderFixture, id: 49 } : orderFixture,
      );
    });
    render(
      <MemoryRouter initialEntries={["/purchases/orders/48"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/purchases/orders/:id" element={<DetailRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Agregar tracking" }));
    expect(
      await screen.findByRole("heading", { name: "Agregar tracking" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Siguiente orden" }));

    expect(
      await screen.findByRole("heading", { name: /orden #?49/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Agregar tracking" }),
    ).not.toBeInTheDocument();
  });

  it("resets the tracking delete confirmation when navigating to another order", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.endsWith("tracking-numbers"))
        return jsonResponse([trackingFixture]);
      return jsonResponse(
        path.endsWith("/49") ? { ...orderFixture, id: 49 } : orderFixture,
      );
    });
    render(
      <MemoryRouter initialEntries={["/purchases/orders/48"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/purchases/orders/:id" element={<DetailRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("SOHO-782190");
    await user.click(
      screen.getByRole("button", { name: "Eliminar tracking SOHO-782190" }),
    );
    expect(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Siguiente orden" }));

    expect(
      await screen.findByRole("heading", { name: /orden #?49/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar eliminación" }),
    ).not.toBeInTheDocument();
  });

  it("ignores the first id response after navigation to a second order", async () => {
    const user = userEvent.setup();
    const firstOrder = deferred<Response>();
    const secondOrder = deferred<Response>();
    auth.request.mockImplementation((path: string) => {
      if (path.endsWith("tracking-numbers")) return jsonResponse([]);
      return path.endsWith("/48") ? firstOrder.promise : secondOrder.promise;
    });
    render(
      <MemoryRouter initialEntries={["/purchases/orders/48"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/purchases/orders/:id" element={<DetailRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("link", { name: "Siguiente orden" }));
    secondOrder.resolve(
      await jsonResponse({
        ...orderFixture,
        id: 49,
        supplierName: "Proveedor actual",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: /orden #?49/i }),
    ).toBeInTheDocument();
    firstOrder.resolve(
      await jsonResponse({
        ...orderFixture,
        supplierName: "Proveedor anterior",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Proveedor anterior")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Proveedor actual")).toBeInTheDocument();
  });
});
