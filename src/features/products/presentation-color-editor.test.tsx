import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PresentationColorEditor } from "./presentation-color-editor";

it("assigns a catalog color to the presentation", async () => {
  const user = userEvent.setup();
  const request = vi.fn(async (path: string, _init?: RequestInit) => path.endsWith("/colors")
    ? Response.json([{ id: 7, name: "Burdeos", hexCode: "#722F37" }])
    : new Response(null, { status: 204 }));
  const onSaved = vi.fn();
  render(<PresentationColorEditor productId={42} presentationId={8} request={request} onSaved={onSaved} />);

  await user.click(screen.getByRole("button", { name: "Asignar color" }));
  await user.click(await screen.findByRole("button", { name: "Color del catálogo" }));
  await user.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "Burdeos" }));
  await user.click(screen.getByRole("button", { name: "Guardar color" }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(7));
  expect(screen.getByRole("button", { name: "Asignar color" })).toHaveFocus();
  expect(request).toHaveBeenCalledWith("/api/v1/products/42/presentations/8/color", expect.objectContaining({
    method: "PATCH",
    body: JSON.stringify({ colorId: 7 }),
  }));
});

it("moves keyboard focus into the editor and restores it on cancel", async () => {
  const user = userEvent.setup();
  let resolveColors!: (response: Response) => void;
  const request = vi.fn(() => new Promise<Response>((resolve) => { resolveColors = resolve; }));
  render(<PresentationColorEditor productId={42} presentationId={8} request={request} onSaved={vi.fn()} />);

  await user.tab();
  expect(screen.getByRole("button", { name: "Asignar color" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

  resolveColors(Response.json([{ id: 7, name: "Burdeos", hexCode: "#722F37" }]));
  const select = await screen.findByRole("button", { name: "Color del catálogo" });
  expect(select).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Guardar color" })).toHaveFocus();
  await user.tab();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Asignar color" })).toHaveFocus();
});
