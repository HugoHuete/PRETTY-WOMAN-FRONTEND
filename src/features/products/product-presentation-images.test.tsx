import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProductImageDTO } from "./product-types";
import { ProductPresentationImages } from "./product-presentation-images";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const image = (overrides: Partial<ProductImageDTO> = {}): ProductImageDTO => ({
  id: 42,
  thumbnailUrl: "/images/coral-thumb.webp",
  webUrl: "/images/coral.webp",
  productPresentationId: 7,
  isPrimary: true,
  sortOrder: 0,
  ...overrides,
});

const primaryImage = () => image();
const secondaryImage = () =>
  image({
    id: 43,
    thumbnailUrl: "/images/coral-2-thumb.webp",
    webUrl: "/images/coral-2.webp",
    isPrimary: false,
    sortOrder: 1,
  });

describe("ProductPresentationImages", () => {
  it("carga y muestra las imágenes de la presentación", async () => {
    const request = vi.fn().mockImplementation((path: string) => {
      if (path === "/api/v1/products/42/images?productPresentationId=7") {
        return jsonResponse([primaryImage(), secondaryImage()]);
      }
      throw new Error("Unexpected request: " + path);
    });

    render(
      <ProductPresentationImages
        request={request}
        productId={42}
        presentationId={7}
        presentationName="Coral"
      />,
    );

    expect(
      await screen.findByRole("img", { name: "Coral — imagen principal" }),
    ).toHaveAttribute("src", primaryImage().thumbnailUrl);
    expect(screen.getByRole("img", { name: "Coral — imagen 2" })).toBeVisible();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("sube varios archivos y marca solo el primero como principal cuando no hay principal", async () => {
    const user = userEvent.setup();
    const uploaded = [primaryImage(), secondaryImage()];
    const request = vi.fn()
      .mockImplementationOnce(() => jsonResponse([]))
      .mockImplementationOnce((path: string, init?: RequestInit) => {
        expect(path).toContain("/api/v1/products/42/images?productPresentationId=7");
        expect(init?.method).toBe("POST");
        return jsonResponse(uploaded[0], 201);
      })
      .mockImplementationOnce((path: string, init?: RequestInit) => {
        expect(path).toContain("/api/v1/products/42/images?productPresentationId=7");
        expect(init?.method).toBe("POST");
        return jsonResponse(uploaded[1], 201);
      })
      .mockImplementationOnce(() =>
        jsonResponse([primaryImage(), secondaryImage()]),
      );

    render(
      <ProductPresentationImages
        request={request}
        productId={42}
        presentationId={7}
        presentationName="Coral"
      />,
    );

    const input = await screen.findByLabelText("Agregar imágenes a Coral");
    await user.upload(input, [
      new File(["one"], "one.jpg", { type: "image/jpeg" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ]);

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect((request.mock.calls[1][1].body as FormData).get("isPrimary")).toBe("true");
    expect((request.mock.calls[2][1].body as FormData).get("isPrimary")).toBe("false");
  });

  it("permite marcar una imagen secundaria como principal", async () => {
    const user = userEvent.setup();
    const request = vi.fn()
      .mockImplementationOnce(() => jsonResponse([primaryImage(), secondaryImage()]))
      .mockImplementationOnce(() =>
        jsonResponse([
          { ...secondaryImage(), isPrimary: true, sortOrder: 0 },
          { ...primaryImage(), isPrimary: false, sortOrder: 1 },
        ]),
      );

    render(
      <ProductPresentationImages
        request={request}
        productId={42}
        presentationId={7}
        presentationName="Coral"
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Marcar como principal: Coral — imagen 2",
      }),
    );

    expect(request.mock.calls[1][0]).toBe("/api/v1/products/42/images");
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
      productPresentationId: 7,
      primaryImageId: 43,
      imageIdsInOrder: [42, 43],
    });
    expect(
      await screen.findByRole("img", { name: "Coral — imagen principal" }),
    ).toHaveAttribute("src", secondaryImage().thumbnailUrl);
  });

  it("pide confirmación antes de eliminar y conserva la galería si falla", async () => {
    const user = userEvent.setup();
    const request = vi.fn()
      .mockImplementationOnce(() => jsonResponse([primaryImage(), secondaryImage()]))
      .mockImplementationOnce(
        () =>
          new Response(
            JSON.stringify({ detail: "No se pudo eliminar la imagen." }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            },
          ),
      );

    render(
      <ProductPresentationImages
        request={request}
        productId={42}
        presentationId={7}
        presentationName="Coral"
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Eliminar Coral — imagen 2",
      }),
    );
    expect(screen.getByRole("dialog", { name: "Eliminar imagen" })).toBeVisible();
    expect(request).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Eliminar imagen" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent("No se pudo eliminar la imagen.");
    expect(alerts[1]).toHaveTextContent("No se pudo eliminar la imagen.");
    expect(screen.getByRole("img", { name: "Coral — imagen principal" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Coral — imagen 2" })).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Eliminar imagen" })).toBeVisible();
  });

  it("elimina una imagen y vuelve a consultar el orden del backend", async () => {
    const user = userEvent.setup();
    const request = vi.fn()
      .mockImplementationOnce(() => jsonResponse([primaryImage(), secondaryImage()]))
      .mockImplementationOnce(() => new Response(null, { status: 204 }))
      .mockImplementationOnce(() => jsonResponse([secondaryImage()]));

    render(
      <ProductPresentationImages
        request={request}
        productId={42}
        presentationId={7}
        presentationName="Coral"
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Eliminar Coral — imagen 2",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Eliminar imagen" }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "/api/v1/products/42/images/43",
        { method: "DELETE" },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("img", { name: "Coral — imagen 2" })).not.toBeInTheDocument(),
    );
  });
});

