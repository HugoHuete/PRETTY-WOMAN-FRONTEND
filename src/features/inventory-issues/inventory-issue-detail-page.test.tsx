import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PageActionsProvider } from "../../shared/layout/page-actions-context";
import { InventoryIssueDetailPage } from "./inventory-issue-detail-page";

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request }),
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

function renderDetailAt(path = "/inventory/issues/1042") {
  return render(<MemoryRouter initialEntries={[path]}><PageActionsProvider><Routes><Route path="/inventory/issues/:id" element={<InventoryIssueDetailPage />} /></Routes></PageActionsProvider></MemoryRouter>);
}

afterEach(() => auth.request.mockReset());

describe("InventoryIssueDetailPage", () => {
  it("renders the complete detail without a report author", async () => {
    auth.request.mockImplementation(() => jsonResponse(issueDto()));
    renderDetailAt("/inventory/issues/1042?productCode=1042");

    expect(await screen.findByRole("heading", { name: "Estado e inventario" })).toBeVisible();
    expect(screen.getByText("Vestido satinado")).toBeVisible();
    expect(screen.getByText("Código 1042 · Coral · M")).toBeVisible();
    expect(screen.getByText("No disponible")).toBeVisible();
    expect(screen.getByText("Presenta una mancha visible.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver a incidencias" })).toHaveAttribute("href", "/inventory/issues?productCode=1042");
    expect(screen.queryByText(/reportó|reportante|autor/i)).not.toBeInTheDocument();
  });

  it("shows a not-found state with the query-preserving back link", async () => {
    auth.request.mockImplementation(() => jsonResponse({ detail: "El issue no existe." }, 404));
    renderDetailAt("/inventory/issues/999?productCode=9999");

    expect(await screen.findByText("No encontramos esta incidencia")).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver a incidencias" })).toHaveAttribute("href", "/inventory/issues?productCode=9999");
  });

  it("shows permission and retryable errors", async () => {
    auth.request.mockImplementation(() => jsonResponse({ detail: "No tienes permiso." }, 403));
    renderDetailAt();
    expect(await screen.findByText("No tienes permiso para ver esta sección.")).toBeVisible();

    auth.request.mockImplementation(() => jsonResponse({ detail: "Servicio no disponible." }, 500));
    renderDetailAt();
    expect(await screen.findByText("Servicio no disponible.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});
