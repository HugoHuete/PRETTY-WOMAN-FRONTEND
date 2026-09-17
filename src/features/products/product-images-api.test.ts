import { describe, expect, it, vi } from "vitest";
import type { ProductImageDTO } from "./product-types";
import {
  deleteProductImage,
  fetchProductPresentationImages,
  setPrimaryProductPresentationImage,
  uploadProductPresentationImage,
  validateProductImage,
} from "./product-images-api";

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

describe("product-images-api", () => {
  it("lista las imágenes de una presentación", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse([]));

    await fetchProductPresentationImages(request, 42, 7);

    expect(request).toHaveBeenCalledWith(
      "/api/v1/products/42/images?productPresentationId=7",
    );
  });

  it("sube un archivo con isPrimary y productPresentationId", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(image(), 201));
    const file = new File(["image"], "coral.webp", { type: "image/webp" });

    await uploadProductPresentationImage(request, 42, 7, file, true);

    const [, init] = request.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    expect((init.body as FormData).get("isPrimary")).toBe("true");
    expect(request.mock.calls[0][0]).toBe(
      "/api/v1/products/42/images?productPresentationId=7",
    );
  });

  it("envía todos los IDs al marcar una imagen como principal", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse([image()], 200));

    await setPrimaryProductPresentationImage(request, 42, 7, 43, [42, 43]);

    expect(request).toHaveBeenCalledWith("/api/v1/products/42/images", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productPresentationId: 7,
        primaryImageId: 43,
        imageIdsInOrder: [42, 43],
      }),
    });
  });

  it("elimina una imagen por producto e ID", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await deleteProductImage(request, 42, 43);

    expect(request).toHaveBeenCalledWith("/api/v1/products/42/images/43", {
      method: "DELETE",
    });
  });

  it("rechaza tipos no permitidos y archivos mayores de 4 MB", () => {
    expect(
      validateProductImage(new File(["x"], "file.gif", { type: "image/gif" })),
    ).toBe("Solo se permiten imágenes JPEG, PNG o WebP.");
    expect(
      validateProductImage(
        new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", {
          type: "image/png",
        }),
      ),
    ).toBe("La imagen no puede superar los 4 MB.");
  });
});
