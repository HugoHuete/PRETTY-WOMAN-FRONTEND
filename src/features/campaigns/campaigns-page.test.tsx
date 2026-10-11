import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CampaignsPage } from "./campaigns-page";

const auth = vi.hoisted(() => ({
  request: vi.fn(),
  session: { user: { roles: ["Admin"] } },
}));

const pageActions = vi.hoisted(() => ({
  setAction: vi.fn(),
  setHeading: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => auth,
}));

vi.mock("../../shared/layout/page-actions-context", () => ({
  usePageActions: () => pageActions,
}));

vi.mock("../../shared/ui/toast-context", () => ({
  useToast: () => toast,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function paginated(items: unknown[], page = 1) {
  return {
    items,
    page,
    pageSize: 20,
    totalCount: items.length,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    name: "Verano rosa",
    startDate: "2026-09-20T00:00:00Z",
    endDate: "2026-09-30T00:00:00Z",
    statusId: 2,
    statusName: "Activa",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: null,
    ...overrides,
  };
}

function productsResponse() {
  return paginated([
    {
      id: 44,
      code: 1044,
      name: "Vestido satinado",
      primaryImageUrl: "/images/vestido-satinado.jpg",
      supplierProductCode: "VSAT-CRL",
      presentations: [
        {
          id: 3,
          name: "Coral",
          sizes: [
            {
              id: 301,
              sizeName: "S",
              availableQuantity: 4,
              salePrice: 1250,
            },
            {
              id: 302,
              sizeName: "M",
              availableQuantity: 3,
              salePrice: 1250,
            },
          ],
        },
      ],
    },
    {
      id: 55,
      code: 1055,
      name: "Falda plisada",
      supplierProductCode: "FPL-NEG",
      presentations: [
        {
          id: 4,
          name: "Negro",
          sizes: [
            {
              id: 401,
              sizeName: "M",
              availableQuantity: 2,
              salePrice: 900,
            },
          ],
        },
      ],
    },
  ]);
}

function renderCampaigns(path = "/discounts/campaigns") {
  window.history.replaceState({}, "", path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CampaignsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  auth.request.mockReset();
  pageActions.setAction.mockReset();
  pageActions.setHeading.mockReset();
  toast.showToast.mockReset();
});

describe("CampaignsPage", () => {
  it("loads campaigns with status and dates in the directory", async () => {
    auth.request.mockResolvedValueOnce(
      jsonResponse(paginated([campaign()])),
    );

    renderCampaigns();

    expect(await screen.findByText("Verano rosa")).toBeVisible();
    expect(screen.getByRole("link", { name: "Verano rosa" })).toHaveAttribute("href", "/discounts/campaigns/12");
    expect(screen.getByText("Activa")).toBeVisible();
    expect(screen.getByText("20 sept 2026")).toBeVisible();
    expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/discountcampaigns?page=1&pageSize=20",
    );
  });

  it("finds campaigns that are outside the currently loaded API page", async () => {
    const user = userEvent.setup();
    const laterCampaign = campaign({ id: 27, name: "Invierno especial" });
    auth.request.mockImplementation((path: string) => path.includes("page=2")
      ? Promise.resolve(jsonResponse({ ...paginated([laterCampaign], 2), totalCount: 21, totalPages: 2, hasPreviousPage: true }))
      : Promise.resolve(jsonResponse({ ...paginated([campaign()]), totalCount: 21, totalPages: 2, hasNextPage: true })));

    renderCampaigns();
    await screen.findByText("Verano rosa");
    await user.type(screen.getByRole("searchbox", { name: "Buscar campañas" }), "Invierno");

    expect(await screen.findByRole("link", { name: "Invierno especial" })).toHaveAttribute("href", "/discounts/campaigns/27");
    expect(auth.request).toHaveBeenCalledWith("/api/v1/discountcampaigns?page=2&pageSize=20");
  });

  it("creates a campaign with a selected product presentation", async () => {
    const user = userEvent.setup();
    let postDone = false;
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products")) {
        return Promise.resolve(jsonResponse(productsResponse()));
      }
      if (path === "/api/v1/DiscountCampaigns" && !postDone) {
        postDone = true;
        return Promise.resolve(jsonResponse(98, 201));
      }
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/new");

    await user.type(await screen.findByLabelText("Nombre de la campaña"), "Fin de temporada");
    await user.type(screen.getByLabelText("Fecha inicial"), "2026-10-01");
    await user.type(screen.getByLabelText("Fecha final"), "2026-10-15");
    await user.click(screen.getByRole("button", { name: "Agregar productos" }));
    const dialog = await screen.findByRole("dialog", { name: "Agregar productos" });
    await user.type(within(dialog).getByRole("searchbox", { name: "Código de producto" }), "1044");
    await user.click(within(dialog).getByRole("button", { name: "Buscar" }));
    expect(auth.request).toHaveBeenCalledWith("/api/v1/products?page=1&pageSize=1&availability=1&code=1044");
    await user.click(await within(dialog).findByRole("checkbox", { name: "Presentación: Coral" }));
    expect(within(dialog).getByText("Tallas: S, M", { exact: true })).toBeVisible();
    expect(within(dialog).queryByText("Vestido satinado · Coral · S", { exact: true })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Agregar seleccionados" }));
    const productRow = screen.getByText("Código 1044").closest("tr");
    const estimateCell = productRow?.querySelectorAll("td")[3];
    expect(estimateCell).not.toBeNull();
    const estimate = within(estimateCell as HTMLElement);
    expect(estimate.getAllByText("Costo")).toHaveLength(1);
    expect(estimate.getAllByText("Precio actual")).toHaveLength(1);
    expect(estimate.getAllByText("Precio campaña")).toHaveLength(1);
    expect(estimate.getAllByText("Ganancia / pérdida")).toHaveLength(1);
    expect(estimate.getByText("Coral · S")).toBeVisible();
    expect(estimate.getByText("Coral · M")).toBeVisible();
    const typeTrigger = screen.getByRole("button", { name: "Tipo de descuento para Vestido satinado · Coral" });
    await user.click(typeTrigger);
    const typeMenu = screen.getByRole("listbox", { name: "Tipo de descuento para Vestido satinado · Coral" });
    expect(typeMenu).toBeVisible();
    expect(typeMenu.closest(".overflow-x-auto")).toBeNull();
    await user.click(within(typeMenu).getByRole("option", { name: "Porcentaje" }));
    const typeSelect = screen.getAllByLabelText("Tipo de descuento para Vestido satinado · Coral").find((element) => element.tagName === "SELECT") as HTMLSelectElement;
    await user.selectOptions(typeSelect, "2");
    await user.type(screen.getByLabelText("Valor de descuento para Vestido satinado · Coral"), "20");
    await user.click(screen.getByRole("button", { name: "Crear campaña" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/DiscountCampaigns",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Fin de temporada",
          startDate: "2026-10-01T00:00:00.000Z",
          endDate: "2026-10-15T23:59:59.000Z",
          targets: [{
            productId: null,
            productPresentationId: 3,
            discountTypeId: 2,
            discountValue: 20,
          }],
        }),
      }),
    ));
  });

  it("rejects a manual percentage discount above 100 before creating the campaign", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/products")) return Promise.resolve(jsonResponse(productsResponse()));
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/new");
    await user.type(await screen.findByLabelText("Nombre de la campaña"), "Descuento inválido");
    await user.type(screen.getByLabelText("Fecha inicial"), "2026-10-01");
    await user.type(screen.getByLabelText("Fecha final"), "2026-10-15");
    await user.click(screen.getByRole("button", { name: "Agregar productos" }));
    const dialog = await screen.findByRole("dialog", { name: "Agregar productos" });
    await user.type(within(dialog).getByRole("searchbox", { name: "Código de producto" }), "1044");
    await user.click(within(dialog).getByRole("button", { name: "Buscar" }));
    await user.click(await within(dialog).findByRole("checkbox", { name: "Presentación: Coral" }));
    await user.click(within(dialog).getByRole("button", { name: "Agregar seleccionados" }));
    await user.selectOptions(
      screen.getAllByLabelText("Tipo de descuento para Vestido satinado · Coral").find((element) => element.tagName === "SELECT") as HTMLSelectElement,
      "2",
    );
    await user.type(screen.getByLabelText("Valor de descuento para Vestido satinado · Coral"), "101");
    await user.click(screen.getByRole("button", { name: "Crear campaña" }));

    expect(await screen.findByText("El descuento porcentual no puede superar el 100%.")).toBeVisible();
    expect(auth.request).not.toHaveBeenCalledWith("/api/v1/DiscountCampaigns", expect.objectContaining({ method: "POST" }));
  });

  it("rejects an imported CSV percentage edited above 100 before creating the campaign", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/products?page=1&pageSize=1&code=1044") return Promise.resolve(jsonResponse(paginated([productsResponse().items[0]])));
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/new");
    await user.type(await screen.findByLabelText("Nombre de la campaña"), "Descuento CSV inválido");
    await user.type(screen.getByLabelText("Fecha inicial"), "2026-10-01");
    await user.type(screen.getByLabelText("Fecha final"), "2026-10-15");
    await user.click(screen.getByRole("button", { name: "Importar CSV" }));
    await user.upload(screen.getByLabelText("Archivo CSV de descuentos"), new File([
      "productCode;productPresentationId;discountTypeId;discountValue\n1044;;2;20",
    ], "descuentos.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "Aplicar importación" }));
    const valueInput = await screen.findByLabelText("Valor de descuento para producto código 1044");
    await user.clear(valueInput);
    await user.type(valueInput, "101");
    await user.click(screen.getByRole("button", { name: "Crear campaña" }));

    expect(await screen.findByText("El descuento porcentual no puede superar el 100%.")).toBeVisible();
    expect(auth.request).not.toHaveBeenCalledWith("/api/v1/DiscountCampaigns", expect.objectContaining({ method: "POST" }));
  });

  it("creates a campaign once with editable CSV discounts and product targets", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/DiscountCampaigns") return Promise.resolve(jsonResponse(101, 201));
      if (path === "/api/v1/products?page=1&pageSize=1&code=1044") return Promise.resolve(jsonResponse(paginated([productsResponse().items[0]])));
      if (path === "/api/v1/products?page=1&pageSize=1&code=1055") return Promise.resolve(jsonResponse(paginated([productsResponse().items[1]])));
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/new");
    await user.type(await screen.findByLabelText("Nombre de la campaña"), "Promo CSV");
    await user.type(screen.getByLabelText("Fecha inicial"), "2026-10-01");
    await user.type(screen.getByLabelText("Fecha final"), "2026-10-31");
    await user.click(screen.getByRole("button", { name: "Importar CSV" }));
    await user.click(screen.getByLabelText("Coma (,)"));
    await user.upload(screen.getByLabelText("Archivo CSV de descuentos"), new File(["productCode,productPresentationId,discountTypeId,discountValue\n1044,,2,20\n1055,4,1,100"], "descuentos.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "Aplicar importación" }));
    const selectedCsvNotice = screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent?.includes("Archivo seleccionado: descuentos.csv.") === true,
    );
    const sectionHeading = screen.getByRole("heading", { name: "Productos y descuentos" });
    expect(selectedCsvNotice.parentElement).not.toBe(sectionHeading.parentElement);
    expect(screen.queryByText("Todavía no has agregado productos a la campaña.")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Tipo de descuento para producto código 1044" }));
    const csvDiscountType = screen.getByRole("listbox", { name: "Tipo de descuento para producto código 1044" });
    await user.click(within(csvDiscountType).getByRole("option", { name: "Monto fijo" }));
    const csvDiscountTypeSelect = screen.getAllByLabelText("Tipo de descuento para producto código 1044").find((element) => element.tagName === "SELECT") as HTMLSelectElement;
    await user.selectOptions(csvDiscountTypeSelect, "1");
    const csvDiscountValue = screen.getByLabelText("Valor de descuento para producto código 1044");
    await user.clear(csvDiscountValue);
    await user.type(csvDiscountValue, "25");
    await user.click(screen.getByRole("button", { name: "Quitar producto código 1055" }));
    expect(screen.queryByText("Código 1055")).not.toBeInTheDocument();
    await user.clear(csvDiscountValue);
    await user.click(screen.getByRole("button", { name: "Crear campaña" }));
    expect(screen.getByText("Cada descuento debe tener un valor mayor que cero.")).toBeVisible();
    await user.type(csvDiscountValue, "25");
    await user.click(screen.getByRole("button", { name: "Crear campaña" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/DiscountCampaigns",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Promo CSV",
          startDate: "2026-10-01T00:00:00.000Z",
          endDate: "2026-10-31T23:59:59.000Z",
          targets: [{ productId: 44, productPresentationId: null, discountTypeId: 1, discountValue: 25 }],
        }),
      }),
    ));
    expect(auth.request).not.toHaveBeenCalledWith(expect.stringContaining("/products/validate"), expect.anything());
    expect(auth.request).not.toHaveBeenCalledWith(expect.stringContaining("/products/import"), expect.anything());
  });

  it("sends CSV product and presentation selections in the standard campaign payload", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/DiscountCampaigns") return Promise.resolve(jsonResponse(102, 201));
      if (path === "/api/v1/products?page=1&pageSize=1&code=1044") return Promise.resolve(jsonResponse(paginated([productsResponse().items[0]])));
      if (path === "/api/v1/products?page=1&pageSize=1&code=1055") return Promise.resolve(jsonResponse(paginated([productsResponse().items[1]])));
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/new");
    await user.type(await screen.findByLabelText("Nombre de la campaña"), "Promo CSV completa");
    await user.type(screen.getByLabelText("Fecha inicial"), "2026-10-01");
    await user.type(screen.getByLabelText("Fecha final"), "2026-10-31");
    await user.click(screen.getByRole("button", { name: "Importar CSV" }));
    await user.upload(screen.getByLabelText("Archivo CSV de descuentos"), new File([
      "productCode;productPresentationId;discountTypeId;discountValue\n1044;;2;20\n1055;4;3;700",
    ], "descuentos.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "Aplicar importación" }));
    await user.click(screen.getByRole("button", { name: "Crear campaña" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/DiscountCampaigns",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Promo CSV completa",
          startDate: "2026-10-01T00:00:00.000Z",
          endDate: "2026-10-31T23:59:59.000Z",
          targets: [
            { productId: 44, productPresentationId: null, discountTypeId: 2, discountValue: 20 },
            { productId: null, productPresentationId: 4, discountTypeId: 3, discountValue: 700 },
          ],
        }),
      }),
    ));
    expect(auth.request).not.toHaveBeenCalledWith(expect.stringContaining("/products/validate"), expect.anything());
    expect(auth.request).not.toHaveBeenCalledWith(expect.stringContaining("/products/import"), expect.anything());
  });

  it("does not create a campaign when a CSV product code cannot be resolved", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => path.includes("code=7777")
      ? Promise.resolve(jsonResponse(paginated([])))
      : Promise.resolve(jsonResponse(paginated([]))));

    renderCampaigns("/discounts/campaigns/new");
    await user.type(await screen.findByLabelText("Nombre de la campaña"), "CSV con código inválido");
    await user.type(screen.getByLabelText("Fecha inicial"), "2026-10-01");
    await user.type(screen.getByLabelText("Fecha final"), "2026-10-31");
    await user.click(screen.getByRole("button", { name: "Importar CSV" }));
    await user.upload(screen.getByLabelText("Archivo CSV de descuentos"), new File([
      "productCode;productPresentationId;discountTypeId;discountValue\n7777;;2;20",
    ], "descuentos.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "Aplicar importación" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Crear campaña" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Crear campaña" }));

    expect(await screen.findByText("No encontramos el producto código 7777.")).toBeVisible();
    expect(auth.request).not.toHaveBeenCalledWith("/api/v1/DiscountCampaigns", expect.objectContaining({ method: "POST" }));
  });

  it("searches one product by code and allows selecting a whole presentation", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => path.includes("code=1044")
      ? Promise.resolve(jsonResponse(paginated([productsResponse().items[0]])))
      : Promise.resolve(jsonResponse(paginated([]))));

    renderCampaigns("/discounts/campaigns/new");

    await user.click(await screen.findByRole("button", { name: "Agregar productos" }));
    const dialog = await screen.findByRole("dialog", { name: "Agregar productos" });
    expect(auth.request).not.toHaveBeenCalledWith("/api/v1/products?page=1&pageSize=100&availability=1");

    await user.type(within(dialog).getByRole("searchbox", { name: "Código de producto" }), "1044");
    await user.click(within(dialog).getByRole("button", { name: "Buscar" }));
    expect(auth.request).toHaveBeenCalledWith("/api/v1/products?page=1&pageSize=1&availability=1&code=1044");

    expect(await within(dialog).findByRole("checkbox", { name: "Producto completo: Vestido satinado" })).toBeVisible();
    expect(within(dialog).getByRole("img", { name: "Imagen de Vestido satinado" })).toHaveAttribute("src", "/images/vestido-satinado.jpg");
    expect(within(dialog).getByText("1044")).toBeVisible();
    expect(within(dialog).getByRole("checkbox", { name: "Presentación: Coral" })).toBeVisible();
    expect(within(dialog).queryByRole("checkbox", { name: "Producto completo: Falda plisada" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("checkbox", { name: "Presentación: Coral" }));

    expect(within(dialog).getByText("1 seleccionados")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Agregar seleccionados" }));
    expect(screen.getAllByLabelText(/Valor de descuento para Vestido satinado · Coral/)).toHaveLength(1);
    expect(screen.queryByText("Busca una referencia o una variante para agregarla a la campaña.")).not.toBeInTheDocument();
  });
  it("uses the standard return breadcrumb on the campaign form", async () => {
    auth.request.mockResolvedValueOnce(jsonResponse(paginated([])));

    renderCampaigns("/discounts/campaigns/new");

    await screen.findByLabelText("Nombre de la campaña");
    const heading = pageActions.setHeading.mock.calls.at(-1)?.[0] as { breadcrumbs?: unknown };
    const { container } = render(<MemoryRouter><>{heading.breadcrumbs}</></MemoryRouter>);

    expect(container).toHaveTextContent("← Regresar a campañas");
  });
  it("loads an existing campaign and updates its details", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/discountcampaigns/12") {
        return Promise.resolve(jsonResponse({
          ...campaign(),
          targets: [{
            id: 2,
            productId: 35,
            productPresentationId: null,
            productName: "QA Top C$ Single",
            productCode: 34,
            presentationName: null,
            discountTypeId: 1,
            discountTypeName: "FixedAmount",
            discountValue: 100,
          }],
        }));
      }
      if (path.startsWith("/api/v1/products")) return Promise.resolve(jsonResponse(productsResponse()));
      if (path === "/api/v1/discountcampaigns" && auth.request.mock.calls.some(([calledPath]) => calledPath === "/api/v1/discountcampaigns/12")) return Promise.resolve(jsonResponse(paginated([campaign({ name: "Verano actualizado" })])));
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/12/edit");

    expect(await screen.findByText("Código 34")).toBeVisible();
    const name = screen.getByLabelText("Nombre de la campaña");
    await user.clear(name);
    await user.type(name, "Verano actualizado");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/DiscountCampaigns/12",
      expect.objectContaining({ method: "PUT" }),
    ));
    const updateRequest = auth.request.mock.calls.find(([path, init]) => path === "/api/v1/DiscountCampaigns/12" && init?.method === "PUT");
    expect(JSON.parse(updateRequest?.[1]?.body as string).targets).toEqual([{
      productId: 35,
      productPresentationId: null,
      discountTypeId: 1,
      discountValue: 100,
    }]);
  });

  it("blocks saving an edit when an imported CSV target is already in the campaign", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/discountcampaigns/12") {
        return Promise.resolve(jsonResponse({
          ...campaign(),
          targets: [{
            id: 2,
            productId: 44,
            productPresentationId: null,
            productName: "Vestido satinado",
            productCode: 1044,
            presentationName: null,
            discountTypeId: 1,
            discountTypeName: "FixedAmount",
            discountValue: 100,
          }],
        }));
      }
      if (path.startsWith("/api/v1/products")) return Promise.resolve(jsonResponse(productsResponse()));
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/12/edit");
    await screen.findByText("Código 1044");
    await user.click(screen.getByRole("button", { name: "Importar CSV" }));
    await user.upload(screen.getByLabelText("Archivo CSV de descuentos"), new File([
      "productCode;productPresentationId;discountTypeId;discountValue\n1044;3;2;20",
    ], "duplicado.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "Aplicar importación" }));
    await screen.findByLabelText("Valor de descuento para producto código 1044");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("El producto código 1044 ya está incluido en la campaña. Quita uno de los destinos antes de guardar.")).toBeVisible();
    expect(auth.request).not.toHaveBeenCalledWith("/api/v1/DiscountCampaigns/12", expect.objectContaining({ method: "PUT" }));
  });

  it("shows a read-only campaign detail with targets and a link to edit", async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/discountcampaigns/12") {
        return Promise.resolve(jsonResponse({
          ...campaign({ statusName: "Active" }),
          targets: [{
            id: 2,
            productId: 35,
            productPresentationId: null,
            productName: "QA Top C$ Single",
            productCode: 34,
            presentationName: null,
            discountTypeId: 1,
            discountTypeName: "FixedAmount",
            discountValue: 100,
          }],
        }));
      }
      if (path === "/api/v1/products/35") return Promise.resolve(jsonResponse({ title: "Producto no encontrado" }, 404));
      if (path.startsWith("/api/v1/products")) return Promise.resolve(jsonResponse(paginated([])));
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/12");

    expect(await screen.findByRole("heading", { name: "Verano rosa" })).toBeVisible();
    expect(screen.getByText("20 sept 2026")).toBeVisible();
    expect(screen.getByText("Activa")).toBeVisible();
    expect(screen.getByText("Código 34")).toBeVisible();
    expect(screen.getByText("Monto fijo")).toBeVisible();
    expect(screen.getByText("C$100.00")).toBeVisible();
    const editAction = pageActions.setAction.mock.calls.at(-1)?.[0];
    const { container } = render(<MemoryRouter><>{editAction}</></MemoryRouter>);
    expect(container.querySelector("a")).toHaveAttribute("href", "/discounts/campaigns/12/edit");
  });

  it("shows variant price and profit estimates in the campaign detail", async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/discountcampaigns/12") {
        return Promise.resolve(jsonResponse({
          ...campaign({ statusName: "Active" }),
          targets: [{
            id: 2,
            productId: 44,
            productPresentationId: null,
            productName: "Vestido satinado",
            productCode: 1044,
            presentationName: null,
            discountTypeId: 1,
            discountTypeName: "FixedAmount",
            discountValue: 100,
          }],
        }));
      }
      if (path === "/api/v1/products/44") {
        return Promise.resolve(jsonResponse({
          id: 44,
          code: 1044,
          name: "Vestido satinado",
          primaryImageUrl: null,
          supplierProductCode: "VSAT-CRL",
          subcategoryId: 1,
          subcategoryName: null,
          categoryId: null,
          categoryName: null,
          presentations: [{
            id: 3,
            name: "Coral",
            sortOrder: 0,
            primaryImageUrl: null,
            sizes: [{
              id: 301,
              sizeId: 1,
              sizeName: "S",
              sizeGroupId: null,
              sizeGroupName: null,
              quantity: 4,
              receivedQuantity: 4,
              availableQuantity: 4,
              reservedQuantity: 0,
              unavailableQuantity: 0,
              salePrice: 1250,
              unitCostNio: 700,
              discountedSalePrice: 1200,
              discountCampaignId: 8,
              discountCampaignName: "Oferta previa",
            }],
          }],
        }));
      }
      return Promise.resolve(jsonResponse(paginated([])));
    });

    renderCampaigns("/discounts/campaigns/12");

    expect(await screen.findByText("Coral · S")).toBeVisible();
    expect(screen.getByText("Costo")).toBeVisible();
    expect(screen.getByText("Precio actual")).toBeVisible();
    expect(screen.getByText("Precio campaña")).toBeVisible();
    expect(screen.getByText("Ganancia / pérdida")).toBeVisible();
    expect(screen.getByText("C$700.00")).toBeVisible();
    expect(screen.getByText("C$1,200.00")).toBeVisible();
    expect(screen.getByText("C$1,150.00")).toBeVisible();
    expect(screen.getByText("C$450.00")).toBeVisible();
    expect(auth.request).toHaveBeenCalledWith("/api/v1/products/44");
  });

  it("cancels and reactivates a campaign from the directory", async () => {
    const user = userEvent.setup();
    auth.request
      .mockResolvedValueOnce(jsonResponse(paginated([campaign()])))
      .mockResolvedValueOnce(jsonResponse(undefined, 204))
      .mockResolvedValueOnce(jsonResponse(paginated([campaign({ statusId: 4, statusName: "Cancelada" })])))
      .mockResolvedValueOnce(jsonResponse(undefined, 204))
      .mockResolvedValueOnce(jsonResponse(paginated([campaign()])))
      .mockResolvedValueOnce(jsonResponse(undefined, 204));

    renderCampaigns();
    const row = (await screen.findByText("Verano rosa")).closest("tr");
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Cancelar campaña" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar campaña" }));
    await waitFor(() => expect(screen.getByText("Cancelada")).toBeVisible());

    const cancelledRow = screen.getByText("Verano rosa").closest("tr") as HTMLElement;
    await user.click(within(cancelledRow).getByRole("button", { name: "Reactivar campaña" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reactivar campaña" }));

    await waitFor(() => expect(screen.getByText("Activa")).toBeVisible());
    expect(auth.request).toHaveBeenCalledWith(
      "/api/v1/discountcampaigns/12/reactivate",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
