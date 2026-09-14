import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PageActionsProvider } from "../../shared/layout/page-actions-context";
import { ToastProvider } from "../../shared/ui/toast-provider";
import { ProductsPage } from "./products-page";
import { buildProductsPath, type ProductFilters } from "./product-types";

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
      if (path === "/api/v1/products?page=1&pageSize=20") return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([{ id: 2, name: "Vestidos" }]);
      if (path === "/api/v1/sizes") return jsonResponse([{ id: 3, name: "M" }]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();

    expect(await screen.findByText("Vestido satinado")).toBeVisible();
    expect(screen.getByText("1 presentación")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("Disponible", { selector: "span" })).toBeVisible();
  });

  it("opens product detail with presentations and sizes", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/products?page=1&pageSize=20") return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderProducts();
    await user.click(await screen.findByRole("button", { name: "Ver presentaciones de Vestido satinado" }));

    const dialog = screen.getByRole("dialog", { name: "Vestido satinado" });
    expect(dialog).toHaveTextContent("Coral");
    expect(dialog).toHaveTextContent("Talla M");
  });

  it("requests the selected availability filter from the backend", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products")) return jsonResponse(paginated());
      if (path === "/api/v1/categories") return jsonResponse([]);
      if (path === "/api/v1/sizes") return jsonResponse([]);
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
});
