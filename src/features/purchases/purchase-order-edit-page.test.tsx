import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../shared/layout/app-shell";
import { PurchaseOrderEditPage } from "./purchase-order-edit-page";
import { type OrderDTO } from "./purchase-order-types";

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request, status: "authenticated" }),
}));

const suppliers = [
  { id: 7, name: "SOHO", enabled: true, url: null, isNational: false },
  { id: 8, name: "Shein", enabled: true, url: null, isNational: false },
];

const subcategories = [{ id: 4, name: "Vestidos" }];
const sizes = [{ id: 12, name: "M" }, { id: 13, name: "S" }];


const orderFixture: OrderDTO = {
  id: 48,
  createdAt: "2026-07-15T14:20:00Z",
  purchaseDate: "2026-07-12",
  orderStatusId: 1,
  orderStatusName: "Pendiente",
  supplierId: 7,
  supplierName: "SOHO",
  purchaseCurrencyId: 2,
  purchaseCurrencyName: "Córdoba nicaragüense",
  amountUsd: 153,
  receivedAmountNio: 0,
  comments: "Compra de agosto",
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
          name: "Azul",
          sortOrder: 0,
          sizes: [
            {
              id: 301,
              sizeId: 12,
              sizeName: "M",
              quantity: 3,
              receivedQuantity: 0,
              availableQuantity: 0,
              reservedQuantity: 0,
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
  purchaseShortages: [],
  supplierRefund: null,
  totalShortageLossNio: null,
  totalSupplierRefundNio: null,
  netShortageLossNio: null,
  supplierRefundDeclinedAt: null,
  supplierRefundDeclineComments: null,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={["/purchases/orders/48/edit"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/purchases/orders/:id/edit" element={<PurchaseOrderEditPage />} />
          <Route path="/purchases/orders/:id" element={<p>Detalle de orden</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function mockEditRequests(putResponse: Response | null = null, order = orderFixture, currentExchangeRate = order.exchangeRate) {
  auth.request.mockImplementation((path: string, init?: RequestInit) => {
    if (path === "/api/v1/orders/48" && init?.method === "PUT") {
      return putResponse ? Promise.resolve(putResponse) : jsonResponse(null, 204);
    }
    if (path === "/api/v1/exchange-rates/current") {
      return jsonResponse({ bankRate: currentExchangeRate, storeRate: currentExchangeRate, startDate: "2026-09-13" });
    }
    if (path === "/api/v1/orders/48") return jsonResponse(order);
    if (path === "/api/v1/suppliers") return jsonResponse(suppliers);
    if (path === "/api/v1/subcategories") return jsonResponse(subcategories);
    if (path === "/api/v1/sizes") return jsonResponse(sizes);
    return jsonResponse({});
  });
}

function OrderNavigationProbe() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate("/purchases/orders/49/edit")}>Cambiar orden</button>;
}

afterEach(() => auth.request.mockReset());

describe("PurchaseOrderEditPage", () => {
  it("carga los datos generales actuales y mantiene la tasa como referencia", async () => {
    mockEditRequests();

    renderEdit();

    expect(await screen.findByRole("heading", { name: "Datos generales" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proveedor" })).toHaveTextContent("SOHO");
    expect(screen.getByLabelText("Fecha de compra")).toHaveValue("2026-07-12");
    expect(screen.getByRole("button", { name: "Moneda de compra" })).toHaveTextContent("C$ — compra local");
    expect(screen.getByLabelText("Tasa de cambio")).toHaveValue("C$ 36.62 por $1");
    expect(screen.getByLabelText("Tasa de cambio")).toHaveAttribute("readonly");
    expect(screen.getByRole("heading", { name: "Productos de la orden" })).toBeInTheDocument();
    expect(screen.getByLabelText("Código proveedor del producto 1")).toHaveValue("SOHO25120");
    expect(screen.getByLabelText("Nombre del producto 1")).toHaveValue("Vestido satinado");
    expect(screen.getByRole("button", { name: "Subcategoría del producto 1" })).toHaveTextContent("Vestidos");
    expect(screen.getByRole("button", { name: "Talla 1 de la presentación 1 del producto 1" })).toHaveTextContent("M");
    expect(screen.getByLabelText("Cantidad 1 de la presentación 1 del producto 1")).toHaveValue(3);
    expect(screen.getByLabelText("Costo unitario 1 de la presentación 1 del producto 1")).toHaveValue("311.68");
    expect(screen.queryByText("Los productos, presentaciones, tallas y cantidades no se pueden editar en esta versión.")).not.toBeInTheDocument();
    expect(screen.queryByText("Solo referencia; la tasa no se modifica desde aquí.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Regresar al detalle" })).not.toHaveClass("min-h-11");
    expect(screen.getByLabelText("Comentario interno")).toHaveValue("Compra de agosto");
    expect(screen.getByLabelText("Fecha de compra")).toHaveAttribute("max", new Intl.DateTimeFormat("en-CA").format(new Date()));
  });

  it("muestra y actualiza el resumen estimado con los valores editados", async () => {
    const user = userEvent.setup();
    mockEditRequests(null, orderFixture, 37);
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    const summary = screen.getByRole("complementary", { name: "Resumen estimado" });
    expect(within(summary).getByText("C$ 935.05")).toBeInTheDocument();
    expect(within(summary).getByText("C$ 1,484.35")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cantidad 1 de la presentación 1 del producto 1"), { target: { value: "5" } });
    await waitFor(() => expect(within(summary).getByText("C$ 1,558.42")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Moneda de compra" }));
    await user.click(within(screen.getByRole("listbox", { name: "Moneda de compra" })).getByRole("option", { name: "USD" }));
    expect(within(summary).getByText("$ 42.56")).toBeInTheDocument();
  });
  it("hidrata los costos USD usando la tasa histórica de la orden", async () => {
    const historicalUsdOrder = {
      ...orderFixture,
      purchaseCurrencyId: 1,
      purchaseCurrencyName: "Dólar estadounidense",
      exchangeRate: 35,
    };
    mockEditRequests(null, historicalUsdOrder, 37);
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    const unitCost = screen.getByLabelText("Costo unitario 1 de la presentación 1 del producto 1");
    const historicalUnitCost = Number((935.05 / 3 / 35).toFixed(2));
    expect(unitCost).toHaveValue(String(historicalUnitCost));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());

    const updateCall = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT");
    if (!updateCall) throw new Error("No se encontró la solicitud de actualización.");
    const payload = JSON.parse(String((updateCall[1] as RequestInit).body));
    expect(payload.products[0].presentations[0].sizes[0].unitCost).toBeCloseTo(935.05 / 3 / 35, 10);
  });

  it("permite editar el costo del envío del proveedor y lo envía al guardar", async () => {
    const user = userEvent.setup();
    mockEditRequests();
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    const shippingInput = screen.getByLabelText("Envío proveedor (USD)");
    expect(shippingInput).toHaveValue(15);

    fireEvent.change(shippingInput, { target: { value: "22.5" } });
    expect(
      within(screen.getByRole("complementary", { name: "Resumen estimado" })).getByText("$ 22.50"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());

    const updateCall = auth.request.mock.calls.find(
      ([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT",
    );
    if (!updateCall) throw new Error("No se encontró la solicitud de actualización.");
    const payload = JSON.parse(String((updateCall[1] as RequestInit).body));
    expect(payload.supplierShippingCostUsd).toBe(22.5);
  });
  it("rechaza un costo de envío del proveedor negativo", async () => {
    const user = userEvent.setup();
    mockEditRequests();
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    fireEvent.change(screen.getByLabelText("Envío proveedor (USD)"), { target: { value: "-1" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El costo de envío del proveedor debe ser un monto mayor o igual que cero.",
    );
    expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT")).toBe(false);
    expect(screen.getByRole("heading", { name: "Datos generales" })).toBeInTheDocument();
  });
  it("limpia el formulario anterior mientras carga otra orden", async () => {
    const user = userEvent.setup();
    let resolveOrder: ((response: Response) => void) | undefined;
    const pendingOrder = new Promise<Response>((resolve) => { resolveOrder = resolve; });
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/exchange-rates/current") return jsonResponse({ bankRate: 36.62, storeRate: 36.62, startDate: "2026-09-13" });
      if (path === "/api/v1/orders/48") return jsonResponse(orderFixture);
      if (path === "/api/v1/orders/49") return pendingOrder;
      if (path === "/api/v1/suppliers") return jsonResponse(suppliers);
      if (path === "/api/v1/subcategories") return jsonResponse(subcategories);
      if (path === "/api/v1/sizes") return jsonResponse(sizes);
      return jsonResponse({});
    });

    render(
      <MemoryRouter initialEntries={["/purchases/orders/48/edit"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/purchases/orders/:id/edit" element={<><PurchaseOrderEditPage /><OrderNavigationProbe /></>} />
            <Route path="/purchases/orders/:id" element={<p>Detalle de orden</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Datos generales" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cambiar orden" }));

    expect(screen.queryByRole("heading", { name: "Datos generales" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre del producto 1")).not.toBeInTheDocument();

    resolveOrder?.(await jsonResponse({ ...orderFixture, id: 49 }));
    expect(await screen.findByRole("heading", { name: "Datos generales" })).toBeInTheDocument();
  });
  it("bloquea la edición de productos cuando la orden tiene recepciones", async () => {
    const receivedOrder = {
      ...orderFixture,
      receivedAmountNio: 100,
      products: orderFixture.products.map((product) => ({
        ...product,
        presentations: product.presentations.map((presentation) => ({
          ...presentation,
          sizes: presentation.sizes.map((size) => ({ ...size, receivedQuantity: 1 })),
        })),
      })),
    };
    mockEditRequests(null, receivedOrder);
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });
    expect(screen.getByText("Esta orden tiene recepciones y sus productos no se pueden modificar.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del producto 1")).toBeDisabled();
    expect(screen.getByLabelText("Cantidad 1 de la presentación 1 del producto 1")).toBeDisabled();
    expect(screen.getByRole("button", { name: "+ Agregar producto" })).toBeDisabled();
  });

  it("bloquea productos cuando existen faltantes aun sin recepciones", async () => {
    const shortageOrder = {
      ...orderFixture,
      purchaseShortages: [{ id: 900, productId: 301, quantity: 3, lossAmountNio: 935.05, shortageDate: "2026-08-01", refundStatus: 1 }],
    };
    mockEditRequests(null, shortageOrder);
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    expect(screen.getByText("Esta orden tiene faltantes registrados y sus productos no se pueden modificar.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del producto 1")).toBeDisabled();
    expect(screen.getByRole("button", { name: "+ Agregar producto" })).toBeDisabled();
  });
  it("no intenta guardar una orden con faltantes cerrados", async () => {
    const user = userEvent.setup();
    const fullyShortedOrder = {
      ...orderFixture,
      purchaseShortages: [{ id: 900, productId: 301, quantity: 3, lossAmountNio: 935.05, shortageDate: "2026-08-01", refundStatus: 1 }],
      products: orderFixture.products.map((product) => ({
        ...product,
        presentations: product.presentations.map((presentation) => ({
          ...presentation,
          sizes: presentation.sizes.map((size) => ({ ...size, quantity: 0, receivedQuantity: 0, merchandiseTotalCostNio: 0, unitCostNio: 0 })),
        })),
      })),
    };
    mockEditRequests(null, fullyShortedOrder);
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });
    fireEvent.change(screen.getByLabelText("Comentario interno"), { target: { value: "Solo comentario" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se puede actualizar una orden con recepciones, inventario o faltantes cerrados.");
    expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT")).toBe(false);
    expect(screen.getByRole("heading", { name: "Datos generales" })).toBeInTheDocument();
  });

  it("bloquea productos cuando hay inventario disponible o reservado", async () => {
    const inventoryOrder = {
      ...orderFixture,
      products: orderFixture.products.map((product) => ({
        ...product,
        presentations: product.presentations.map((presentation) => ({
          ...presentation,
          sizes: presentation.sizes.map((size) => ({ ...size, availableQuantity: 1 })),
        })),
      })),
    };
    mockEditRequests(null, inventoryOrder);
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    expect(screen.getByText("Esta orden tiene inventario disponible o reservado y sus productos no se pueden modificar.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del producto 1")).toBeDisabled();

    expect(screen.getByRole("button", { name: "+ Agregar producto" })).toBeDisabled();
  });
  it("rechaza fechas de compra futuras sin abandonar el formulario", async () => {
    const user = userEvent.setup();
    mockEditRequests();

    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });
    fireEvent.change(screen.getByLabelText("Fecha de compra"), { target: { value: "2999-12-31" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La fecha de compra no puede ser futura.");
    expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT")).toBe(false);
    expect(screen.getByRole("heading", { name: "Datos generales" })).toBeInTheDocument();
  });

  it("actualiza solo los datos generales, preserva el contenido requerido y regresa al detalle", async () => {
    const user = userEvent.setup();
    mockEditRequests();

    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    await user.click(screen.getByRole("button", { name: "Proveedor" }));
    await user.click(within(screen.getByRole("listbox", { name: "Proveedor" })).getByRole("option", { name: "Shein" }));
    fireEvent.change(screen.getByLabelText("Fecha de compra"), { target: { value: "2026-08-01" } });
    await user.click(screen.getByRole("button", { name: "Moneda de compra" }));
    await user.click(within(screen.getByRole("listbox", { name: "Moneda de compra" })).getByRole("option", { name: "USD" }));
    fireEvent.change(screen.getByLabelText("Comentario interno"), { target: { value: "  Ajustar envío al recibir  " } });
    fireEvent.change(screen.getByLabelText("Nombre del producto 1"), { target: { value: "Vestido actualizado" } });
    fireEvent.change(screen.getByLabelText("Cantidad 1 de la presentación 1 del producto 1"), { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());

    const updateCall = auth.request.mock.calls.find(
      ([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT",
    );
    expect(updateCall).toBeDefined();
    if (!updateCall) throw new Error("No se encontró la solicitud de actualización.");
    const updateInit = updateCall[1] as RequestInit;
    expect(JSON.parse(String(updateInit.body))).toEqual({
      purchaseDate: "2026-08-01",
      supplierId: 8,
      purchaseCurrencyId: 1,
      supplierShippingCostUsd: 15,
      comments: "Ajustar envío al recibir",
      products: [
        {
          id: 1001,
          supplierProductCode: "SOHO25120",
          name: "Vestido actualizado",
          subcategoryId: 4,
          presentations: [
            {
              name: "Azul",
              sortOrder: 0,
              sizes: [{ sizeId: 12, quantity: 5, unitCost: 935.05 / 3 / 36.62, salePrice: 1250 }],
            },
          ],
        },
      ],
    });
  });

  it("preserva el precio de venta por variante al eliminar otra variante", async () => {
    const user = userEvent.setup();
    const orderWithVariants = {
      ...orderFixture,
      products: [{
        ...orderFixture.products[0],
        presentations: [{
          ...orderFixture.products[0].presentations[0],
          sizes: [
            orderFixture.products[0].presentations[0].sizes[0],
            { ...orderFixture.products[0].presentations[0].sizes[0], id: 302, sizeId: 13, sizeName: "S", salePrice: 1600, quantity: 2, unitCostNio: 250, merchandiseTotalCostNio: 500 },
          ],
        }],
      }],
    };
    mockEditRequests(null, orderWithVariants);
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    await user.click(screen.getByRole("button", { name: "Eliminar talla 1 de la presentación 1 del producto 1" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());

    const updateCall = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT");
    if (!updateCall) throw new Error("No se encontró la solicitud de actualización.");
    const payload = JSON.parse(String((updateCall[1] as RequestInit).body));
    expect(payload.products[0].presentations[0].sizes).toEqual([
      { sizeId: 13, quantity: 2, unitCost: 250, salePrice: 1600 },
    ]);
  });

  it("permite eliminar la primera presentación cuando existe otra", async () => {
    const user = userEvent.setup();
    const orderWithPresentations = {
      ...orderFixture,
      products: [{
        ...orderFixture.products[0],
        presentations: [
          orderFixture.products[0].presentations[0],
          { ...orderFixture.products[0].presentations[0], id: 502, name: "Rojo" },
        ],
      }],
    };
    mockEditRequests(null, orderWithPresentations);
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });
    await user.click(screen.getByRole("button", { name: "Eliminar presentación 1" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());
    const updateCall = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT");
    if (!updateCall) throw new Error("No se encontró la solicitud de actualización.");
    const payload = JSON.parse(String((updateCall[1] as RequestInit).body));
    expect(payload.products[0].presentations).toEqual([{ name: "Rojo", sortOrder: 0, sizes: [{ sizeId: 12, quantity: 3, unitCost: 935.05 / 3, salePrice: 1250 }] }]);
  });
  it("conserva los costos editados al cambiar de moneda", async () => {
    const user = userEvent.setup();
    mockEditRequests();
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    fireEvent.change(screen.getByLabelText("Costo unitario 1 de la presentación 1 del producto 1"), { target: { value: "400" } });
    await user.click(screen.getByRole("button", { name: "Moneda de compra" }));
    await user.click(within(screen.getByRole("listbox", { name: "Moneda de compra" })).getByRole("option", { name: "USD" }));
    await user.click(screen.getByRole("button", { name: "Moneda de compra" }));
    await user.click(within(screen.getByRole("listbox", { name: "Moneda de compra" })).getByRole("option", { name: "C$ — compra local" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());

    const updateCall = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT");
    if (!updateCall) throw new Error("No se encontró la solicitud de actualización.");
    const payload = JSON.parse(String((updateCall[1] as RequestInit).body));
    expect(payload.products[0].presentations[0].sizes[0].unitCost).toBe(400);
  });

  it("muestra el error de actualización y conserva el formulario", async () => {
    const user = userEvent.setup();
    mockEditRequests(new Response(JSON.stringify({ detail: "La orden ya tiene recepción." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));

    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La orden ya tiene recepción.");
    expect(screen.getByRole("heading", { name: "Datos generales" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha de compra")).toHaveValue("2026-07-12");
    expect(screen.queryByText("Detalle de orden")).not.toBeInTheDocument();
  });

  it("carga otra orden después de recuperarse de un error de carga", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/exchange-rates/current") return jsonResponse({ bankRate: 36.62, storeRate: 36.62, startDate: "2026-09-13" });
      if (path === "/api/v1/orders/48") return jsonResponse({ detail: "Orden no disponible" }, 404);
      if (path === "/api/v1/orders/49") return jsonResponse({ ...orderFixture, id: 49 });
      if (path === "/api/v1/suppliers") return jsonResponse(suppliers);
      if (path === "/api/v1/subcategories") return jsonResponse(subcategories);
      if (path === "/api/v1/sizes") return jsonResponse(sizes);
      return jsonResponse({});
    });

    render(
      <MemoryRouter initialEntries={["/purchases/orders/48/edit"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/purchases/orders/:id/edit" element={<><PurchaseOrderEditPage /><OrderNavigationProbe /></>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "No encontramos esta orden" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cambiar orden" }));
    expect(await screen.findByRole("heading", { name: "Datos generales" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del producto 1")).toHaveValue("Vestido satinado");
  });

  it("preserva los datos de la presentación original al duplicarla", async () => {
    const user = userEvent.setup();
    mockEditRequests();
    renderEdit();
    await screen.findByRole("heading", { name: "Datos generales" });

    await user.click(screen.getByRole("button", { name: "Duplicar presentación 1" }));
    fireEvent.change(screen.getByLabelText("Presentación 2 del producto 1"), { target: { value: "Rojo" } });
    await user.click(screen.getByRole("button", { name: "Moneda de compra" }));
    await user.click(within(screen.getByRole("listbox", { name: "Moneda de compra" })).getByRole("option", { name: "USD" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());

    const updateCall = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/orders/48" && init?.method === "PUT");
    if (!updateCall) throw new Error("No se encontró la solicitud de actualización.");
    const payload = JSON.parse(String((updateCall[1] as RequestInit).body));
    expect(payload.products[0].presentations[1].sizes).toEqual([
      { sizeId: 12, quantity: 3, unitCost: 935.05 / 3 / 36.62, salePrice: 1250 },
    ]);
  });
});
