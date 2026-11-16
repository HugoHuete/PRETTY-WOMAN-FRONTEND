import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderProductImages } from "./purchase-order-product-images";
import type { OrderProductDTO } from "./purchase-order-types";

const product = {
  id: 1, name: "Vestido", primaryImageUrl: "/principal.webp",
  presentations: [
    { id: 1, name: "Rojo", primaryImageUrl: "/principal.webp" },
    { id: 2, name: "Azul", primaryImageUrl: "/azul.webp" },
  ],
} as OrderProductDTO;

describe("imágenes de producto en la orden", () => {
  it("abre la imagen principal y permite recorrer las presentaciones sin repetir imágenes", () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<OrderProductImages product={product} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver imágenes de Vestido" }));
    const dialog = screen.getByRole("dialog", { name: "Imágenes de Vestido" });
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", "/principal.webp");
    fireEvent.click(within(dialog).getByRole("button", { name: "Siguiente" }));
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", "/azul.webp");
    expect(within(dialog).getByText("Azul · 2 de 2")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar imágenes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("no muestra un control cuando no hay imágenes", () => {
    render(<OrderProductImages product={{ ...product, primaryImageUrl: null, presentations: [] }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
