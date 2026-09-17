import type { ProductImageDTO } from "./product-types";

export type RequestFn = (path: string, init?: RequestInit) => Promise<Response>;

export const productImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxProductImageBytes = 4 * 1024 * 1024;

async function problemDetail(response: Response, fallback: string) {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };
    return problem.detail ?? problem.title ?? fallback;
  } catch {
    return fallback;
  }
}

async function ensureOk(response: Response, fallback: string) {
  if (!response.ok) throw new Error(await problemDetail(response, fallback));
}

export async function fetchProductPresentationImages(
  request: RequestFn,
  productId: number,
  presentationId: number,
): Promise<ProductImageDTO[]> {
  const response = await request(
    "/api/v1/products/" + productId + "/images?productPresentationId=" + presentationId,
  );
  await ensureOk(response, "No se pudieron cargar las imágenes de la presentación.");
  return (await response.json()) as ProductImageDTO[];
}

export async function uploadProductPresentationImage(
  request: RequestFn,
  productId: number,
  presentationId: number,
  file: File,
  isPrimary: boolean,
): Promise<ProductImageDTO> {
  const body = new FormData();
  body.append("file", file);
  body.append("isPrimary", String(isPrimary));
  const response = await request(
    "/api/v1/products/" + productId + "/images?productPresentationId=" + presentationId,
    { method: "POST", body },
  );
  await ensureOk(response, "No se pudo subir la imagen.");
  return (await response.json()) as ProductImageDTO;
}

export async function setPrimaryProductPresentationImage(
  request: RequestFn,
  productId: number,
  presentationId: number,
  primaryImageId: number,
  imageIdsInOrder: number[],
): Promise<ProductImageDTO[]> {
  const response = await request("/api/v1/products/" + productId + "/images", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productPresentationId: presentationId,
      primaryImageId,
      imageIdsInOrder,
    }),
  });
  await ensureOk(response, "No se pudo marcar la imagen principal.");
  return (await response.json()) as ProductImageDTO[];
}

export async function deleteProductImage(
  request: RequestFn,
  productId: number,
  imageId: number,
): Promise<void> {
  const response = await request(
    "/api/v1/products/" + productId + "/images/" + imageId,
    { method: "DELETE" },
  );
  await ensureOk(response, "No se pudo eliminar la imagen.");
}

export function validateProductImage(file: File): string | null {
  if (!productImageMimeTypes.includes(file.type as (typeof productImageMimeTypes)[number])) {
    return "Solo se permiten imágenes JPEG, PNG o WebP.";
  }
  if (file.size > maxProductImageBytes) {
    return "La imagen no puede superar los 4 MB.";
  }
  return null;
}

