import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import {
  deleteProductImage,
  fetchProductPresentationImages,
  setPrimaryProductPresentationImage,
  uploadProductPresentationImage,
  validateProductImage,
  type RequestFn,
} from "./product-images-api";
import type { ProductImageDTO } from "./product-types";

type ProductPresentationImagesProps = {
  request: RequestFn;
  productId: number;
  presentationId: number;
  presentationName: string;
  initialImages?: ProductImageDTO[];
  onImagesChange?: (presentationId: number, images: ProductImageDTO[]) => void;
  onPrimaryImageChange?: (
    presentationId: number,
    image: ProductImageDTO | null,
  ) => void;
};

export function ProductPresentationImages({
  request,
  productId,
  presentationId,
  presentationName,
  initialImages,
  onImagesChange,
  onPrimaryImageChange,
}: ProductPresentationImagesProps) {
  const [images, setImages] = useState<ProductImageDTO[]>(initialImages ?? []);
  const [isLoading, setIsLoading] = useState(!initialImages);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingPrimaryId, setPendingPrimaryId] = useState<number | null>(null);
  const [imageToDelete, setImageToDelete] = useState<ProductImageDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const requestId = useRef(0);

  const applyImages = useCallback(
    (nextImages: ProductImageDTO[]) => {
      setImages(nextImages);
      onImagesChange?.(presentationId, nextImages);
      onPrimaryImageChange?.(
        presentationId,
        nextImages.find((image) => image.isPrimary) ?? null,
      );
    },
    [onImagesChange, onPrimaryImageChange, presentationId],
  );

  const loadImages = useCallback(
    async (showLoading = true) => {
      const currentRequestId = ++requestId.current;
      if (showLoading) setIsLoading(true);
      setError(null);
      try {
        const result = await fetchProductPresentationImages(
          request,
          productId,
          presentationId,
        );
        if (currentRequestId !== requestId.current) return null;
        applyImages(result);
        return result;
      } catch (caught) {
        if (currentRequestId === requestId.current) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar las imágenes de la presentación.",
          );
        }
        return null;
      } finally {
        if (currentRequestId === requestId.current) setIsLoading(false);
      }
    },
    [applyImages, presentationId, productId, request],
  );

  useEffect(() => {
    if (initialImages) {
      requestId.current += 1;
      setImages(initialImages);
      setIsLoading(false);
      return;
    }

    void loadImages();
    return () => {
      requestId.current += 1;
    };
  }, [initialImages, loadImages]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    setError(null);
    setValidationError(null);
    const validFiles: File[] = [];
    const validationMessages: string[] = [];
    for (const file of selectedFiles) {
      const message = validateProductImage(file);
      if (message) validationMessages.push(file.name + ": " + message);
      else validFiles.push(file);
    }

    if (validationMessages.length > 0) {
      setValidationError(validationMessages.join(" "));
    }
    if (validFiles.length === 0) return;

    setIsUploading(true);
    let hasUploaded = false;
    let hasPrimary = images.some((image) => image.isPrimary);
    try {
      for (const file of validFiles) {
        await uploadProductPresentationImage(
          request,
          productId,
          presentationId,
          file,
          !hasPrimary,
        );
        hasUploaded = true;
        hasPrimary = true;
      }
      if (hasUploaded) await loadImages(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo subir la imagen.",
      );
      if (hasUploaded) await loadImages(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSetPrimary = async (image: ProductImageDTO) => {
    setPendingPrimaryId(image.id);
    setError(null);
    try {
      const result = await setPrimaryProductPresentationImage(
        request,
        productId,
        presentationId,
        image.id,
        images.map((currentImage) => currentImage.id),
      );
      applyImages(result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo marcar la imagen principal.",
      );
    } finally {
      setPendingPrimaryId(null);
    }
  };

  const handleDelete = async () => {
    if (!imageToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteProductImage(request, productId, imageToDelete.id);
      await loadImages(false);
      setImageToDelete(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo eliminar la imagen.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section
        aria-labelledby={"presentation-images-" + presentationId}
        className="mt-4 rounded-lg border border-pw-line bg-white p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3
              className="text-sm font-extrabold text-pw-ink"
              id={"presentation-images-" + presentationId}
            >
              Imágenes de {presentationName}
            </h3>
            <p className="mt-1 text-xs text-pw-muted">
              JPEG, PNG o WebP · máximo 4 MB por archivo
            </p>
          </div>
          <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-pw-brand-deep px-3 text-xs font-extrabold text-white hover:bg-pw-brand focus-within:outline-3 focus-within:outline-pw-brand-deep focus-within:outline-offset-2">
            {isUploading ? "Subiendo…" : "Agregar imágenes"}
            <input
              aria-label={"Agregar imágenes a " + presentationName}
              className="sr-only"
              disabled={isUploading}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => void handleFileChange(event)}
            />
          </label>
        </div>

        {isLoading ? (
          <p className="mt-4 rounded-lg border border-pw-line bg-pw-canvas/50 p-4 text-sm text-pw-muted">
            Cargando imágenes…
          </p>
        ) : null}
        {validationError ? (
          <p
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            role="alert"
          >
            {validationError}
          </p>
        ) : null}
        {error ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {!isLoading && images.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-pw-line bg-pw-canvas/40 p-4 text-sm text-pw-muted">
            Esta presentación todavía no tiene imágenes.
          </p>
        ) : null}
        {!isLoading && images.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {images.map((image, index) => {
              const imageLabel = image.isPrimary
                ? presentationName + " — imagen principal"
                : presentationName + " — imagen " + (index + 1);
              return (
                <figure
                  className="overflow-hidden rounded-lg border border-pw-line bg-pw-canvas/35"
                  key={image.id}
                >
                  <img
                    alt={imageLabel}
                    className="aspect-square w-full object-cover"
                    src={image.thumbnailUrl}
                  />
                  <figcaption className="space-y-2 p-2">
                    {image.isPrimary ? (
                      <span className="inline-flex rounded-full bg-pw-brand-soft px-2 py-1 text-[0.6875rem] font-extrabold text-pw-brand-deep">
                        Principal
                      </span>
                    ) : (
                      <button
                        aria-label={"Marcar como principal: " + imageLabel}
                        className="min-h-9 w-full rounded-lg border border-pw-line px-2 text-[0.6875rem] font-extrabold text-pw-ink hover:bg-white focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
                        disabled={pendingPrimaryId !== null || isDeleting}
                        type="button"
                        onClick={() => void handleSetPrimary(image)}
                      >
                        {pendingPrimaryId === image.id
                          ? "Actualizando…"
                          : "Marcar como principal"}
                      </button>
                    )}
                    <button
                      aria-label={"Eliminar " + imageLabel}
                      className="min-h-9 w-full rounded-lg border border-red-200 px-2 text-[0.6875rem] font-extrabold text-red-700 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-red-700 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
                      disabled={pendingPrimaryId !== null || isDeleting}
                      type="button"
                      onClick={() => {
                        setError(null);
                        setImageToDelete(image);
                      }}
                    >
                      Eliminar
                    </button>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={imageToDelete !== null}
        title="Eliminar imagen"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar imagen"
        error={error}
        isPending={isDeleting}
        onConfirm={() => void handleDelete()}
        onClose={() => {
          if (!isDeleting) {
            setImageToDelete(null);
            setError(null);
          }
        }}
      />
    </>
  );
}

export type { ProductPresentationImagesProps };

