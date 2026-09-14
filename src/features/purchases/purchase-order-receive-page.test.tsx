import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../shared/layout/app-shell";
import { PurchaseOrderReceivePage } from "./purchase-order-receive-page";
import { type OrderDTO, type OrderTrackingNumberDTO } from "./purchase-order-types";

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request, status: "authenticated" }),
}));

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
  receivedAmountNio: 935.05,
  comments: "Compra de agosto",
  merchandiseTotalNio: 1870.1,
  supplierShippingCostUsd: 15,
  warehouseShippingCostUsd: 0,
  totalCostNio: 2420.1,
  exchangeRate: 36.62,
  products: [{
    id: 1001,
    supplierProductCode: "SOHO25120",
    code: 25120,
    name: "Vestido satinado",
    subcategoryId: 4,
    subcategoryName: "Vestidos",
    presentations: [{
      id: 501,
      name: "Azul",
      sortOrder: 0,
      sizes: [{
        id: 301,
        sizeId: 12,
        sizeName: "M",
        quantity: 5,
        receivedQuantity: 2,
        availableQuantity: 0,
        reservedQuantity: 0,
        unitCostUsd: 8.5,
        merchandiseTotalCostNio: 1870.1,
        allocatedShippingCostNio: 0,
        totalCostNio: 1870.1,
        unitCostNio: 374.02,
        salePrice: 1250,
      }],
    }],
  }],
  purchaseShortages: [],
  supplierRefund: null,
  totalShortageLossNio: null,
  totalSupplierRefundNio: null,
  netShortageLossNio: null,
  supplierRefundDeclinedAt: null,
  supplierRefundDeclineComments: null,
};

