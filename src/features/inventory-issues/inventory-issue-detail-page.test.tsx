import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { PageActionsProvider, usePageActions } from "../../shared/layout/page-actions-context";
import { InventoryIssueDetailPage } from "./inventory-issue-detail-page";

const auth = vi.hoisted(() => ({ request: vi.fn(), session: { user: { roles: ["Admin"] } } }));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request, session: auth.session }),
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

function ActionHost() {
  const { action } = usePageActions();
  return <>{action}</>;
}

function HeadingHost() {
  const { heading } = usePageActions();
  return heading ? <header>{heading.breadcrumbs}</header> : null;
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current-location">{location.pathname}{location.search}</output>;
}

function renderDetailAt(path = "/inventory/issues/1042") {
  return render(<MemoryRouter initialEntries={[path]}><PageActionsProvider><Routes><Route path="/inventory/issues/:id" element={<InventoryIssueDetailPage />} /></Routes><ActionHost /><HeadingHost /><LocationProbe /></PageActionsProvider></MemoryRouter>);
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
    expect(screen.getByRole("region", { name: "Comentarios" })).toBeVisible();
    expect(screen.getByRole("link", { name: "← Regresar a incidencias" })).toHaveAttribute("href", "/inventory/issues?productCode=1042");
    expect(screen.queryByText(/reportó|reportante|autor/i)).not.toBeInTheDocument();
  });

  it("resolves an open issue with the selected outcome", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path.endsWith("/resolution") && init?.method === "PATCH") return jsonResponse(issueDto({ productInventoryIssueStatusId: 2, productInventoryIssueStatusName: "ResolvedToAvailable", resolvedAt: "2026-08-23T13:10:00Z" }));
      return jsonResponse(issueDto());
    });
    renderDetailAt();

    await screen.findByRole("heading", { name: "Estado e inventario" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Resolver incidencia" })).toBeVisible());
    await user.click(screen.getByRole("button", { name: "Resolver incidencia" }));
    const dialog = screen.getByRole("dialog", { name: "Resolver incidencia" });
    await user.click(within(dialog).getByRole("button", { name: "Estado de resolución" }));
    await user.click(within(screen.getByRole("listbox", { name: "Estado de resolución" })).getByRole("option", { name: "Disponible nuevamente" }));
    await user.click(within(dialog).getByRole("button", { name: "Resolver incidencia" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith("/api/v1/product-inventory-issues/1042/resolution", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productInventoryIssueStatusId: 2 }),
    }));
    expect(screen.queryByRole("dialog", { name: "Resolver incidencia" })).not.toBeInTheDocument();
  });

  it("confirms deleting an open issue and returns to the list", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((_path: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return jsonResponse(issueDto({ productInventoryIssueStatusId: 5, productInventoryIssueStatusName: "Cancelled" }));
      return jsonResponse(issueDto());
    });
    renderDetailAt("/inventory/issues/1042?productCode=1042");

    await screen.findByRole("heading", { name: "Estado e inventario" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar incidencia" })).toBeVisible());
    await user.click(screen.getByRole("button", { name: "Eliminar incidencia" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar incidencia" });
    await user.click(within(dialog).getByRole("button", { name: "Eliminar incidencia" }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith("/api/v1/product-inventory-issues/1042", { method: "DELETE" }));
    expect(screen.queryByRole("dialog", { name: "Eliminar incidencia" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("current-location")).toHaveTextContent("/inventory/issues?productCode=1042");
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
