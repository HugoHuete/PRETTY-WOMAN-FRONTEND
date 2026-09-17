import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PageActionsProvider } from "../../shared/layout/page-actions-context";
import { ToastProvider } from "../../shared/ui/toast-provider";
import { ProductsPage } from "./products-page";
import { buildProductsPath, type ProductFilters, type ProductImageDTO } from "./product-types";

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request }),
}));

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    supplierProductCode: "VSAT-CRL",
    code: 1042,
    name: "Vestido satinado",
    subcategoryId: 8,
    subcategoryName: "Vestidos de noche",
    categoryId: 2,
    categoryName: "Vestidos",
    primaryImageUrl: null,
    presentations: [
      {
        id: 7,
        name: "Coral",
        sortOrder: 0,
        primaryImageUrl: null,
        sizes: [
          {
            id: 70,
            sizeId: 3,
            sizeName: "M",
            sizeGroupId: 1,
            sizeGroupName: "Ropa",
            quantity: 5,
            receivedQuantity: 5,
            availableQuantity: 3,
            reservedQuantity: 1,
            unavailableQuantity: 1,
            salePrice: 1250,
            unitCostNio: 520,
            discountedSalePrice: null,
            discountCampaignId: null,
            discountCampaignName: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

const presentationPrimaryImage = (): ProductImageDTO => ({
  id: 42,
  thumbnailUrl: "/images/coral-thumb.webp",
  webUrl: "/images/coral.webp",
  productPresentationId: 7,
  isPrimary: true,
  sortOrder: 0,
});
const presentationSecondaryImage = (): ProductImageDTO => ({
  id: 43,
  thumbnailUrl: "/images/coral-2-thumb.webp",
  webUrl: "/images/coral-2.webp",
  productPresentationId: 7,
  isPrimary: false,
  sortOrder: 1,
});
function paginated(items = [product()]) {
  return {
    items,
    page: 1,
    pageSize: 20,
    totalCount: items.length,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

function renderProducts() {
  return render(
    <MemoryRouter>
      <PageActionsProvider>
        <ToastProvider>
          <ProductsPage />
        </ToastProvider>
      </PageActionsProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  auth.request.mockReset();
  vi.restoreAllMocks();
});

describe("buildProductsPath", () => {
  it("serializes filters while keeping presentations inside each product", () => {
    const filters: ProductFilters = {
      page: 2,
      pageSize: 20,
      code: "1042",
      categoryId: "2",
      subcategoryId: "8",
      sizeId: "3",
      availability: "1",
    };

    expect(buildProductsPath(filters)).toBe(
      "/api/v1/products?page=2&pageSize=20&availability=1&code=1042&categoryId=2&subcategoryId=8&sizeId=3",
    );
  });
});

describe("ProductsPage", () => {
  it("renders a product with presentation count and stock totals", async () => {
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([{ id: 2, name: "Vestidos" }]);
      if (path === "/api/v1/sizes") return jsonResponse([{ id: 3, name: "M" }]);
      if (path === "/api/v1/subcategories") return jsonResponse([{ id: 8, categoryId: 2, name: "Vestidos de noche" }]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();

    expect(await screen.findByText("Vestido satinado")).toBeVisible();
    expect(screen.getByText("1 presentación")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Disponibilidad" })).toHaveTextContent("Disponible");
  });

  it("defaults availability filter to available", async () => {
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();

    await screen.findByText("Vestido satinado");
    expect(screen.getByRole("button", { name: "Disponibilidad" })).toHaveTextContent("Disponible");
    expect(auth.request).toHaveBeenCalledWith("/api/v1/products?page=1&pageSize=20&availability=1");
  });

  it("keeps the unfiltered availability option after choosing Todos", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Disponibilidad" }));
    await user.click(screen.getAllByRole("option", { name: "Todos" }).find((option) => option.tagName === "BUTTON")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Disponibilidad" })).toHaveTextContent("Todos");
    });
    expect(auth.request).toHaveBeenCalledWith("/api/v1/products?page=1&pageSize=20");
  });

  it("shows movement dates as calendar dates", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/variants/70/inventory-movements") return jsonResponse([
        {
          id: 501,
          productId: 42,
          productVariantId: 70,
          sizeName: "M",
          variant: "Coral",
          movementDate: "2026-09-12",
          inventoryMovementTypeName: "Recepción de compra",
          fromStockBucketName: "Externo",
          toStockBucketName: "Disponible",
          quantity: 5,
        },
      ]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await user.click((await screen.findAllByRole("button", { name: "Ver detalles de Vestido satinado" })).find((button) => button.getAttribute("aria-expanded") === "false")!);
    await user.click(screen.getByRole("button", { name: "Ver movimientos de Coral · M" }));

    const dialog = await screen.findByRole("dialog", { name: "Movimientos de inventario" });
    expect(dialog).toHaveTextContent("12 sept 2026");
  });

  it("shows supplier code under the product and separates category columns", async () => {
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();

    await screen.findByText("Vestido satinado");
    expect(screen.getByRole("columnheader", { name: /C.digo/ })).toBeVisible();
    expect(screen.getByRole("table", { name: /Productos agrupados/ })).toHaveClass("table-fixed", "min-w-[1100px]");
    expect(screen.getByRole("columnheader", { name: /Categor/ })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: /Subcategor/ })).toBeVisible();
    expect(screen.getByRole("cell", { name: /Vestido satinado.*VSAT-CRL/ })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Vestidos" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Vestidos de noche" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: /^Precio$/ })).toBeVisible();
    expect(screen.getByRole("table", { name: "Productos agrupados por producto, con sus presentaciones y disponibilidad." })).toHaveClass("w-full");
    expect(screen.queryByText(/Cada color se gestiona/)).not.toBeInTheDocument();
    const productRow = screen.getAllByRole("row").find((row) => row.textContent?.includes("Vestido satinado"))!;
    const productCells = productRow.querySelectorAll("td");
    expect(productCells[1]).toHaveClass("text-center");
    expect(productCells[5]).toHaveClass("text-center");
    expect(productCells[6]).toHaveClass("text-center");
    expect(productCells[7]).toHaveClass("text-center");
  });

  it("renders the view switch as a segmented control with the table selected", async () => {
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();

    await screen.findByText("Vestido satinado");
    expect(screen.getByRole("button", { name: "Tabla" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tabla" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: /Cuadr/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("expands product details inline with presentation, size, cost, and stock", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();
    await user.click((await screen.findAllByRole("button", { name: "Ver detalles de Vestido satinado" })).find((button) => button.getAttribute("aria-expanded") === "false")!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Variantes de Vestido satinado" })).toHaveTextContent("Coral");
    expect(screen.getByRole("table", { name: "Variantes de Vestido satinado" })).toHaveTextContent("M");
    expect(screen.getByRole("table", { name: "Variantes de Vestido satinado" }).parentElement).toHaveClass("w-full");
    expect(screen.getByRole("table", { name: "Variantes de Vestido satinado" })).not.toHaveTextContent("Talla M");
    expect(screen.getByRole("table", { name: "Variantes de Vestido satinado" })).toHaveTextContent("C$520.00");
    const detailTable = screen.getByRole("table", { name: "Variantes de Vestido satinado" });
    const detailRow = within(detailTable).getAllByRole("row").find((row) => row.textContent?.includes("C$520.00"))!;
    const detailCells = detailRow.querySelectorAll("td");
    expect(detailCells[2]).toHaveClass("text-center");
    expect(detailCells[3]).toHaveClass("text-center");
    expect(detailCells[4]).toHaveClass("text-center");
    expect(detailCells[5]).toHaveClass("text-center");
    expect(within(detailRow).getByRole("button", { name: "Ver movimientos de Coral · M" })).toBeVisible();

  });

  it("loads inventory movements for a selected variant", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/variants/70/inventory-movements") return jsonResponse([
        {
          id: 501,
          productId: 42,
          productVariantId: 70,
          sizeName: "M",
          variant: "Coral",
          movementDate: "2026-09-12T10:00:00Z",
          inventoryMovementTypeName: "Recepción de compra",
          fromStockBucketName: "Externo",
          toStockBucketName: "Disponible",
          quantity: 5,
        },
      ]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await user.click((await screen.findAllByRole("button", { name: "Ver detalles de Vestido satinado" })).find((button) => button.getAttribute("aria-expanded") === "false")!);
    await user.click(screen.getByRole("button", { name: "Ver movimientos de Coral · M" }));

    const dialog = await screen.findByRole("dialog", { name: "Movimientos de inventario" });
    expect(within(dialog).getByRole("heading", { name: "Movimientos de inventario" })).toBeVisible();
    expect(within(dialog).queryByText("Historial de inventario")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Presentación", { exact: true })).toBeVisible();
    expect(within(dialog).getByText("Coral", { exact: true })).toBeVisible();
    expect(within(dialog).getByText("Talla", { exact: true })).toBeVisible();
    expect(within(dialog).getByText("M", { exact: true })).toBeVisible();
    expect(dialog).toHaveTextContent("Recepción de compra");
    expect(dialog).not.toHaveTextContent("PurchaseReceived");
    expect(dialog).toHaveTextContent("Externo");
    expect(dialog).toHaveTextContent("Disponible");
    expect(dialog).toHaveTextContent("5");
  });

  it("muestra el error del backend al cargar movimientos", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/variants/70/inventory-movements") {
        return jsonResponse({ detail: "No tienes permiso para consultar los movimientos." }, 403);
      }
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await user.click((await screen.findAllByRole("button", { name: "Ver detalles de Vestido satinado" })).find((button) => button.getAttribute("aria-expanded") === "false")!);
    await user.click(screen.getByRole("button", { name: "Ver movimientos de Coral · M" }));

    const dialog = await screen.findByRole("dialog", { name: "Movimientos de inventario" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("No tienes permiso para consultar los movimientos.");
  });

  it("keeps successful category and size options when subcategories fail", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([{ id: 2, name: "Vestidos" }]);
      if (path === "/api/v1/sizes") return jsonResponse([{ id: 3, name: "M" }]);
      if (path === "/api/v1/subcategories") return Promise.reject(new Error("Subcategorías no disponibles"));
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");

    await user.click(screen.getByRole("button", { name: "Categoría" }));
    expect(within(screen.getByRole("listbox", { name: "Categoría" })).getByRole("option", { name: "Vestidos" })).toBeVisible();
    await user.click(within(screen.getByRole("listbox", { name: "Categoría" })).getByRole("option", { name: "Vestidos" }));

    await user.click(screen.getByRole("button", { name: "Talla" }));
    expect(within(screen.getByRole("listbox", { name: "Talla" })).getByRole("option", { name: "M" })).toBeVisible();
  });

  it("presenta la cuadrícula como un catálogo visual compacto", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) {
        return jsonResponse(paginated([product({ primaryImageUrl: "/images/vestido.jpg" })]));
      }
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: /Cuadr/ }));

    const catalog = screen.getByRole("region", { name: /Cat.*cuadr/ });
    expect(catalog).toHaveClass("grid-cols-2", "sm:grid-cols-3", "md:grid-cols-4", "lg:grid-cols-5", "xl:grid-cols-6", "2xl:grid-cols-8");
    expect(screen.getByRole("img", { name: "Imagen de Vestido satinado" })).toHaveClass("aspect-square");
  });
  it("trunca el nombre de la tarjeta a una sola línea y mantiene legible su estado", async () => {
    const user = userEvent.setup();
    const longName = "Pañuelo cuadrado pequeño de satén de seda para la cabeza y accesorios";
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) {
        return jsonResponse(paginated([product({ name: longName, primaryImageUrl: "/images/panuelo.jpg" })]));
      }
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText(longName);
    await user.click(screen.getByRole("button", { name: /Cuadr/ }));

    const card = screen.getByRole("article", { name: "Producto " + longName });
    expect(within(card).getByRole("heading", { name: "1042" })).toHaveClass("truncate");
    expect(within(card).getByRole("heading", { name: "1042" })).not.toHaveClass("line-clamp-2");
    expect(card).toHaveTextContent("VSAT-CRL");
    expect(within(card).getAllByText("Disponible", { exact: true })[0]).toHaveClass("text-pw-brand-deep");
  });

  it("espera a que termine de escribirse el código antes de buscar", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.type(screen.getByRole("searchbox", { name: "Código o referencia" }), "1042");

    expect(auth.request.mock.calls.filter(([path]) => String(path).includes("&code=")).length).toBe(0);
    await waitFor(() => {
      expect(auth.request).toHaveBeenCalledWith("/api/v1/products?page=1&pageSize=20&availability=1&code=1042");
    }, { timeout: 1200 });
  });

  it("expande el detalle visual usando el ancho disponible", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated([product({ primaryImageUrl: "/images/vestido.jpg" })]));
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/images?productPresentationId=7") return jsonResponse([]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: /Cuadr/ }));
    await user.click(screen.getByRole("button", { name: "Ver variantes de Vestido satinado" }));

    const dialog = screen.getByRole("dialog", { name: "Variantes de Vestido satinado" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("table", { name: "Variantes de Vestido satinado" })).toBeVisible();
  });
  it("switches to presentation grouping and renders each variant with its image", async () => {
    const user = userEvent.setup();
    const secondPresentation = {
      id: 8,
      name: "Negro",
      sortOrder: 1,
      primaryImageUrl: "/images/negro.jpg",
      sizes: [
        {
          id: 71,
          sizeId: 4,
          sizeName: "L",
          sizeGroupId: 1,
          sizeGroupName: "Ropa",
          quantity: 2,
          receivedQuantity: 2,
          availableQuantity: 2,
          reservedQuantity: 0,
          unavailableQuantity: 0,
          salePrice: 1350,
          unitCostNio: 600,
          discountedSalePrice: null,
          discountCampaignId: null,
          discountCampaignName: null,
        },
      ],
    };
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated([product({ presentations: [product().presentations[0], secondPresentation] })]));
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Agrupar por" }));
    await user.click(screen.getAllByRole("option", { name: /Presentaci.n/ }).find((option) => option.tagName === "BUTTON")!);

    expect(screen.getAllByRole("row")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /Cuadr/ }));

    expect(screen.getByText("Coral")).toBeVisible();
    expect(screen.getByText("Negro")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Ver variantes de Negro" }).find((button) => button.textContent === "Ver variantes")!);

    const dialog = screen.getByRole("dialog", { name: "Variantes de Negro" });
    expect(within(dialog).getByRole("heading", { name: "Variantes de Negro" })).toHaveClass("truncate", "whitespace-nowrap");
    expect(within(dialog).getByText("Proveedor: VSAT-CRL · Tienda: 1042")).toBeVisible();
    const variantTable = within(dialog).getByRole("table", { name: "Variantes de Negro" });
    expect(variantTable).toHaveTextContent("L");
    expect(variantTable).not.toHaveTextContent("Talla L");
    expect(within(dialog).getByRole("img", { name: "Imagen de Negro" })).toHaveAttribute("src", "/images/negro.jpg");
    expect(variantTable.querySelectorAll("img")).toHaveLength(0);
  });

  it("switches between table and grid while keeping expanded details inline", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getAllByRole("button", { name: "Ver detalles de Vestido satinado" }).find((button) => button.getAttribute("aria-expanded") === "false")!);
    await user.click(screen.getByRole("button", { name: /Cuadr/ }));

    expect(screen.getByRole("region", { name: /Cat.*cuadr/ })).toBeVisible();
    expect(screen.queryByRole("table", { name: "Variantes de Vestido satinado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requests the selected availability filter from the backend", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Disponibilidad" }));
    const reservedOption = screen
      .getAllByRole("option", { name: "Reservado" })
      .find((option) => option.tagName === "BUTTON");
    expect(reservedOption).toBeDefined();
    await user.click(reservedOption!);

    await waitFor(() => {
      expect(auth.request).toHaveBeenCalledWith(
        "/api/v1/products?page=1&pageSize=20&availability=2",
      );
    });
  });

  it("opens product movements without a variant id from the actions menu", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/inventory-movements") return jsonResponse([{
        id: 501,
        productId: 42,
        productVariantId: 70,
        sizeId: 3,
        sizeName: "M",
        variant: "Coral",
        movementDate: "2026-09-12",
        inventoryMovementTypeName: "Venta",
        fromStockBucketName: "Disponible",
        toStockBucketName: "Externo",
        quantity: 1,
        comments: null,
      }]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Acciones de Vestido satinado" }));
    await user.click(screen.getByRole("menuitem", { name: "Ver movimientos" }));

    const dialog = await screen.findByRole("dialog", { name: "Movimientos de inventario" });
    expect(dialog).toHaveTextContent("Coral");
    expect(auth.request).toHaveBeenCalledWith("/api/v1/products/42/inventory-movements");
  });

  it("opens action menus upward for the last table rows", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { bottom: this.getAttribute("aria-label")?.includes("Producto final dos") ? 590 : 100 } as DOMRect;
    });
    const items = [
      product(),
      product({ id: 43, name: "Producto intermedio" }),
      product({ id: 44, name: "Producto final uno" }),
      product({ id: 45, name: "Producto final dos" }),
    ];
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated(items));
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Producto final dos");
    await user.click(screen.getByRole("button", { name: "Acciones de Producto final dos" }));

    expect(screen.getByRole("menu", { name: "Acciones de Producto final dos" })).toHaveClass("bottom-full");

    await user.click(screen.getByRole("button", { name: "Acciones de Vestido satinado" }));
    expect(screen.getByRole("menu", { name: "Acciones de Vestido satinado" })).toHaveClass("top-full");
  });

  it("shows the currency prefix and product thumbnail in the price dialog", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated([product({ primaryImageUrl: "/images/vestido.jpg" })]));
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Acciones de Vestido satinado" }));
    await user.click(screen.getByRole("menuitem", { name: "Modificar precio" }));

    const dialog = await screen.findByRole("dialog", { name: "Modificar precio" });
    expect(within(dialog).getByText("C$")).toBeVisible();
    expect(within(dialog).getByRole("img", { name: "Imagen de Vestido satinado" })).toHaveAttribute("src", "/images/vestido.jpg");
  });

  it("updates the price of every product variant from the product action menu", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/price" && init?.method === "PATCH") return Promise.resolve(new Response(null, { status: 204 }));
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Acciones de Vestido satinado" }));
    await user.click(screen.getByRole("menuitem", { name: "Modificar precio" }));

    const dialog = await screen.findByRole("dialog", { name: "Modificar precio" });
    expect(dialog).toHaveTextContent("Producto completo");
    const input = within(dialog).getByRole("spinbutton", { name: "Nuevo precio" });
    await user.clear(input);
    await user.type(input, "1350");
    await user.click(within(dialog).getByRole("button", { name: "Guardar precio" }));

    await waitFor(() => {
      const call = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/products/42/price" && (init as RequestInit | undefined)?.method === "PATCH");
      expect(call).toBeDefined();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ salePrice: 1350 });
    });
  });

  it("updates only the selected presentation price when grouped by presentation", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/presentations/7/price" && init?.method === "PATCH") return Promise.resolve(new Response(null, { status: 204 }));
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Agrupar por" }));
    await user.click(screen.getAllByRole("option", { name: /Presentaci.n/ }).find((option) => option.tagName === "BUTTON")!);
    await user.click(screen.getByRole("button", { name: "Acciones de Vestido satinado" }));
    await user.click(screen.getByRole("menuitem", { name: "Modificar precio" }));

    const dialog = await screen.findByRole("dialog", { name: "Modificar precio" });
    expect(dialog).toHaveTextContent("Presentación Coral");
    await user.click(within(dialog).getByRole("button", { name: "Guardar precio" }));

    await waitFor(() => {
      expect(auth.request).toHaveBeenCalledWith("/api/v1/products/42/presentations/7/price", expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ salePrice: 1250 }),
      }));
    });
  });
  it("filters subcategories by the selected category", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([{ id: 2, name: "Vestidos" }, { id: 3, name: "Tops" }]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      if (path === "/api/v1/subcategories") return jsonResponse([
        { id: 8, categoryId: 2, name: "Vestidos de noche" },
        { id: 9, categoryId: 3, name: "Camisas" },
      ]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Categoría" }));
    await user.click(within(screen.getByRole("listbox", { name: "Categoría" })).getByRole("option", { name: "Vestidos" }));
    await user.click(screen.getByRole("button", { name: "Subcategoría" }));

    const subcategoryList = screen.getByRole("listbox", { name: "Subcategoría" });
    expect(within(subcategoryList).getByRole("option", { name: "Vestidos de noche" })).toBeVisible();
    expect(within(subcategoryList).queryByRole("option", { name: "Camisas" })).not.toBeInTheDocument();
  });


  it("abre las imágenes en un modal desde el menú de acciones del producto", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/images?productPresentationId=7") return jsonResponse([presentationPrimaryImage()]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Acciones de Vestido satinado" }));
    await user.click(screen.getByRole("menuitem", { name: "Gestionar imágenes" }));

    expect(await screen.findByRole("img", { name: "Coral — imagen principal" })).toBeVisible();
    expect(auth.request).toHaveBeenCalledWith("/api/v1/products/42/images?productPresentationId=7");
  });

  it("mantiene la galería disponible al cambiar de tabla a cuadrícula", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/images?productPresentationId=7") return jsonResponse([presentationPrimaryImage()]);
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Acciones de Vestido satinado" }));
    await user.click(screen.getByRole("menuitem", { name: "Gestionar imágenes" }));
    await screen.findByRole("img", { name: "Coral — imagen principal" });
    await user.click(screen.getByRole("button", { name: "Cerrar gestión de imágenes" }));
    await user.click(screen.getByRole("button", { name: /Cuadr/ }));

    await user.click(screen.getByRole("button", { name: "Ver variantes de Vestido satinado" }));
    const dialog = screen.getByRole("dialog", { name: "Variantes de Vestido satinado" });
    expect(within(dialog).getByRole("table", { name: "Variantes de Vestido satinado" })).toBeVisible();
    const imageListRequests = auth.request.mock.calls.filter(([path]) => path === "/api/v1/products/42/images?productPresentationId=7");
    expect(imageListRequests).toHaveLength(1);
  });

  it("actualiza la miniatura de la presentación cuando cambia la principal", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/products?page=1&pageSize=20")) return jsonResponse(paginated());
      if (path === "/api/v1/categories" || path === "/api/v1/sizes" || path === "/api/v1/subcategories") return jsonResponse([]);
      if (path === "/api/v1/products/42/images?productPresentationId=7") return jsonResponse([presentationPrimaryImage(), presentationSecondaryImage()]);
      if (path === "/api/v1/products/42/images" && init?.method === "PUT") {
        return jsonResponse([
          { ...presentationSecondaryImage(), isPrimary: true, sortOrder: 0 },
          { ...presentationPrimaryImage(), isPrimary: false, sortOrder: 1 },
        ]);
      }
      throw new Error("Unexpected request: " + path);
    });

    renderProducts();
    await screen.findByText("Vestido satinado");
    await user.click(screen.getByRole("button", { name: "Acciones de Vestido satinado" }));
    await user.click(screen.getByRole("menuitem", { name: "Gestionar imágenes" }));
    await user.click(await screen.findByRole("button", { name: "Marcar como principal: Coral — imagen 2" }));

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Imagen de Vestido satinado" })).toHaveAttribute(
        "src",
        presentationSecondaryImage().thumbnailUrl,
      );
    });
  });
});