const trackingFixture: OrderTrackingNumberDTO = {
  id: 22,
  orderId: 48,
  shippingCompanyId: 2,
  trackingNumber: "SOHO-782190",
  supplierShipmentDate: "2026-07-13",
  warehouseDeliveryDate: null,
  productReceiptId: null,
  weight: 0,
  shippingCost: 0,
  shippingCompanyName: "Cargo Express",
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function today() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function renderReceive() {
  return render(
    <MemoryRouter initialEntries={["/purchases/orders/48/receive"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/purchases/orders/:id/receive" element={<PurchaseOrderReceivePage />} />
          <Route path="/purchases/orders/:id" element={<p>Detalle de orden</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

async function confirmReceipt(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Guardar recepción" }));
  await user.click(screen.getByRole("button", { name: "Confirmar recepción" }));
}

function mockReceiveRequests({
  order = orderFixture,
  tracking = [] as OrderTrackingNumberDTO[],
  postResponse = null as Response | null,
} = {}) {
  auth.request.mockImplementation((path: string, init?: RequestInit) => {
    if (path === "/api/v1/orders/48/receipts" && init?.method === "POST") {
      return postResponse ? Promise.resolve(postResponse) : jsonResponse({ id: 71 });
    }
    if (path === "/api/v1/orders/48/tracking-numbers") return jsonResponse(tracking);
    if (path === "/api/v1/orders/48") return jsonResponse(order);
    return jsonResponse({});
  });
}

function variantLabel() {
  return "Vestido satinado - Azul - M";
}

afterEach(() => {
  auth.request.mockReset();
  vi.restoreAllMocks();
});

describe("PurchaseOrderReceivePage", () => {
  it("carga la orden y muestra las cantidades iniciales", async () => {
    mockReceiveRequests();

    renderReceive();

    expect(await screen.findByRole("heading", { name: "Registrar recepción de orden #48" })).toBeInTheDocument();
    const header = within(document.querySelector(".pw-topbar") as HTMLElement);
    expect(header.getByRole("link", { name: /regresar al detalle/i })).not.toHaveClass("min-h-11");
    expect(screen.getByLabelText("Fecha de recepción")).toHaveValue(today());
    const table = screen.getByRole("table", { name: "Tallas a recibir de Vestido satinado" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "Presentación",
      "Talla",
      "Compradas",
      "Recibidas",
      "Cantidad a recibir",
      "Peso",
      "Costo unit. (C$)ⓘEstimado: incluye el costo de envío prorrateado según el peso por unidad y la cantidad recibida.",
      "Precio de venta (C$)",
      "Ganancia estimada (C$)",
      "Sobrante",
    ]);
    expect(table).toHaveTextContent("C$374.02");
    expect(table).toHaveTextContent("C$875.98");
    expect(within(table).getByRole("columnheader", { name: "Compradas" })).toHaveClass("text-center");
    const estimatedCostHeader = within(table).getByRole("columnheader", { name: /Costo unit\. \(C\$\)/ });
    expect(estimatedCostHeader).toHaveClass("text-center");
    const estimatedCostInfo = within(estimatedCostHeader).getByRole("button", { name: "Información sobre el costo unitario estimado" });
    expect(estimatedCostInfo).toHaveAttribute("title", "Estimado: incluye el costo de envío prorrateado según el peso por unidad y la cantidad recibida.");
    expect(within(table).getByRole("cell", { name: "C$374.02" })).toHaveClass("text-center");
    expect(within(table).getByRole("cell", { name: "C$875.98" })).toHaveClass("text-center");
    expect(screen.queryByText(/^Orden #48$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Al confirmar")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad recibida de " + variantLabel())).toHaveValue(0);
    expect(screen.getByLabelText("Peso recibido de " + variantLabel())).toHaveValue(1);
    expect(screen.getByLabelText("Precio de venta de " + variantLabel())).toHaveValue(1250);
    expect(screen.getByLabelText("Envío de bodega a Nicaragua (USD)")).toBeInTheDocument();
    expect(screen.getByLabelText("Comentario de recepción")).toHaveValue("");
  });

  it("prorratea el envio por peso y cantidad y calcula la ganancia con el costo estimado", async () => {
    const secondProduct = {
      ...orderFixture.products[0],
      id: 1002,
      supplierProductCode: "SOHO25121",
      name: "Blusa basica",
      presentations: [{
        ...orderFixture.products[0].presentations[0],
        id: 502,
        name: "Negra",
        sizes: [{
          ...orderFixture.products[0].presentations[0].sizes[0],
          id: 302,
          sizeName: "Unitalla",
          unitCostNio: 100,
          salePrice: 600,
        }],
      }],
    };
    const user = userEvent.setup();
    mockReceiveRequests({ order: { ...orderFixture, products: [orderFixture.products[0], secondProduct] } });

    renderReceive();

    await screen.findByRole("heading", { name: "Registrar recepci\u00f3n de orden #48" });
    fireEvent.change(screen.getByLabelText("Cantidad recibida de " + variantLabel()), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Peso recibido de " + variantLabel()), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Env\u00edo de bodega a Nicaragua (USD)"), { target: { value: "10" } });

    const secondLabel = "Blusa basica - Negra - Unitalla";
    fireEvent.change(screen.getByLabelText("Cantidad recibida de " + secondLabel), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Peso recibido de " + secondLabel), { target: { value: "3" } });

    const firstTable = screen.getByRole("table", { name: "Tallas a recibir de Vestido satinado" });
    const secondTable = screen.getByRole("table", { name: "Tallas a recibir de Blusa basica" });
    expect(within(firstTable).getByRole("cell", { name: "C$447.26" })).toBeInTheDocument();
    expect(within(firstTable).getByRole("cell", { name: "C$802.74" })).toBeInTheDocument();
    expect(within(secondTable).getByRole("cell", { name: "C$319.72" })).toBeInTheDocument();
    expect(within(secondTable).getByRole("cell", { name: "C$280.28" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar recepci\u00f3n" }));
    expect(screen.getByRole("dialog", { name: "Confirmar recepci\u00f3n" })).toBeInTheDocument();
  });

  it("identifica las validaciones de producto por código y resalta el campo con error", async () => {
    const user = userEvent.setup();
    mockReceiveRequests();
    renderReceive();
    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });

    const quantity = screen.getByLabelText("Cantidad recibida de " + variantLabel());
    fireEvent.change(quantity, { target: { value: "1.5" } });
    await confirmReceipt(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("código de proveedor SOHO25120");
    expect(alert).not.toHaveTextContent("Vestido satinado");
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(quantity).toHaveClass("aria-invalid:border-red-500");
    expect(quantity.closest("tr")).toHaveClass("bg-red-50");
  });

  it("no envía la recepción al presionar Enter dentro de un input", async () => {
    mockReceiveRequests();
    renderReceive();
    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });

    const quantity = screen.getByLabelText("Cantidad recibida de " + variantLabel());
    expect(fireEvent.keyDown(quantity, { key: "Enter", code: "Enter", charCode: 13 })).toBe(false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/orders/48/receipts" && init?.method === "POST")).toBe(false);
  });

  it("requiere confirmar antes de enviar la recepción y permite cancelar", async () => {
    const user = userEvent.setup();
    mockReceiveRequests();
    renderReceive();
    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });

    await user.click(screen.getByRole("button", { name: "Guardar recepción" }));

    expect(screen.getByRole("dialog", { name: "Confirmar recepción" })).toHaveTextContent("¿Deseas registrar esta recepción?");
    expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/orders/48/receipts" && init?.method === "POST")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/orders/48/receipts" && init?.method === "POST")).toBe(false);
  });

  it("muestra guion cuando una variante no tiene precio de venta", async () => {
    const product = orderFixture.products[0];
    const presentation = product.presentations[0];
    mockReceiveRequests({
      order: {
        ...orderFixture,
        products: [{
          ...product,
          presentations: [{
            ...presentation,
            sizes: [{ ...presentation.sizes[0], salePrice: null }],
          }],
        }],
      },
    });

    renderReceive();

    const table = await screen.findByRole("table", { name: "Tallas a recibir de Vestido satinado" });
    expect(table).toHaveTextContent("—");
  });

  it("evita mostrar NaN cuando falta el costo unitario", async () => {
    const product = orderFixture.products[0];
    const presentation = product.presentations[0];
    mockReceiveRequests({
      order: {
        ...orderFixture,
        products: [{
          ...product,
          presentations: [{
            ...presentation,
            sizes: [{ ...presentation.sizes[0], unitCostNio: Number.NaN }],
          }],
        }],
      },
    });

    renderReceive();

    const table = await screen.findByRole("table", { name: "Tallas a recibir de Vestido satinado" });
    expect(table).not.toHaveTextContent("NaN");
    expect(within(table).getAllByText("—")).toHaveLength(2);
  });

  it("coloca los trackings arriba y muestra las variantes como filas de una tabla", async () => {
    const user = userEvent.setup();
    mockReceiveRequests({ tracking: [trackingFixture] });
    renderReceive();

    expect(await screen.findByRole("heading", { name: "Registrar recepción de orden #48" })).toBeInTheDocument();
    const trackingHeading = screen.getByRole("heading", { name: "Trackings a recibir" });
    const table = screen.getByRole("table", { name: "Tallas a recibir de Vestido satinado" });
    const trackingWeight = screen.getByLabelText("Peso del tracking SOHO-782190");
    const trackingShipping = screen.getByLabelText("Costo de envío del tracking SOHO-782190 (USD)");
    const shippingCurrency = screen.getByText("$", { selector: "span" });
    const comment = screen.getByRole("textbox", { name: "Comentario de recepción" });
    const summaryHeading = screen.getByRole("heading", { name: "Resumen de recepción" });

    expect(trackingHeading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trackingWeight).toBeDisabled();
    expect(trackingShipping).toBeDisabled();
    expect(trackingWeight).toHaveClass("w-20");
    expect(trackingShipping).toHaveClass("w-20");
    expect(shippingCurrency).toHaveAttribute("aria-hidden", "true");
    expect(shippingCurrency.parentElement).toContainElement(trackingShipping);
    expect(screen.queryByText("Selecciona los paquetes que llegaron en esta recepción y completa su peso y envío.")).not.toBeInTheDocument();
    expect(screen.queryByText("Las cantidades no seleccionadas no se incluyen en esta recepción.")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Recibir tracking SOHO-782190"));
    expect(trackingWeight).toBeEnabled();
    expect(trackingShipping).toBeEnabled();
    expect(within(table).getByRole("columnheader", { name: "Talla" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Compradas" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Recibidas" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Pendientes" })).not.toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Peso" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Cantidad a recibir" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Sobrante" })).toBeInTheDocument();
    expect(comment.compareDocumentPosition(summaryHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("agrupa las tallas en una tabla por producto y muestra el código del proveedor", async () => {
    const secondProduct = {
      ...orderFixture.products[0],
      id: 1002,
      supplierProductCode: "SOHO25121",
      name: "Bolsa de noche",
      presentations: [{
        ...orderFixture.products[0].presentations[0],
        id: 502,
        name: "Negra",
        sizes: [{
          ...orderFixture.products[0].presentations[0].sizes[0],
          id: 302,
          sizeName: "Unitalla",
        }],
      }],
    };
    mockReceiveRequests({ order: { ...orderFixture, products: [orderFixture.products[0], secondProduct] } });

    renderReceive();

    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });

    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Vestido satinado" })).toBeInTheDocument();
    expect(screen.getAllByText("Código proveedor")).toHaveLength(2);
    expect(screen.getByText("SOHO25120")).toHaveClass("text-sm", "font-extrabold", "text-pw-brand-deep");
    expect(screen.getByRole("heading", { name: "Vestido satinado" })).toHaveClass("text-xs", "font-semibold", "text-pw-muted");
    expect(screen.getByRole("heading", { name: "Bolsa de noche" })).toBeInTheDocument();
    expect(screen.getByText("SOHO25121")).toHaveClass("text-sm", "font-extrabold", "text-pw-brand-deep");
    expect(screen.getByRole("table", { name: "Tallas a recibir de Bolsa de noche" })).toBeInTheDocument();
  });

  it("envía una recepción normal y regresa al detalle", async () => {
    const user = userEvent.setup();
    mockReceiveRequests();
    renderReceive();
    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });

    fireEvent.change(screen.getByLabelText("Cantidad recibida de " + variantLabel()), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Peso recibido de " + variantLabel()), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Precio de venta de " + variantLabel()), { target: { value: "1500" } });
    fireEvent.change(screen.getByLabelText("Envío de bodega a Nicaragua (USD)"), { target: { value: "10" } });
    await user.type(screen.getByLabelText("Comentario de recepción"), "Llegó en buen estado");
    await confirmReceipt(user);

    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());
    const call = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/orders/48/receipts" && init?.method === "POST");
    expect(call).toBeDefined();
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
      receivedDate: today() + "T00:00:00.000Z",
      warehouseShippingCostUsd: 10,
      comments: "Llegó en buen estado",
      trackingNumbers: [],
      productVariants: [{ productId: 301, quantity: 3, weight: 1.5, salePrice: 1500, isSurplus: false }],
    });
  });

  it("envía una cantidad marcada como sobrante", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockReceiveRequests();
    renderReceive();
    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });

    fireEvent.change(screen.getByLabelText("Cantidad recibida de " + variantLabel()), { target: { value: "4" } });
    await user.click(screen.getByLabelText("Marcar como sobrante " + variantLabel()));
    await confirmReceipt(user);

    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());
    const call = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/orders/48/receipts" && init?.method === "POST");
    expect(JSON.parse(String((call?.[1] as RequestInit).body)).productVariants[0]).toEqual({
      productId: 301,
      quantity: 4,
      weight: 1,
      salePrice: 1250,
      isSurplus: true,
    });
  });

  it("envía el tracking seleccionado con su peso y costo", async () => {
    const user = userEvent.setup();
    mockReceiveRequests({ tracking: [trackingFixture] });
    renderReceive();
    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });

    expect(screen.queryByLabelText("Envío de bodega a Nicaragua (USD)")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Recibir tracking SOHO-782190"));
    fireEvent.change(screen.getByLabelText("Peso del tracking SOHO-782190"), { target: { value: "2.25" } });
    fireEvent.change(screen.getByLabelText("Costo de envío del tracking SOHO-782190 (USD)"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Cantidad recibida de " + variantLabel()), { target: { value: "3" } });
    await confirmReceipt(user);

    await waitFor(() => expect(screen.getByText("Detalle de orden")).toBeInTheDocument());
    const call = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/orders/48/receipts" && init?.method === "POST");
    expect(JSON.parse(String((call?.[1] as RequestInit).body)).trackingNumbers).toEqual([
      { id: 22, weight: 2.25, shippingCostUsd: 18 },
    ]);
  });

  it("muestra el error de recepción y conserva el formulario", async () => {
    const user = userEvent.setup();
    mockReceiveRequests({
      postResponse: new Response(JSON.stringify({ detail: "El tracking ya fue recepcionado." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    });
    renderReceive();
    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });
    fireEvent.change(screen.getByLabelText("Cantidad recibida de " + variantLabel()), { target: { value: "1" } });
    await confirmReceipt(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("El tracking ya fue recepcionado.");
    expect(screen.getByRole("heading", { name: "Registrar recepción de orden #48" })).toBeInTheDocument();
    expect(screen.queryByText("Detalle de orden")).not.toBeInTheDocument();
  });
  it("conserva como orden con tracking una orden cuyos trackings ya fueron recepcionados", async () => {
    mockReceiveRequests({ tracking: [{ ...trackingFixture, productReceiptId: 71 }] });
    renderReceive();

    expect(await screen.findByRole("heading", { name: "Registrar recepción de orden #48" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trackings a recibir" })).toBeInTheDocument();
    expect(screen.getByLabelText("Recibir tracking SOHO-782190")).toBeDisabled();
    expect(screen.queryByLabelText("Envío de bodega a Nicaragua (USD)")).not.toBeInTheDocument();
    expect(screen.getByText("Todos los trackings de esta orden ya fueron recepcionados. Agrega un tracking nuevo antes de continuar.")).toBeInTheDocument();
  });
  it("confirma explícitamente una recepción marcada como sobrante", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockReceiveRequests();
    renderReceive();
    await screen.findByRole("heading", { name: "Registrar recepción de orden #48" });

    fireEvent.change(screen.getByLabelText("Cantidad recibida de " + variantLabel()), { target: { value: "4" } });
    await user.click(screen.getByLabelText("Marcar como sobrante " + variantLabel()));
    await confirmReceipt(user);

    expect(confirm).toHaveBeenCalledWith("La recepción incluye cantidades sobrantes y aumentará el inventario por encima de lo comprado. ¿Deseas continuar?");
    expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/orders/48/receipts" && init?.method === "POST")).toBe(false);
    expect(screen.getByRole("heading", { name: "Registrar recepción de orden #48" })).toBeInTheDocument();
  });
});
