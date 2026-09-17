import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { LoadingButton } from "../../shared/ui/loading-button";
import { ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import {
  PresentationEditor,
  type CatalogState,
  type FieldError,
  type PresentationDraft,
  type ProductDraft,
  type VariantDraft,
} from "./purchase-order-create-page";
import { type OrderDTO, type SupplierDTO } from "./purchase-order-types";

type EditDraft = {
  purchaseDate: string;
  supplierId: string;
  purchaseCurrencyId: string;
  supplierShippingCostUsd: string;
  comments: string;
};

type LoadError = {
  orderId: string;
  detail: string;
  isForbidden: boolean;
  isNotFound: boolean;
};

function problemDetail(response: Response, fallback: string) {
  return response
    .clone()
    .json()
    .then((body: { detail?: string; title?: string }) => body.detail ?? body.title ?? fallback)
    .catch(() => fallback);
}

function inputClass() {
  return "h-11 w-full rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none transition focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30";
}

function today() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function formatExchangeRate(value: number) {
  const formatted = new Intl.NumberFormat("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return "C$ " + formatted + " por $1";
}

function formatCurrencyInputValue(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function money(value: number | null, currency: "USD" | "C$") {
  if (value === null) return "—";
  return (currency === "USD" ? "$" : "C$") + " " + formatCurrencyInputValue(value);
}

function toUsd(amount: number, purchaseCurrencyId: string, exchangeRate: number | null) {
  if (purchaseCurrencyId === "1") return amount;
  return exchangeRate === null ? null : amount / exchangeRate;
}

function toCordobas(amount: number, purchaseCurrencyId: string, exchangeRate: number | null) {
  if (purchaseCurrencyId === "2") return amount;
  return exchangeRate === null ? null : amount * exchangeRate;
}

function merchandiseUnitCostNio(size: { quantity: number; merchandiseTotalCostNio: number }) {
  return size.quantity > 0 ? size.merchandiseTotalCostNio / size.quantity : 0;
}

function unitCostForCurrency(size: { quantity: number; merchandiseTotalCostNio: number }, purchaseCurrencyId: string, exchangeRate: number) {
  const merchandiseCostNio = merchandiseUnitCostNio(size);
  return purchaseCurrencyId === "1" ? merchandiseCostNio / exchangeRate : merchandiseCostNio;
}

function SummaryRow({ label, value, emphasized = false }: { label: string; value: React.ReactNode; emphasized?: boolean }) {
  return (
    <div className={"flex items-center justify-between gap-3 py-3 " + (emphasized ? "border-t border-pw-line pt-4" : "")}>
      <dt className="text-sm text-pw-muted">{label}</dt>
      <dd className={emphasized ? "text-lg font-extrabold" : "font-bold"}>{value}</dd>
    </div>
  );
}

function draftFromOrder(order: OrderDTO): EditDraft {
  return {
    purchaseDate: order.purchaseDate.slice(0, 10),
    supplierId: String(order.supplierId),
    purchaseCurrencyId: String(order.purchaseCurrencyId),
    supplierShippingCostUsd: String(order.supplierShippingCostUsd),
    comments: order.comments ?? "",
  };
}

function productsFromOrder(order: OrderDTO, purchaseCurrencyId: string, exchangeRate: number): ProductDraft[] {
  const historicalExchangeRate = Number(order.exchangeRate);
  const hydrationExchangeRate = Number.isFinite(historicalExchangeRate) && historicalExchangeRate > 0 ? historicalExchangeRate : exchangeRate;
  return order.products.map((product) => ({
    id: product.id,
    supplierProductCode: product.supplierProductCode,
    name: product.name,
    subcategoryId: String(product.subcategoryId),
    presentations: product.presentations.map((presentation) => ({
      id: presentation.id,
      sourcePresentationId: presentation.id,
      name: presentation.name ?? "",
      variants: presentation.sizes.map((size) => ({
        id: size.id,
        sizeId: String(size.sizeId),
        quantity: String(size.quantity),
        unitCost: String(unitCostForCurrency(size, purchaseCurrencyId, hydrationExchangeRate)),
      })),
    })),
  }));
}

function emptyVariant(): VariantDraft {
  return { sizeId: "", quantity: "1", unitCost: "" };
}

function emptyPresentation(id: number): PresentationDraft {
  return { id, name: "", variants: [emptyVariant()] };
}

function emptyProduct(id: number, presentationId: number): ProductDraft {
  return {
    id,
    supplierProductCode: "",
    name: "",
    subcategoryId: "",
    presentations: [emptyPresentation(presentationId)],
  };
}

function productsForCurrency(products: ProductDraft[], order: OrderDTO, fromCurrencyId: string, toCurrencyId: string, exchangeRate: number) {
  if (fromCurrencyId === toCurrencyId) return products;

  return products.map((product) => {
    const sourceProduct = order.products.find((item) => item.id === product.id);
    if (!sourceProduct) return product;

    return {
      ...product,
      presentations: product.presentations.map((presentation) => {
        const sourcePresentation = sourceProduct.presentations.find((item) => item.id === (presentation.sourcePresentationId ?? presentation.id));
        if (!sourcePresentation) return presentation;

        return {
          ...presentation,
          variants: presentation.variants.map((variant) => {
            const sourceVariant = sourcePresentation.sizes.find((item) => item.id === variant.id);
            if (!sourceVariant) return variant;

            const sourceExchangeRate = fromCurrencyId === String(order.purchaseCurrencyId) ? order.exchangeRate : exchangeRate;
            const originalValue = unitCostForCurrency(sourceVariant, fromCurrencyId, sourceExchangeRate);
            if (Number(variant.unitCost) !== originalValue) return variant;

            return {
              ...variant,
              unitCost: String(unitCostForCurrency(sourceVariant, toCurrencyId, exchangeRate)),
            };
          }),
        };
      }),
    };
  });
}

function productsPayload(products: ProductDraft[], order: OrderDTO) {
  return products.map((product) => {
    const sourceProduct = order.products.find((item) => item.id === product.id);
    return {
      ...(product.id > 0 ? { id: product.id } : {}),
      supplierProductCode: product.supplierProductCode.trim(),
      name: product.name.trim(),
      subcategoryId: Number(product.subcategoryId),
      presentations: product.presentations.map((presentation, presentationIndex) => {
        const sourcePresentation = sourceProduct?.presentations.find((item) => item.id === (presentation.sourcePresentationId ?? presentation.id));
        return {
          name: presentation.name.trim() || null,
          sortOrder: presentationIndex,
          sizes: presentation.variants.map((variant) => {
            const sourceVariant = sourcePresentation?.sizes.find((item) => item.id === variant.id);
            return {
              sizeId: Number(variant.sizeId),
              quantity: Number(variant.quantity),
              unitCost: Number(variant.unitCost),
              salePrice: sourceVariant?.salePrice ?? 0,
            };
          }),
        };
      }),
    };
  });
}

function updatePayload(order: OrderDTO, draft: EditDraft, products: ProductDraft[]) {
  return {
    purchaseDate: draft.purchaseDate,
    supplierId: Number(draft.supplierId),
    purchaseCurrencyId: Number(draft.purchaseCurrencyId),
    supplierShippingCostUsd: Number(draft.supplierShippingCostUsd),
    comments: draft.comments.trim() || null,
    products: productsPayload(products, order),
  };
}

function hasReceipts(order: OrderDTO) {
  return order.receivedAmountNio > 0 || order.products.some((product) =>
    product.presentations.some((presentation) => presentation.sizes.some((size) => size.receivedQuantity > 0)),
  );
}
function hasProductLocks(order: OrderDTO) {
  return hasReceipts(order) || order.purchaseShortages.length > 0 || order.products.some((product) =>
    product.presentations.some((presentation) => presentation.sizes.some((size) => size.availableQuantity > 0 || size.reservedQuantity > 0)),
  );
}

function productLockMessage(order: OrderDTO) {
  if (hasReceipts(order)) return "Esta orden tiene recepciones y sus productos no se pueden modificar.";
  if (order.purchaseShortages.length > 0) return "Esta orden tiene faltantes registrados y sus productos no se pueden modificar.";
  return "Esta orden tiene inventario disponible o reservado y sus productos no se pueden modificar.";
}

function validateProducts(products: ProductDraft[]) {
  if (!products.length) return "Agrega al menos un producto.";

  for (const [productIndex, product] of products.entries()) {
    if (!product.supplierProductCode.trim() || !product.name.trim() || !product.subcategoryId) {
      return "Completa el código, nombre y subcategoría de cada producto.";
    }
    if (!product.presentations.length) return "Cada producto debe tener al menos una presentación.";

    for (const [presentationIndex, presentation] of product.presentations.entries()) {
      if (product.presentations.length > 1 && !presentation.name.trim()) {
        return "Completa el nombre de cada presentación.";
      }
      if (!presentation.variants.length) return "Cada presentación debe tener al menos una talla.";

      const usedSizes = new Set<string>();
      for (const variant of presentation.variants) {
        if (!variant.sizeId) return "Selecciona una talla para cada variante.";
        if (usedSizes.has(variant.sizeId)) return "No repitas tallas dentro de una presentación.";
        usedSizes.add(variant.sizeId);
        if (!Number.isInteger(Number(variant.quantity)) || Number(variant.quantity) <= 0) {
          return "Las cantidades deben ser enteros mayores que cero.";
        }
        if (!Number.isFinite(Number(variant.unitCost)) || Number(variant.unitCost) <= 0) {
          return "Completa un costo unitario válido para cada talla.";
        }
      }
      void productIndex;
      void presentationIndex;
    }
  }

  return null;
}

export function PurchaseOrderEditPage() {
  const { id } = useParams();
  const { request } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [appliedExchangeRate, setAppliedExchangeRate] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [products, setProducts] = useState<ProductDraft[]>([]);
  const [collapsedPresentationIds, setCollapsedPresentationIds] = useState<Set<number>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const nextProductId = useRef(-1);
  const nextPresentationId = useRef(-1);

  useEffect(() => {
    if (!id) return undefined;
    setIsLoading(true);
    setLoadError(null);
    setMutationError(null);
    setOrder(null);
    setDraft(null);
    setCatalog(null);
    setSuppliers([]);
    setProducts([]);
    setAppliedExchangeRate(null);
    let active = true;
    void Promise.all([
      request("/api/v1/orders/" + id),
      request("/api/v1/suppliers"),
      request("/api/v1/subcategories"),
      request("/api/v1/sizes"),

    ])
      .then(async ([orderResponse, suppliersResponse, subcategoriesResponse, sizesResponse]) => {
        if (!orderResponse.ok) {
          return {
            kind: "order" as const,
            detail: await problemDetail(orderResponse, "No se pudo cargar esta orden de compra."),
            status: orderResponse.status,
          };
        }
        if (!suppliersResponse.ok) {
          return {
            kind: "suppliers" as const,
            detail: await problemDetail(suppliersResponse, "No se pudieron cargar los proveedores."),
            status: suppliersResponse.status,
          };
        }
        if (!subcategoriesResponse.ok || !sizesResponse.ok) {
          const failedResponse = !subcategoriesResponse.ok ? subcategoriesResponse : sizesResponse;
          return {
            kind: "catalog" as const,
            detail: await problemDetail(failedResponse, "No se pudo cargar el catálogo de productos."),
            status: failedResponse.status,
          };
        }

        return {
          order: (await orderResponse.json()) as OrderDTO,
          catalog: {
            suppliers: (await suppliersResponse.json()) as SupplierDTO[],
            subcategories: (await subcategoriesResponse.json()) as CatalogState["subcategories"],
            sizes: (await sizesResponse.json()) as CatalogState["sizes"],
          },

        };
      })
      .then((result) => {
        if (!active) return;
        if ("kind" in result) {
          setLoadError({
            orderId: id,
            detail: result.detail ?? "No se pudo cargar la información para editar esta orden.",
            isForbidden: result.status === 403,
            isNotFound: result.status === 404,
          });
          return;
        }
        const historicalExchangeRate = Number(result.order.exchangeRate);
        if (!Number.isFinite(historicalExchangeRate) || historicalExchangeRate <= 0) {
          setLoadError({ orderId: id, detail: "La tasa de cambio histórica de la orden no es válida.", isForbidden: false, isNotFound: false });
          return;
        }
        setAppliedExchangeRate(historicalExchangeRate);
        setOrder(result.order);
        setSuppliers(result.catalog.suppliers);
        setCatalog(result.catalog);
        setDraft(draftFromOrder(result.order));
        setProducts(productsFromOrder(result.order, String(result.order.purchaseCurrencyId), historicalExchangeRate));
      })
      .catch(() => {
        if (active) {
          setLoadError({
            orderId: id,
            detail: "No se pudo cargar la información para editar esta orden.",
            isForbidden: false,
            isNotFound: false,
          });
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, request, retryVersion]);

  useEffect(() => {
    setHeading({
      title: order && String(order.id) === id ? "Editar orden #" + order.id : "Editar orden de compra",
      breadcrumbs: (
        <Link
          className="inline-flex items-center underline underline-offset-4 hover:text-pw-brand-deep"
          to={"/purchases/orders/" + (id ?? "")}
        >
          ← Regresar al detalle
        </Link>
      ),
    });
    setAction(null);
    return () => {
      setHeading(null);
      setAction(null);
    };
  }, [id, order, setAction, setHeading]);

  const supplierOptions = useMemo(() => {
    if (!draft) return [];
    const currentSupplier = suppliers.find((supplier) => String(supplier.id) === draft.supplierId);
    return [
      { value: "", label: "Selecciona un proveedor" },
      ...(currentSupplier ? [{ value: String(currentSupplier.id), label: currentSupplier.name }] : []),
      ...suppliers
        .filter((supplier) => supplier.enabled && String(supplier.id) !== draft.supplierId)
        .map((supplier) => ({ value: String(supplier.id), label: supplier.name })),
    ];
  }, [draft, suppliers]);

  const updateDraft = (key: keyof EditDraft, value: string) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    if (key === "purchaseCurrencyId" && order && draft) {
      if (appliedExchangeRate !== null) setProducts((current) => productsForCurrency(current, order, draft.purchaseCurrencyId, value, appliedExchangeRate));
    }
    setMutationError(null);
  };

  const updateProduct = (productIndex: number, key: "supplierProductCode" | "name" | "subcategoryId", value: string) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? { ...product, [key]: value } : product));
    setMutationError(null);
  };

  const updatePresentation = (productIndex: number, presentationIndex: number, value: string) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? {
      ...product,
      presentations: product.presentations.map((presentation, currentIndex) => currentIndex === presentationIndex ? { ...presentation, name: value } : presentation),
    } : product));
    setMutationError(null);
  };

  const updateVariant = (productIndex: number, presentationIndex: number, variantIndex: number, key: keyof VariantDraft, value: string) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? {
      ...product,
      presentations: product.presentations.map((presentation, currentPresentationIndex) => currentPresentationIndex === presentationIndex ? {
        ...presentation,
        variants: presentation.variants.map((variant, currentVariantIndex) => currentVariantIndex === variantIndex ? { ...variant, [key]: value } : variant),
      } : presentation),
    } : product));
    setMutationError(null);
  };

  const addProduct = () => {
    setProducts((current) => [...current, emptyProduct(nextProductId.current--, nextPresentationId.current--)]);
    setMutationError(null);
  };

  const removeProduct = (productId: number) => {
    setProducts((current) => current.length === 1 ? current : current.filter((product) => product.id !== productId));
  };

  const addPresentation = (productIndex: number) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? {
      ...product,
      presentations: [...product.presentations, emptyPresentation(nextPresentationId.current--)],
    } : product));
  };

  const removePresentation = (productIndex: number, presentationId: number) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? {
      ...product,
      presentations: product.presentations.length === 1 ? product.presentations : product.presentations.filter((presentation) => presentation.id !== presentationId),
    } : product));
  };

  const duplicatePresentation = (productIndex: number, presentationIndex: number) => {
    setProducts((current) => current.map((product, index) => {
      if (index !== productIndex) return product;
      const source = product.presentations[presentationIndex];
      if (!source) return product;
      return {
        ...product,
        presentations: [...product.presentations.slice(0, presentationIndex + 1), { ...source, id: nextPresentationId.current--, sourcePresentationId: source.sourcePresentationId ?? (source.id > 0 ? source.id : undefined), variants: source.variants.map((variant) => ({ ...variant })) }, ...product.presentations.slice(presentationIndex + 1)],
      };
    }));
  };

  const addVariant = (productIndex: number, presentationIndex: number) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? {
      ...product,
      presentations: product.presentations.map((presentation, currentIndex) => currentIndex === presentationIndex ? { ...presentation, variants: [...presentation.variants, emptyVariant()] } : presentation),
    } : product));
  };

  const duplicateVariant = (productIndex: number, presentationIndex: number, variantIndex: number) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? {
      ...product,
      presentations: product.presentations.map((presentation, currentIndex) => {
        if (currentIndex !== presentationIndex) return presentation;
        const variant = presentation.variants[variantIndex];
        if (!variant) return presentation;
        return { ...presentation, variants: [...presentation.variants.slice(0, variantIndex + 1), { ...variant }, ...presentation.variants.slice(variantIndex + 1)] };
      }),
    } : product));
  };

  const removeVariant = (productIndex: number, presentationIndex: number, variantIndex: number) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? {
      ...product,
      presentations: product.presentations.map((presentation, currentIndex) => currentIndex === presentationIndex ? {
        ...presentation,
        variants: presentation.variants.length === 1 ? presentation.variants : presentation.variants.filter((_, currentVariantIndex) => currentVariantIndex !== variantIndex),
      } : presentation),
    } : product));
  };

  const togglePresentation = (presentationId: number) => {
    setCollapsedPresentationIds((current) => {
      const next = new Set(current);
      if (next.has(presentationId)) next.delete(presentationId);
      else next.add(presentationId);
      return next;
    });
  };

  const retryLoad = () => {
    setIsLoading(true);
    setLoadError(null);
    setRetryVersion((version) => version + 1);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !order || !draft || isSubmitting) return;
    if (!draft.purchaseDate || !draft.supplierId) {
      setMutationError("Selecciona un proveedor y una fecha de compra.");
      return;
    }
    if (draft.purchaseDate > today()) {
      setMutationError("La fecha de compra no puede ser futura.");
      return;
    }
    const shippingCost = Number(draft.supplierShippingCostUsd);
    if (!draft.supplierShippingCostUsd.trim() || !Number.isFinite(shippingCost) || shippingCost < 0) {
      setMutationError("El costo de envío del proveedor debe ser un monto mayor o igual que cero.");
      return;
    }
    const productLock = hasProductLocks(order);
    if (productLock) {
      setMutationError("No se puede actualizar una orden con recepciones, inventario o faltantes cerrados.");
      return;
    }
    {
      const productError = validateProducts(products);
      if (productError) {
        setMutationError(productError);
        return;
      }
    }
    if (appliedExchangeRate === null) {
      setMutationError("No se pudo cargar la tasa de cambio bancaria vigente.");
      return;
    }

    setIsSubmitting(true);
    setMutationError(null);
    try {
      const editableProducts = products;
      const response = await request("/api/v1/orders/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload(order, draft, editableProducts)),
      });
      if (!response.ok) throw new Error(await problemDetail(response, "No se pudo actualizar la orden de compra."));
      navigate("/purchases/orders/" + id);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "No se pudo actualizar la orden de compra.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentLoadError = loadError?.orderId === id ? loadError : null;
  if (isLoading) return <LoadingState />;
  if (currentLoadError?.isForbidden) return <ErrorState title="Acceso restringido" description={currentLoadError.detail} />;
  if (currentLoadError?.isNotFound) return <ErrorState title="No encontramos esta orden" description={currentLoadError.detail} />;
  if (currentLoadError) return <ErrorState title="No pudimos preparar la edición" description={currentLoadError.detail} onRetry={retryLoad} />;
  if (!order || !draft || !catalog || appliedExchangeRate === null || String(order.id) !== id) return <LoadingState />;

  const variants = products.flatMap((product) => product.presentations.flatMap((presentation) => presentation.variants));
  const totals = {
    products: products.length,
    variants: variants.length,
    units: variants.reduce((total, variant) => total + (Number(variant.quantity) || 0), 0),
    merchandise: variants.reduce(
      (total, variant) => total + (Number(variant.quantity) || 0) * (Number(variant.unitCost) || 0),
      0,
    ),
    shipping: Math.max(0, Number(draft.supplierShippingCostUsd) || 0),
  };
  const merchandiseUsd = toUsd(totals.merchandise, draft.purchaseCurrencyId, appliedExchangeRate);
  const merchandiseCordobas = toCordobas(totals.merchandise, draft.purchaseCurrencyId, appliedExchangeRate);
  const summaryTotals = {
    merchandise: money(totals.merchandise, draft.purchaseCurrencyId === "1" ? "USD" : "C$"),
    shipping: money(totals.shipping, "USD"),
    totalUsd: money(merchandiseUsd === null ? null : merchandiseUsd + totals.shipping, "USD"),
    totalCordobas: money(merchandiseCordobas === null ? null : merchandiseCordobas + (totals.shipping * appliedExchangeRate), "C$"),
  };

  const productLock = hasProductLocks(order);
  const emptyErrors: FieldError[] = [];

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
      {mutationError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {mutationError}
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
      <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="order-edit-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-pw-muted">Orden #{order.id}</p>
            <h2 id="order-edit-title" className="mt-1 text-xl font-extrabold">Datos generales</h2>
          </div>
        </div>

        <div className="mt-5 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
          <label className="grid gap-1.5 text-sm font-medium text-pw-ink">
            Proveedor
            <SelectControl aria-label="Proveedor" id="purchase-order-edit-supplier" value={draft.supplierId} options={supplierOptions} searchable searchPlaceholder="Buscar proveedor…" onChange={(event) => updateDraft("supplierId", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-pw-ink">
            Fecha de compra
            <input aria-label="Fecha de compra" className={inputClass()} type="date" max={today()} value={draft.purchaseDate} onChange={(event) => updateDraft("purchaseDate", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-pw-ink">
            Moneda de compra
            <SelectControl aria-label="Moneda de compra" id="purchase-order-edit-currency" value={draft.purchaseCurrencyId} options={[{ value: "1", label: "USD" }, { value: "2", label: "C$ — compra local" }]} onChange={(event) => updateDraft("purchaseCurrencyId", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-pw-ink">
            Tasa de cambio
            <input aria-label="Tasa de cambio" className={inputClass() + " cursor-default bg-pw-canvas text-pw-muted"} readOnly value={formatExchangeRate(order.exchangeRate)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-pw-ink">
            Envío proveedor (USD)
            <input aria-label="Envío proveedor (USD)" className={inputClass()} inputMode="decimal" min="0" step="0.01" type="number" value={draft.supplierShippingCostUsd} onChange={(event) => updateDraft("supplierShippingCostUsd", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-pw-ink sm:col-span-2 xl:col-span-5">
            Comentario interno (opcional)
            <textarea aria-label="Comentario interno" className={inputClass() + " min-h-16 py-2.5"} maxLength={280} placeholder="Ej. Compra colección agosto" value={draft.comments} onChange={(event) => updateDraft("comments", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="products-edit-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-pw-muted">Detalle de la orden</p>
            <h2 id="products-edit-title" className="mt-1 text-xl font-extrabold">Productos de la orden</h2>
          </div>
          <button className="min-h-11 rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-muted hover:bg-pw-brand-soft disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={productLock} onClick={addProduct}>+ Agregar producto</button>
        </div>
        {productLock ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">{productLockMessage(order)}</p> : null}
        <fieldset className="mt-5 space-y-5 border-0 p-0" disabled={productLock}>
          {products.map((product, productIndex) => (
            <article className="rounded-lg border border-pw-line p-4" key={product.id}>
              <header className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-pw-muted">Producto {productIndex + 1}</p>
                  <h3 className="block truncate text-base font-extrabold text-pw-ink">{product.name.trim() || "Producto sin nombre"}</h3>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={productLock} onClick={() => addPresentation(productIndex)}>+ Agregar presentación</button>
                  <button className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={productLock} onClick={() => removeProduct(product.id)}>Eliminar producto</button>
                </div>
              </header>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="grid min-w-0 gap-1.5 text-sm font-medium text-pw-ink">
                  Código proveedor
                  <input aria-label={"Código proveedor del producto " + (productIndex + 1)} className={inputClass()} maxLength={50} value={product.supplierProductCode} onChange={(event) => updateProduct(productIndex, "supplierProductCode", event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-medium text-pw-ink">
                  Nombre
                  <input aria-label={"Nombre del producto " + (productIndex + 1)} className={inputClass()} maxLength={120} value={product.name} onChange={(event) => updateProduct(productIndex, "name", event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-medium text-pw-ink">
                  Subcategoría
                  <SelectControl aria-label={"Subcategoría del producto " + (productIndex + 1)} id={"purchase-order-edit-product-" + productIndex + "-subcategory"} value={product.subcategoryId} options={[{ value: "", label: "Selecciona una subcategoría" }, ...catalog.subcategories.map((subcategory) => ({ value: String(subcategory.id), label: subcategory.name }))]} searchable searchPlaceholder="Buscar subcategoría…" onChange={(event) => updateProduct(productIndex, "subcategoryId", event.target.value)} />
                </label>
              </div>
              <div className="mt-5 space-y-4">
                {product.presentations.map((presentation, presentationIndex) => (
                  <PresentationEditor
                    key={"presentation-" + presentation.id}
                    catalog={catalog}
                    errors={emptyErrors}
                    productIndex={productIndex}
                    presentation={presentation}
                    presentationIndex={presentationIndex}
                    purchaseCurrencyId={draft.purchaseCurrencyId}
                    bankRate={appliedExchangeRate}
                    exchangeRateStatus="ready"
                    isCollapsed={collapsedPresentationIds.has(presentation.id)}
                    presentationCount={product.presentations.length}
                    allowRemoveFirstPresentation
                    onToggle={() => togglePresentation(presentation.id)}
                    onPresentationChange={updatePresentation}
                    onVariantChange={updateVariant}
                    onRemove={() => removePresentation(productIndex, presentation.id)}
                    onDuplicatePresentation={() => duplicatePresentation(productIndex, presentationIndex)}
                    onAddVariant={() => addVariant(productIndex, presentationIndex)}
                    onDuplicateVariant={(variantIndex) => duplicateVariant(productIndex, presentationIndex, variantIndex)}
                    onRemoveVariant={(variantIndex) => removeVariant(productIndex, presentationIndex, variantIndex)}
                  />
                ))}
              </div>
            </article>
          ))}
        </fieldset>
      </section>

        </div>

        <aside className="rounded-xl border border-pw-line bg-white p-5 lg:sticky lg:top-5" aria-labelledby="estimate-title">
          <h2 id="estimate-title" className="text-xl font-extrabold">Resumen estimado</h2>
          <dl className="mt-4">
            <SummaryRow label="Productos" value={String(totals.products)} />
            <SummaryRow label="Variantes" value={String(totals.variants)} />
            <SummaryRow label="Unidades" value={String(totals.units)} />
            <SummaryRow label="Mercadería" value={summaryTotals.merchandise} />
            <SummaryRow label="Envío proveedor" value={summaryTotals.shipping} />
            <SummaryRow
              label="Total compra"
              value={<span className="grid justify-items-end gap-1"><span>{summaryTotals.totalUsd}</span><span>{summaryTotals.totalCordobas}</span></span>}
              emphasized
            />
          </dl>
          <LoadingButton className="mt-5 w-full" isLoading={isSubmitting} type="submit">
            {isSubmitting ? "Guardando cambios…" : "Guardar cambios"}
          </LoadingButton>
          <Link className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-muted hover:bg-pw-brand-soft" to={"/purchases/orders/" + id}>
            Cancelar
          </Link>
        </aside>
      </div>
    </form>
  );
}
