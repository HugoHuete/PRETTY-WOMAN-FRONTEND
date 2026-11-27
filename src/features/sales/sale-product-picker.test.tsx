import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SaleProductPicker } from "./sale-product-picker";
import { getSaleProducts } from "./sales-api";

const request = vi.hoisted(() => vi.fn());
vi.mock("../auth/auth-provider", () => ({ useAuth: () => ({ request }) }));
vi.mock("./sales-api", () => ({ getSaleProducts: vi.fn() }));

const ivory = {
  id: 7, name: "Ivory", primaryImageUrl: "/ivory.webp",
  sizes: [{ id: 71, sizeName: "5.5", availableQuantity: 1, salePrice: 720 }],
};
const burgundy = {
  id: 8, name: "Burgundy", primaryImageUrl: "/burgundy.webp",
  sizes: [{ id: 81, sizeName: "8.5", availableQuantity: 2, salePrice: 720 }],
};

function search(...presentations: (typeof ivory)[]) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.mocked(getSaleProducts).mockImplementation(async (_request, { code }) => ({
    items: [{ id: 1, code: Number(code), name: "Zapato", presentations }],
    page: 1, pageSize: 8, totalPages: 1, totalCount: 1,
  } as Awaited<ReturnType<typeof getSaleProducts>>));
  const onAdd = vi.fn();
  render(<SaleProductPicker lines={[]} onAdd={onAdd} />);
  fireEvent.click(screen.getByRole("button", { name: "Agregar prenda" }));
  const dialog = within(screen.getByRole("dialog", { name: "Buscar prendas" }));
  fireEvent.change(dialog.getByLabelText("Código de la prenda"), { target: { value: "7857" } });
  return { dialog, onAdd };
}

it("muestra las presentaciones y solo las tallas de la elegida", async () => {
  const { dialog, onAdd } = search(ivory, burgundy);
  const ivoryButton = await dialog.findByRole("button", { name: "Ivory" });
  const burgundyButton = dialog.getByRole("button", { name: "Burgundy" });
  expect(dialog.getByRole("button", { name: "Ampliar imagen de Código 7857 · Ivory" }).querySelector("img")).toHaveAttribute("src", "/ivory.webp");
  expect(dialog.queryByRole("button", { name: "Agregar" })).toBeNull();

  fireEvent.click(burgundyButton);
  expect(dialog.getByText("8.5")).toBeVisible();
  expect(dialog.queryByText("5.5")).toBeNull();
  fireEvent.click(dialog.getByRole("button", { name: "Agregar" }));
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ variant: burgundy.sizes[0] }));

  fireEvent.click(ivoryButton);
  expect(dialog.getByText("5.5")).toBeVisible();
  expect(dialog.queryByText("8.5")).toBeNull();

  fireEvent.change(dialog.getByLabelText("Código de la prenda"), { target: { value: "7858" } });
  expect(await dialog.findByRole("button", { name: "Ivory" })).toHaveAttribute("aria-pressed", "false");
});

it("muestra directamente las tallas cuando hay una sola presentación", async () => {
  const { dialog } = search(ivory);
  expect(await dialog.findByText("5.5")).toBeVisible();
  expect(dialog.queryByRole("button", { name: "Ivory" })).toBeNull();
});

it("permite abrir la importación desde el selector de prendas", () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const onImportCart = vi.fn();
  render(<SaleProductPicker lines={[]} onAdd={vi.fn()} onImportCart={onImportCart} />);
  expect(screen.queryByRole("button", { name: "Importar carrito" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Agregar prenda" }));
  const dialog = screen.getByRole("dialog", { name: "Buscar prendas" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Importar carrito" }));

  expect(onImportCart).toHaveBeenCalledOnce();
  expect(dialog).not.toHaveAttribute("open");
});

it("amplía la imagen y vuelve al buscador con la presentación seleccionada", async () => {
  const { dialog, onAdd } = search(ivory, burgundy);
  const presentation = await dialog.findByRole("button", { name: "Ivory" });
  fireEvent.click(presentation);
  fireEvent.click(dialog.getByRole("button", { name: "Ampliar imagen de Código 7857 · Ivory" }));

  const preview = screen.getByRole("dialog", { name: "Imagen de Código 7857 · Ivory" });
  expect(within(preview).getByRole("img")).toHaveAttribute("src", "/ivory.webp");
  fireEvent(preview, new Event("cancel", { bubbles: true, cancelable: true }));

  expect(preview).not.toBeInTheDocument();
  expect(presentation).toHaveAttribute("aria-pressed", "true");
  expect(dialog.getByText("5.5")).toBeVisible();
  expect(onAdd).not.toHaveBeenCalled();
});
