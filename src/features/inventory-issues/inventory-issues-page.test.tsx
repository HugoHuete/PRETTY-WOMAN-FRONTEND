import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PageActionsProvider, usePageActions } from "../../shared/layout/page-actions-context";
import { InventoryIssuesPage } from "./inventory-issues-page";

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request, session: { user: { roles: ["Admin"] } } }),
}));

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function issueDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 1042,
    productId: 42,
    productVariantId: 70,
    productName: "Vestido satinado",
    productCode: 1042,
    sizeName: "M",
    variant: "Coral",
    productInventoryIssueTypeId: 1,
    productInventoryIssueTypeName: "Damaged",
    productInventoryIssueStatusId: 1,
    productInventoryIssueStatusName: "Open",
    quantity: 1,
    issueDate: "2026-08-22T13:10:00Z",
    resolvedAt: null,
    comments: "Presenta una mancha visible.",
    createdAt: "2026-08-22T13:10:00Z",
    updatedAt: null,
    ...overrides,
  };
}

function listResponse(items = [issueDto()]) {
  return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
}

function ActionHost() {
  const { action } = usePageActions();
  return <>{action}</>;
}

function productsResponse() {
  return {
    items: [{
      id: 42,
      supplierProductCode: "PROV-42",
      code: 1042,
      name: "Vestido satinado",
      subcategoryId: 2,
      subcategoryName: "Vestidos",
      categoryId: 1,
      categoryName: "Ropa",
      primaryImageUrl: "/images/producto-prueba.jpg",
      presentations: [{
        id: 8,
        name: "Coral",
        sortOrder: 1,
        primaryImageUrl: "/images/producto-prueba.jpg",
        sizes: [{
          id: 70,
          sizeId: 3,
          sizeName: "M",
          quantity: 5,
          receivedQuantity: 5,
          availableQuantity: 5,
          reservedQuantity: 0,
          unavailableQuantity: 0,
          salePrice: 850,
          unitCostNio: 400,
          discountedSalePrice: null,
          discountCampaignId: null,
          discountCampaignName: null,
        }],
      }],
    }],
    page: 1,
    pageSize: 20,
    totalCount: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}
function renderIssuesAt(path = "/inventory/issues") {
  window.history.replaceState({}, "", path);
  return render(<MemoryRouter initialEntries={[path]}><PageActionsProvider><InventoryIssuesPage /><ActionHost /></PageActionsProvider></MemoryRouter>);
}

afterEach(() => auth.request.mockReset());

describe("InventoryIssuesPage", () => {
  it("renders incident rows with localized type and status", async () => {
    auth.request.mockImplementation(() => jsonResponse(listResponse()));
    renderIssuesAt();

    expect(await screen.findByText("Vestido satinado")).toBeVisible();
    expect(screen.getAllByText("Dañada").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Abierta").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Coral")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver detalle de INC-1042" })).toHaveAttribute("href", "/inventory/issues/1042");
  });

  it("keeps the incident table compact and separates variant from size", async () => {
    const longProductName = "Pañuelo cuadrado pequeño de satén de seda con estampado de limón para la cabeza, playa, calle, accesorios";
    auth.request.mockImplementation(() => jsonResponse(listResponse([issueDto({ productName: longProductName })])));
    renderIssuesAt();

    const productName = await screen.findByText(longProductName);
    expect(productName).toHaveClass("max-w-[18rem]", "truncate");
    expect(screen.getByRole("columnheader", { name: "Variante" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Talla" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Fecha" })).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "Variante y talla" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Reportada /)).not.toBeInTheDocument();
  });

  it("requests product code and type/status ids from URL filters", async () => {
    auth.request.mockImplementation(() => jsonResponse(listResponse()));
    renderIssuesAt("/inventory/issues?productCode=1042&type=damaged&status=open");

    await screen.findByText("Vestido satinado");
    expect(auth.request).toHaveBeenCalledWith("/api/v1/product-inventory-issues?page=1&pageSize=20&productCode=1042&productInventoryIssueTypeId=1&productInventoryIssueStatusId=1");
  });

  it("updates the URL when changing a filter and can clear it", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation(() => jsonResponse(listResponse()));
    renderIssuesAt();

    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Tipo" }));
    expect(screen.getByRole("listbox", { name: "Tipo" })).toBeVisible();
    await user.click(within(screen.getByRole("listbox", { name: "Tipo" })).getByRole("option", { name: "Dañada" }));
    await waitFor(() => expect(auth.request).toHaveBeenCalledWith("/api/v1/product-inventory-issues?page=1&pageSize=20&productInventoryIssueTypeId=1"));
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => expect(auth.request).toHaveBeenLastCalledWith("/api/v1/product-inventory-issues?page=1&pageSize=20"));
  });

  it("uses the shared dropdown style for type and status filters", async () => {
    auth.request.mockImplementation(() => jsonResponse(listResponse()));
    renderIssuesAt();

    await screen.findByText("Vestido satinado");
    expect(screen.getByRole("button", { name: "Tipo" })).toHaveClass("pw-select-trigger");
    expect(screen.getByRole("button", { name: "Estado" })).toHaveClass("pw-select-trigger");
    expect(screen.queryByRole("combobox", { name: "Tipo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Estado" })).not.toBeInTheDocument();
  });

  it("shows a filtered empty state", async () => {
    auth.request.mockImplementation(() => jsonResponse(listResponse([])));
    renderIssuesAt("/inventory/issues?productCode=9999");

    expect(await screen.findByText("No hay incidencias que coincidan")).toBeVisible();
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeVisible();
  });

  it("shows forbidden and retryable errors", async () => {
    auth.request.mockImplementation(() => jsonResponse({ detail: "No tienes permiso." }, 403));
    renderIssuesAt();
    expect(await screen.findByText("No tienes permiso para ver esta sección.")).toBeVisible();

    auth.request.mockImplementation(() => jsonResponse({ detail: "Servicio no disponible." }, 500));
    renderIssuesAt();
    expect(await screen.findByText("Servicio no disponible.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  it("creates an inventory issue from the admin action and refreshes the list", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/products?")) return jsonResponse(productsResponse());
      if (path === "/api/v1/product-inventory-issues" && init?.method === "POST") return jsonResponse(1043, 201);
      return jsonResponse(listResponse());
    });
    renderIssuesAt();

    await screen.findByText("Vestido satinado");
    await user.click(await screen.findByRole("button", { name: "Nueva incidencia" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva incidencia" });
    expect(dialog).toBeVisible();

    await user.type(screen.getByLabelText("Código del producto"), "1042");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    expect(auth.request).toHaveBeenCalledWith("/api/v1/products?page=1&pageSize=20&code=1042&availability=1");
    const searchRow = screen.getByLabelText("Código del producto").closest("label")?.parentElement;
    const typeRow = screen.getByRole("button", { name: "Tipo de incidencia" }).closest("label")?.parentElement;
    expect(searchRow).toHaveClass("sm:grid-cols-[minmax(0,1fr)_7rem]");
    expect(typeRow).toHaveClass("sm:grid-cols-[minmax(0,1fr)_7rem]");

    expect(screen.getAllByText("Vestido satinado").length).toBeGreaterThan(1);
    expect(screen.getByText(/PROV-42/)).toBeVisible();
    expect(dialog).toHaveClass("min-w-0", "overflow-x-hidden");
    expect(screen.getByText(/PROV-42/).closest("div.flex")).toHaveClass("min-w-0");
    expect(await screen.findByAltText("Imagen de Vestido satinado")).toBeVisible();
    expect(screen.queryByText("RESULTADOS")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fecha de la incidencia")).not.toBeInTheDocument();
    expect(screen.queryByText("Registra una incidencia sobre una variante existente.")).not.toBeInTheDocument();
    const typeField = screen.getByRole("button", { name: "Tipo de incidencia" }).closest("label");
    const quantityField = screen.getByLabelText("Cantidad").closest("label");
    expect(typeField?.parentElement).toHaveClass("sm:grid-cols-[minmax(0,1fr)_7rem]");
    expect(quantityField?.parentElement).toBe(typeField?.parentElement);
    expect(screen.getByLabelText("Cantidad")).toHaveClass("w-full", "min-w-0");
    expect(screen.getByRole("button", { name: "Buscar" })).toHaveClass("w-full");
    await user.click(screen.getByRole("button", { name: "Variante y talla" }));
    await user.click(within(screen.getByRole("listbox", { name: "Variante y talla" })).getByRole("option", { name: /Coral · Talla M/ }));
    expect(screen.getByRole("button", { name: "Variante y talla" })).toHaveTextContent("Coral · Talla M");
    await user.click(screen.getByRole("button", { name: "Tipo de incidencia" }));
    const issueTypeListbox = screen.getByRole("listbox", { name: "Tipo de incidencia" });
    expect(issueTypeListbox.closest("form")).not.toBe(dialog);
    await user.click(within(issueTypeListbox).getByRole("option", { name: "Dañada" }));
    expect(screen.getByRole("button", { name: "Tipo de incidencia" })).toHaveTextContent("Dañada");
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.type(screen.getByLabelText("Cantidad"), "2");
    await user.type(screen.getByLabelText("Comentarios"), "Costura lateral descosida.");
    await user.click(screen.getByRole("button", { name: "Crear incidencia" }));

    await waitFor(() => expect(auth.request.mock.calls.some(([path, init]) => path === "/api/v1/product-inventory-issues" && init?.method === "POST")).toBe(true));
    const postCall = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/product-inventory-issues" && init?.method === "POST");
    const postBody = postCall ? JSON.parse(String(postCall[1].body)) : null;
    expect(postBody).toMatchObject({
      productId: 70,
      productInventoryIssueTypeId: 1,
      quantity: 2,
      comments: "Costura lateral descosida.",
    });
    expect(postBody.issueDate).toMatch(/Z$/);
    expect(Number.isNaN(Date.parse(postBody.issueDate))).toBe(false);
    await waitFor(() => expect(auth.request.mock.calls.filter(([path, init]) => path.startsWith("/api/v1/product-inventory-issues?") && !init?.method).length).toBeGreaterThan(1));
    expect(screen.queryByRole("dialog", { name: "Nueva incidencia" })).not.toBeInTheDocument();
  });});
