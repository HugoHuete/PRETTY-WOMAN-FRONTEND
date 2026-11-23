import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { SalePostSalePage } from "./sale-post-sale-page";

const { request, setHeading } = vi.hoisted(() => ({ request: vi.fn(), setHeading: vi.fn() }));

vi.mock("../auth/auth-provider", () => ({ useAuth: () => ({ request }) }));
vi.mock("../../shared/layout/page-actions-context", () => ({ usePageActions: () => ({ setHeading }) }));

it("opens with pending requests, links to the exact sale request and keeps the search when selecting a status", async () => {
  request.mockImplementation(async () => new Response(JSON.stringify({
    items: [{
      id: 3, saleId: 12, isExchange: false, statusId: 2, clientName: "Ana Pérez",
      createdAt: "2026-11-22T12:00:00Z",
    }],
    page: 1, totalPages: 1,
  })));
  const user = userEvent.setup();
  render(<MemoryRouter><SalePostSalePage /></MemoryRouter>);

  expect(await screen.findByRole("link", { name: "Ver devolución #3" }))
    .toHaveAttribute("href", "/sales/12#post-sale-return-3");
  expect(request).toHaveBeenCalledWith("/api/v1/sales/post-sale?page=1&history=false");

  const input = screen.getByRole("searchbox");
  expect(screen.queryByRole("button", { name: "Buscar" })).not.toBeInTheDocument();
  await user.type(input, "Ana");
  expect(request).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(request)
    .toHaveBeenCalledWith("/api/v1/sales/post-sale?page=1&history=false&search=Ana"));
  expect(request).toHaveBeenCalledTimes(2);
  expect(input).toHaveFocus();
  expect(input).toHaveValue("Ana");
  await user.click(screen.getByRole("button", { name: "Estado" }));
  await user.click(within(screen.getByRole("listbox", { name: "Estado" })).getByRole("option", { name: "Devolución · Recibida" }));
  await waitFor(() => expect(request)
    .toHaveBeenCalledWith("/api/v1/sales/post-sale?page=1&history=false&search=Ana&isExchange=false&statusId=3"));
});
