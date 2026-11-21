import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { SaleDetailPage } from "./sale-detail-page";
import type { SaleClient } from "./sales-types";

const pendingSave = { finish: () => {} };
const mocks = vi.hoisted(() => ({ request: vi.fn(), lookup: vi.fn(), setAction: vi.fn(), setHeading: vi.fn() }));
vi.mock("../auth/auth-provider", () => ({ useAuth: () => ({ request: mocks.request }) }));
vi.mock("../../shared/layout/page-actions-context", () => ({ usePageActions: () => mocks }));
vi.mock("../../shared/ui/toast-context", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("./sales-api", () => ({
  getSale: async (_request: unknown, id: number) => ({ id, clientId: id + 6, clientName: "Nombre de respaldo", productVariants: [], selectionHolds: [] }),
  getSaleClient: mocks.lookup,
  getSaleDeliveryAgencies: async () => [],
  getSaleMunicipalities: async () => [],
  getSalePaymentTerminals: async () => [],
}));
vi.mock("./sale-detail-overview", () => ({ SaleDetailOverview: () => null }));
vi.mock("./sale-detail-products", () => ({ SaleDetailProducts: () => null }));
vi.mock("./sale-detail-summary", () => ({ SaleDetailSummary: () => null }));
vi.mock("./sale-detail-payments", () => ({ SaleDetailPayments: () => null }));
vi.mock("./sale-detail-post-sale", () => ({ SaleDetailPostSale: () => null }));
vi.mock("./sale-detail-logistics", () => ({
  SaleDetailSelectionHolds: () => null,
  SaleDetailLogistics: ({ onDeliveryClientSelected }: { onDeliveryClientSelected: (client: SaleClient) => void }) =>
    <>
      <button onClick={() => onDeliveryClientSelected({ id: 7, name: "Nombre actualizado" })}>Confirmar perfil guardado</button>
      <button onClick={() => { pendingSave.finish = () => onDeliveryClientSelected({ id: 7, name: "Nombre de la venta anterior" }); }}>Iniciar guardado</button>
    </>,
}));

it.each(["resultado", "error"])("ignora el %s de la consulta pendiente tras guardar el perfil desde un envío", async (outcome) => {
  mocks.lookup.mockClear();
  let completeLookup!: () => void;
  mocks.lookup.mockReturnValueOnce(new Promise<SaleClient>((resolve, reject) => {
    completeLookup = () => outcome === "error" ? reject(new Error("Sin conexión")) : resolve({ id: 7, name: "Nombre anterior" });
  }));
  render(<MemoryRouter initialEntries={["/sales/1"]}><Routes><Route path="/sales/:id" element={<SaleDetailPage />} /></Routes></MemoryRouter>);

  await waitFor(() => expect(mocks.lookup).toHaveBeenCalledWith(mocks.request, 7));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar perfil guardado" }));
  expect(screen.getByText("Nombre actualizado")).toBeVisible();
  await act(async () => { completeLookup(); });
  expect(screen.getByText("Nombre actualizado")).toBeVisible();
});

it("ignora un guardado anterior sin invalidar la consulta de la nueva venta", async () => {
  mocks.lookup.mockClear();
  let finishLookup!: (client: SaleClient) => void;
  mocks.lookup.mockResolvedValueOnce({ id: 7, name: "Ana" }).mockReturnValueOnce(new Promise<SaleClient>((resolve) => { finishLookup = resolve; }));
  render(<MemoryRouter initialEntries={["/sales/1"]}>
    <Link to="/sales/2">Otra venta</Link>
    <Routes><Route path="/sales/:id" element={<SaleDetailPage />} /></Routes>
  </MemoryRouter>);

  await screen.findByText("Ana");
  fireEvent.click(screen.getByRole("button", { name: "Iniciar guardado" }));
  fireEvent.click(screen.getByRole("link", { name: "Otra venta" }));
  await waitFor(() => expect(mocks.lookup).toHaveBeenCalledWith(mocks.request, 8));

  await act(async () => { pendingSave.finish(); });
  expect(screen.queryByText("Nombre de la venta anterior")).not.toBeInTheDocument();
  await act(async () => { finishLookup({ id: 8, name: "Bea" }); });
  expect(screen.getByText("Bea")).toBeVisible();
});
