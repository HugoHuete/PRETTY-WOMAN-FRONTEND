import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { useToast } from "../../shared/ui/toast-context";
import { LoadingButton } from "../../shared/ui/loading-button";
import { ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { SelectControl } from "../../shared/ui/select-control";
import { convertToCordobas, useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import { type SupplierDTO } from "./purchase-order-types";
import { parsePurchaseOrderCsv, type ImportedPurchaseOrderProduct, type PurchaseOrderCsvDelimiter, type PurchaseOrderCsvResult } from "./purchase-order-csv";

export type CatalogOption = { id: number; name: string };

export type VariantDraft = {
  id?: number;
  sizeId: string;
  quantity: string;
  unitCost: string;
};

export type PresentationDraft = {
  id: number;
  sourcePresentationId?: number;
  name: string;
  variants: VariantDraft[];
};

export type ProductDraft = {
  id: number;
  supplierProductCode: string;
  name: string;
  subcategoryId: string;
  presentations: PresentationDraft[];
};

type OrderDraft = {
  purchaseDate: string;
  supplierId: string;
  purchaseCurrencyId: string;
  supplierShippingCostUsd: string;
  comments: string;
};

export type FieldError = { path: string; message: string };

export type CatalogState = {
  suppliers: SupplierDTO[];
  subcategories: CatalogOption[];
  sizes: CatalogOption[];
};

type CsvImportPreview = PurchaseOrderCsvResult & { fileName: string; text: string; fileError?: boolean };

const MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024;

async function readCsvText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function today() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
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

function duplicateProduct(product: ProductDraft, id: number, presentationIds: number[]): ProductDraft {
  return {
    ...product,
    id,
    presentations: product.presentations.map((presentation, presentationIndex) => ({
      ...presentation,
      id: presentationIds[presentationIndex],
      variants: presentation.variants.map((variant) => ({ ...variant })),
    })),
  };
}

function duplicatePresentation(presentation: PresentationDraft, id: number): PresentationDraft {
  return {
    ...presentation,
    id,
    variants: presentation.variants.map((variant) => ({ ...variant })),
  };
}

function problemDetail(response: Response, fallback: string) {
  return response
    .clone()
    .json()
    .then((body: { detail?: string; title?: string }) => body.detail ?? body.title ?? fallback)
    .catch(() => fallback);
}

async function loadCatalog(
  request: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<CatalogState> {
  const responses = await Promise.all([
    request("/api/v1/suppliers"),
    request("/api/v1/subcategories"),
    request("/api/v1/sizes"),
  ]);
  const labels = ["proveedores", "subcategorías", "tallas"];
  for (let index = 0; index < responses.length; index += 1) {
    if (!responses[index].ok) {
      throw new Error(await problemDetail(responses[index], `No se pudieron cargar las ${labels[index]}.`));
    }
  }
  const [suppliers, subcategories, sizes] = await Promise.all(
    responses.map((response) => response.json()),
  );
  return { suppliers, subcategories, sizes } as CatalogState;
}

function inputClass(error?: string) {
  return `h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal text-pw-ink outline-none transition focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30 ${
    error ? "border-red-400 ring-2 ring-red-100" : "border-pw-line"
  }`;
}

function fieldError(errors: FieldError[], path: string) {
  return errors.find((error) => error.path === path)?.message;
}

export function PurchaseOrderCreatePage() {
  const { request } = useAuth();
  const {
    bankRate,
    error: exchangeRateError,
    refresh: refreshExchangeRate,
    status: exchangeRateStatus,
  } = useExchangeRate();
  const { setHeading, setAction } = usePageActions();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [draft, setDraft] = useState<OrderDraft>(() => ({
    purchaseDate: today(),
    supplierId: "",
    purchaseCurrencyId: "1",
    supplierShippingCostUsd: "0",
    comments: "",
  }));
  const [products, setProducts] = useState<ProductDraft[]>([]);
  const [collapsedProductIds, setCollapsedProductIds] = useState<Set<number>>(() => new Set());
  const [collapsedPresentationIds, setCollapsedPresentationIds] = useState<Set<number>>(() => new Set());
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextProductId = useRef(0);
  const nextPresentationId = useRef(0);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const csvTriggerRef = useRef<HTMLButtonElement>(null);
  const [csvImport, setCsvImport] = useState<CsvImportPreview | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState<PurchaseOrderCsvDelimiter>(";");
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);

  const createProduct = () => {
    nextProductId.current += 1;
    nextPresentationId.current += 1;
    return emptyProduct(nextProductId.current, nextPresentationId.current);
  };

  const createPresentation = () => {
    nextPresentationId.current += 1;
    return emptyPresentation(nextPresentationId.current);
  };

  const addProduct = () => {
    const product = createProduct();
    setProducts((current) => [...current, product]);
  };

  const materializeImportedProducts = (importedProducts: ImportedPurchaseOrderProduct[]) => importedProducts.map((product) => {
    nextProductId.current += 1;
    return {
      ...product,
      id: nextProductId.current,
      subcategoryId: String(product.subcategoryId),
      presentations: product.presentations.map((presentation) => {
        nextPresentationId.current += 1;
        return {
          ...presentation,
          id: nextPresentationId.current,
          variants: presentation.variants.map((variant) => ({ ...variant, sizeId: String(variant.sizeId) })),
        };
      }),
    };
  });

  const closeCsvImporter = () => {
    setCsvImport(null);
    setIsCsvModalOpen(false);
    setIsDraggingCsv(false);
  };

  const openCsvImporter = () => {
    setCsvImport(null);
    setCsvDelimiter(";");
    setIsCsvModalOpen(true);
  };

  const parseCsvFile = async (file: File) => {
    if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
      setCsvImport({
        products: [],
        errors: ["El archivo CSV no puede superar los 5 MB."],
        rowCount: 0,
        validRowCount: 0,
        fileName: file.name,
        text: "",
        fileError: true,
      });
      return;
    }
    const text = await readCsvText(file);
    const result = parseCsvText(text, csvDelimiter);
    setCsvImport({ ...result, fileName: file.name, text });
  };

  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) await parseCsvFile(file);
  };

  const handleCsvDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingCsv(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await parseCsvFile(file);
  };

  const updateCsvDelimiter = (delimiter: PurchaseOrderCsvDelimiter) => {
    setCsvDelimiter(delimiter);
    if (csvImport && !csvImport.fileError) {
      setCsvImport({ ...parseCsvText(csvImport.text, delimiter), fileName: csvImport.fileName, text: csvImport.text });
    }
  };

  const parseCsvText = (text: string, delimiter: PurchaseOrderCsvDelimiter) => {
    const result = parsePurchaseOrderCsv(text, catalog!, delimiter);
    const existingCodes = new Set(products.map((product) => normalizeComparisonValue(product.supplierProductCode)));
    const orderErrors = result.products
      .filter((product) => existingCodes.has(normalizeComparisonValue(product.supplierProductCode)))
      .map((product) => `El código del proveedor "${product.supplierProductCode}" ya existe en la orden.`);
    return { ...result, errors: [...result.errors, ...orderErrors] };
  };

  const applyCsvImport = () => {
    if (!csvImport || csvImport.errors.length || !csvImport.products.length) return;
    setProducts((current) => [...current, ...materializeImportedProducts(csvImport.products)]);
    const importedCount = csvImport.products.length;
    closeCsvImporter();
    showToast({ tone: "success", title: "Productos importados", detail: `${importedCount} producto${importedCount === 1 ? "" : "s"} agregado${importedCount === 1 ? "" : "s"} a la orden.` });
  };

  const downloadCsvTemplate = () => {
    const templateHeaders = ["codigoProveedor", "nombre", "subcategoria", "presentacion", "talla", "cantidad", "costoUnitario"];
    const templateRow = ["SOHO-25120", "Vestido satinado", "Vestidos", "Azul", "M", "3", "8.50"];
    const template = `${templateHeaders.join(csvDelimiter)}\n${templateRow.join(csvDelimiter)}\n`;
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-productos-orden.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const removeProduct = (productId: number) => {
    const product = products.find((currentProduct) => currentProduct.id === productId);
    setProducts((current) => current.filter((product) => product.id !== productId));
    setCollapsedProductIds((current) => {
      const next = new Set(current);
      next.delete(productId);
      return next;
    });
    if (product) {
      setCollapsedPresentationIds((current) => {
        const next = new Set(current);
        product.presentations.forEach((presentation) => next.delete(presentation.id));
        return next;
      });
    }
  };

  const duplicateProductAt = (productId: number) => {
    const source = products.find((product) => product.id === productId);
    if (!source) return;
    const presentationIds = source.presentations.map(() => {
      nextPresentationId.current += 1;
      return nextPresentationId.current;
    });
    const copy = duplicateProduct(source, nextProductId.current + 1, presentationIds);
    nextProductId.current += 1;
    setProducts((current) => {
      const sourceIndex = current.findIndex((product) => product.id === productId);
      if (sourceIndex < 0) return current;
      return [...current.slice(0, sourceIndex + 1), copy, ...current.slice(sourceIndex + 1)];
    });
  };

  const toggleProduct = (productId: number) => {
    setCollapsedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const togglePresentation = (presentationId: number) => {
    setCollapsedPresentationIds((current) => {
      const next = new Set(current);
      if (next.has(presentationId)) next.delete(presentationId);
      else next.add(presentationId);
      return next;
    });
  };

  const addPresentationAt = (productIndex: number) => {
    const presentation = createPresentation();
    setProducts((current) => current.map((product, index) => index === productIndex ? { ...product, presentations: [...product.presentations, presentation] } : product));
  };

  const removePresentationAt = (productIndex: number, presentationId: number) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? { ...product, presentations: product.presentations.filter((presentation) => presentation.id !== presentationId) } : product));
    setCollapsedPresentationIds((current) => {
      const next = new Set(current);
      next.delete(presentationId);
      return next;
    });
  };

  useEffect(() => {
    setHeading({
          title: "Nueva orden de compra",
      breadcrumbs: (
        <Link
          className="inline-flex items-center underline underline-offset-4 hover:text-pw-brand-deep"
          to="/purchases/orders"
        >
          ← Regresar a compras
        </Link>
      ),
    });
    setAction(null);
    return () => {
      setHeading(null);
      setAction(null);
    };
  }, [setAction, setHeading]);

  useEffect(() => {
    let active = true;
    void loadCatalog(request)
      .then((loadedCatalog) => {
        if (active) setCatalog(loadedCatalog);
      })
      .catch((error: Error) => {
        if (active) setCatalogError(error.message);
      });
    return () => {
      active = false;
    };
  }, [request, retryVersion]);

  const totals = useMemo(() => {
    const variants = products.flatMap((product) => product.presentations.flatMap((presentation) => presentation.variants));
    return {
      products: products.length,
      variants: variants.length,
      units: variants.reduce((total, variant) => total + (Number(variant.quantity) || 0), 0),
      merchandise: variants.reduce(
        (total, variant) => total + (Number(variant.quantity) || 0) * (Number(variant.unitCost) || 0),
        0,
      ),
      shipping: Number(draft.supplierShippingCostUsd) || 0,
    };
  }, [draft.supplierShippingCostUsd, products]);

  const summaryTotals = useMemo(() => {
    const merchandiseUsd = toUsd(totals.merchandise, draft.purchaseCurrencyId, bankRate);
    const merchandiseCordobas = toCordobas(totals.merchandise, draft.purchaseCurrencyId, bankRate);
    const shippingCordobas = bankRate === null ? null : totals.shipping * bankRate;
    return {
      merchandise: money(totals.merchandise, draft.purchaseCurrencyId === "1" ? "USD" : "C$"),
      shipping: money(totals.shipping, "USD"),
      totalUsd: money(merchandiseUsd === null ? null : merchandiseUsd + totals.shipping, "USD"),
      totalCordobas: money(merchandiseCordobas === null || shippingCordobas === null ? null : merchandiseCordobas + shippingCordobas, "C$"),
    };
  }, [bankRate, draft.purchaseCurrencyId, totals]);

  const updateDraft = (key: keyof OrderDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => current.filter((error) => error.path !== key));
  };

  const updateProduct = (productIndex: number, key: keyof ProductDraft, value: string) => {
    setProducts((current) => current.map((product, index) => index === productIndex ? { ...product, [key]: value } : product));
    setErrors((current) => current.filter((error) => !error.path.startsWith(`product-${productIndex}-${key}`)));
  };

  const updatePresentation = (productIndex: number, presentationIndex: number, value: string) => {
    setProducts((current) => current.map((product, index) => {
      if (index !== productIndex) return product;
      return {
        ...product,
        presentations: product.presentations.map((presentation, currentIndex) => currentIndex === presentationIndex ? { ...presentation, name: value } : presentation),
      };
    }));
  };

  const duplicatePresentationAt = (productIndex: number, presentationIndex: number) => {
    const presentationId = createPresentation().id;
    setProducts((current) => current.map((product, index) => {
      if (index !== productIndex) return product;
      const presentation = product.presentations[presentationIndex];
      if (!presentation) return product;
      return {
        ...product,
        presentations: [
          ...product.presentations.slice(0, presentationIndex + 1),
          duplicatePresentation(presentation, presentationId),
          ...product.presentations.slice(presentationIndex + 1),
        ],
      };
    }));
  };

  const updateVariant = (
    productIndex: number,
    presentationIndex: number,
    variantIndex: number,
    key: keyof VariantDraft,
    value: string,
  ) => {
    setProducts((current) => current.map((product, currentProductIndex) => {
      if (currentProductIndex !== productIndex) return product;
      return {
        ...product,
        presentations: product.presentations.map((presentation, currentPresentationIndex) => {
          if (currentPresentationIndex !== presentationIndex) return presentation;
          return {
            ...presentation,
            variants: presentation.variants.map((variant, currentVariantIndex) => currentVariantIndex === variantIndex ? { ...variant, [key]: value } : variant),
          };
        }),
      };
    }));
  };

  const validate = () => {
    const nextErrors: FieldError[] = [];
    if (!draft.purchaseDate) nextErrors.push({ path: "purchaseDate", message: "Selecciona una fecha." });
    if (!draft.supplierId) nextErrors.push({ path: "supplierId", message: "Selecciona un proveedor." });
    const shipping = Number(draft.supplierShippingCostUsd);
    if (!Number.isFinite(shipping) || shipping < 0) nextErrors.push({ path: "supplierShippingCostUsd", message: "Ingresa un costo válido." });
    if (!products.length) nextErrors.push({ path: "products", message: "Agrega al menos un producto." });

    products.forEach((product, productIndex) => {
      const productPath = `product-${productIndex}`;
      if (!product.supplierProductCode.trim()) nextErrors.push({ path: `${productPath}-supplierProductCode`, message: "Ingresa el código del proveedor." });
      if (!product.name.trim()) nextErrors.push({ path: `${productPath}-name`, message: "Ingresa el nombre del producto." });
      if (!product.subcategoryId) nextErrors.push({ path: `${productPath}-subcategoryId`, message: "Selecciona una subcategoría." });
      if (!product.presentations.length) nextErrors.push({ path: `${productPath}-presentations`, message: "Agrega al menos una presentación." });
      product.presentations.forEach((presentation, presentationIndex) => {
        const presentationName = presentation.name.trim();
        const presentationPath = `${productPath}-presentation-${presentationIndex}-name`;
        const hasDuplicateName = Boolean(presentationName) && product.presentations.some((candidate, candidateIndex) => (
          candidateIndex !== presentationIndex &&
          normalizeComparisonValue(candidate.name) === normalizeComparisonValue(presentationName)
        ));
        if (product.presentations.length > 1 && !presentationName) {
          nextErrors.push({ path: presentationPath, message: "Ingresa el nombre de la presentación." });
        }
        if (presentationName.length > 50) {
          nextErrors.push({ path: presentationPath, message: "El nombre de la presentación no puede tener más de 50 caracteres." });
        }
        if (hasDuplicateName) {
          nextErrors.push({ path: presentationPath, message: "El nombre de la presentación debe ser único dentro del producto." });
        }
        if (!presentation.variants.length) nextErrors.push({ path: `${productPath}-presentation-${presentationIndex}`, message: "Agrega al menos una talla." });
        const seenSizes = new Set<string>();
        presentation.variants.forEach((variant, variantIndex) => {
          const variantPath = `${productPath}-presentation-${presentationIndex}-variant-${variantIndex}`;
          const quantity = Number(variant.quantity);
          const unitCost = Number(variant.unitCost);
          if (!variant.sizeId) nextErrors.push({ path: `${variantPath}-sizeId`, message: "Selecciona una talla." });
          if (!Number.isInteger(quantity) || quantity <= 0) nextErrors.push({ path: `${variantPath}-quantity`, message: "Usa una cantidad entera mayor que cero." });
          if (!Number.isFinite(unitCost) || unitCost <= 0) nextErrors.push({ path: `${variantPath}-unitCost`, message: "Ingresa un costo mayor que cero." });
          if (seenSizes.has(variant.sizeId)) nextErrors.push({ path: `${variantPath}-sizeId`, message: "Esta talla está repetida en la presentación." });
          seenSizes.add(variant.sizeId);
        });
      });
    });
    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);
    const body = {
      purchaseDate: draft.purchaseDate,
      supplierId: Number(draft.supplierId),
      purchaseCurrencyId: Number(draft.purchaseCurrencyId),
      supplierShippingCostUsd: Number(draft.supplierShippingCostUsd),
      comments: draft.comments.trim() || null,
      products: products.map((product) => ({
        supplierProductCode: product.supplierProductCode.trim(),
        name: product.name.trim(),
        subcategoryId: Number(product.subcategoryId),
        presentations: product.presentations.map((presentation, presentationIndex) => ({
          name: presentation.name.trim() || null,
          sortOrder: presentationIndex,
          sizes: presentation.variants.map((variant) => ({
            sizeId: Number(variant.sizeId),
            quantity: Number(variant.quantity),
            unitCost: Number(variant.unitCost),
          })),
        })),
      })),
    };
    try {
      const response = await request("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await problemDetail(response, "No se pudo crear la orden de compra."));
      const orderId = await response.json() as number;
      showToast({ tone: "success", title: "Orden creada", detail: `La orden #${orderId} quedó registrada.` });
      navigate(`/purchases/orders/${orderId}`);
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo crear la orden", detail: error instanceof Error ? error.message : "Intenta nuevamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!catalog && !catalogError) return <LoadingState />;
  if (catalogError) return <ErrorState title="No pudimos preparar la orden" description={catalogError} onRetry={() => { setCatalog(null); setCatalogError(null); setRetryVersion((version) => version + 1); }} />;
  if (!catalog) return null;

  return (
    <form className="space-y-5" onSubmit={createOrder} noValidate>
      {errors.length ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert" aria-labelledby="order-errors-title">
          <h2 id="order-errors-title" className="font-extrabold">Revisa los datos de la compra</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.slice(0, 6).map((error) => <li key={`${error.path}-${error.message}`}>{error.message}</li>)}
          </ul>
        </section>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="order-data-title">
            <h2 id="order-data-title" className="text-xl font-extrabold">Datos de la orden</h2>
            <div className="mt-5 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
              <Field label="Proveedor" error={fieldError(errors, "supplierId")}>
                <SelectControl
                  aria-label="Proveedor"
                  id="purchase-order-supplier"
                  value={draft.supplierId}
                  options={[
                    { value: "", label: "Selecciona un proveedor" },
                    ...catalog.suppliers
                      .filter((supplier) => supplier.enabled)
                      .map((supplier) => ({ value: String(supplier.id), label: supplier.name })),
                  ]}
                  searchable
                  searchPlaceholder="Buscar proveedor…"
                  onChange={(event) => updateDraft("supplierId", event.target.value)}
                />
              </Field>
              <Field label="Fecha de compra" error={fieldError(errors, "purchaseDate")}>
                <input aria-label="Fecha de compra" className={inputClass(fieldError(errors, "purchaseDate"))} type="date" value={draft.purchaseDate} onChange={(event) => updateDraft("purchaseDate", event.target.value)} />
              </Field>
              <Field label="Moneda de compra">
                <SelectControl
                  aria-label="Moneda de compra"
                  id="purchase-order-currency"
                  value={draft.purchaseCurrencyId}
                  options={[
                    { value: "1", label: "USD" },
                    { value: "2", label: "C$ — compra local" },
                  ]}
                  onChange={(event) => updateDraft("purchaseCurrencyId", event.target.value)}
                />
              </Field>
              <div className="grid min-w-0 gap-1.5 text-sm font-medium text-pw-ink">
                <span>Tasa de cambio</span>
                <input
                  aria-label="Tasa de cambio"
                  className={`${inputClass()} cursor-default bg-pw-canvas text-pw-muted`}
                  readOnly
                  value={exchangeRateStatus === "ready" && bankRate !== null ? formatExchangeRate(bankRate) : "—"}
                />
                {exchangeRateStatus === "error" ? <div className="flex items-start justify-between gap-2">
                  <small className="font-normal text-red-700" role="alert">{exchangeRateError ?? "No se pudo cargar la tasa de cambio."}</small>
                  <button className="shrink-0 text-xs font-semibold text-pw-brand-deep underline underline-offset-2 hover:text-pw-brand" type="button" onClick={() => void refreshExchangeRate()}>
                    Reintentar
                  </button>
                </div> : null}
              </div>
              <Field label="Envío proveedor (USD)" error={fieldError(errors, "supplierShippingCostUsd")}>
                <CurrencyInput prefix="$" formatOnBlur aria-label="Envío proveedor a bodega" error={fieldError(errors, "supplierShippingCostUsd")} inputMode="decimal" min="0" step="0.01" value={draft.supplierShippingCostUsd} onChange={(event) => updateDraft("supplierShippingCostUsd", event.target.value)} />
              </Field>
              <Field label="Comentario interno (opcional)" className="sm:col-span-2 xl:col-span-5">
                <textarea aria-label="Comentario interno" className={`${inputClass()} min-h-16 py-2.5`} maxLength={280} placeholder="Ej. Compra colección agosto" value={draft.comments} onChange={(event) => updateDraft("comments", event.target.value)} />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="products-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 id="products-title" className="text-xl font-extrabold">Productos de la orden</h2></div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button ref={csvTriggerRef} className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep" type="button" onClick={openCsvImporter}>Importar CSV</button>
                <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep" type="button" onClick={addProduct}>+ Agregar producto</button>
              </div>
            </div>
            {isCsvModalOpen ? <CsvImportDialog csvDelimiter={csvDelimiter} isDragging={isDraggingCsv} inputRef={csvInputRef} returnFocusRef={csvTriggerRef} preview={csvImport} onApply={applyCsvImport} onCancel={closeCsvImporter} onDelimiterChange={updateCsvDelimiter} onDragEnter={() => setIsDraggingCsv(true)} onDragLeave={() => setIsDraggingCsv(false)} onDrop={handleCsvDrop} onFileChange={handleCsvFileChange} onDownloadTemplate={downloadCsvTemplate} onBrowse={() => csvInputRef.current?.click()} /> : null}
            {!products.length ? (
              <div className="mt-5 grid min-h-40 place-items-center rounded-lg border border-dashed border-pw-line bg-pw-canvas p-6 text-center">
                <div><strong className="block">Agrega el primer producto</strong><p className="mt-1 text-sm text-pw-muted">Captura sus presentaciones, tallas, cantidades y costos.</p><button className="mt-4 min-h-10 rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold hover:bg-pw-brand-soft" type="button" onClick={() => setProducts([createProduct()])}>Agregar producto</button></div>
              </div>
            ) : null}
            <div className="mt-5 space-y-5">
              {products.map((product, productIndex) => {
                const isCollapsed = collapsedProductIds.has(product.id);
                const productLabel = product.name.trim() || product.supplierProductCode.trim() || "Producto sin nombre";
                const detailsId = `purchase-order-product-${product.id}-details`;
                return (
                <article className="rounded-lg border border-pw-line p-4" key={product.id}>
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left hover:bg-pw-brand-soft"
                      type="button"
                      aria-expanded={!isCollapsed}
                      aria-controls={detailsId}
                      aria-label={`${isCollapsed ? "Expandir" : "Contraer"} producto ${productIndex + 1}`}
                      onClick={() => toggleProduct(product.id)}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-pw-line bg-white text-pw-muted transition group-hover:border-pw-brand group-hover:text-pw-brand-deep" aria-hidden="true">
                        <ChevronIcon collapsed={isCollapsed} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-extrabold uppercase tracking-[0.12em] text-pw-muted">Producto {productIndex + 1}</span>
                        <span className="block truncate text-base font-extrabold text-pw-ink">{productLabel}</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button className="h-9 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep" type="button" onClick={() => addPresentationAt(productIndex)}>+ Agregar presentación</button>
                      <button className="grid h-9 w-9 place-items-center rounded-lg border border-pw-line bg-white text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep" type="button" title="Duplicar producto" aria-label={`Duplicar producto ${productIndex + 1}`} onClick={() => duplicateProductAt(product.id)}>
                        <DuplicateIcon />
                      </button>
                      <button className="grid h-9 w-9 place-items-center rounded-lg border border-pw-line bg-white text-pw-muted hover:bg-red-50 hover:text-red-700" type="button" title="Eliminar producto" aria-label={`Eliminar producto ${productIndex + 1}`} disabled={products.length === 1} onClick={() => removeProduct(product.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </header>
                  {!isCollapsed ? <div id={detailsId} className="mt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Código proveedor" error={fieldError(errors, `product-${productIndex}-supplierProductCode`)}><input aria-label={`Código proveedor del producto ${productIndex + 1}`} className={inputClass(fieldError(errors, `product-${productIndex}-supplierProductCode`))} maxLength={50} value={product.supplierProductCode} onChange={(event) => updateProduct(productIndex, "supplierProductCode", event.target.value)} /></Field>
                    <Field label="Nombre" error={fieldError(errors, `product-${productIndex}-name`)}><input aria-label={`Nombre del producto ${productIndex + 1}`} className={inputClass(fieldError(errors, `product-${productIndex}-name`))} maxLength={120} value={product.name} onChange={(event) => updateProduct(productIndex, "name", event.target.value)} /></Field>
                    <Field label="Subcategoría" error={fieldError(errors, `product-${productIndex}-subcategoryId`)}>
                      <SelectControl
                        aria-label={`Subcategoría del producto ${productIndex + 1}`}
                        id={`purchase-order-product-${productIndex}-subcategory`}
                        value={product.subcategoryId}
                        options={[
                          { value: "", label: "Selecciona una subcategoría" },
                          ...catalog.subcategories.map((subcategory) => ({ value: String(subcategory.id), label: subcategory.name })),
                        ]}
                        searchable
                        searchPlaceholder="Buscar subcategoría…"
                        onChange={(event) => updateProduct(productIndex, "subcategoryId", event.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="mt-5 space-y-4">
                    {product.presentations.map((presentation, presentationIndex) => <PresentationEditor key={`presentation-${presentation.id}`} catalog={catalog} errors={errors} productIndex={productIndex} presentation={presentation} presentationIndex={presentationIndex} purchaseCurrencyId={draft.purchaseCurrencyId} bankRate={bankRate} exchangeRateStatus={exchangeRateStatus} isCollapsed={collapsedPresentationIds.has(presentation.id)} onToggle={() => togglePresentation(presentation.id)} onPresentationChange={updatePresentation} onVariantChange={updateVariant} onRemove={() => removePresentationAt(productIndex, presentation.id)} onDuplicatePresentation={() => duplicatePresentationAt(productIndex, presentationIndex)} onAddVariant={() => setProducts((current) => current.map((item, index) => index === productIndex ? { ...item, presentations: item.presentations.map((itemPresentation, currentIndex) => currentIndex === presentationIndex ? { ...itemPresentation, variants: [...itemPresentation.variants, emptyVariant()] } : itemPresentation) } : item))} onDuplicateVariant={(variantIndex) => setProducts((current) => current.map((item, index) => index === productIndex ? { ...item, presentations: item.presentations.map((itemPresentation, currentIndex) => {
                      if (currentIndex !== presentationIndex) return itemPresentation;
                      const variant = itemPresentation.variants[variantIndex];
                      if (!variant) return itemPresentation;
                      return { ...itemPresentation, variants: [...itemPresentation.variants.slice(0, variantIndex + 1), { ...variant }, ...itemPresentation.variants.slice(variantIndex + 1)] };
                    }) } : item))} onRemoveVariant={(variantIndex) => setProducts((current) => current.map((item, index) => index === productIndex ? { ...item, presentations: item.presentations.map((itemPresentation, currentIndex) => currentIndex === presentationIndex ? { ...itemPresentation, variants: itemPresentation.variants.filter((_, currentVariantIndex) => currentVariantIndex !== variantIndex) } : itemPresentation) } : item))} />)}
                  </div>
                  </div> : null}
                </article>
                );
              })}
            </div>
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
            <SummaryRow label="Total compra" value={<span className="grid justify-items-end gap-1"><span>{summaryTotals.totalUsd}</span><span>{summaryTotals.totalCordobas}</span></span>} emphasized />
          </dl>
          <LoadingButton className="mt-5 w-full" isLoading={isSubmitting} type="submit">{isSubmitting ? "Creando orden…" : "Crear orden"}</LoadingButton>
        </aside>
      </div>
    </form>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={collapsed ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} />
  </svg>;
}

function CsvImportDialog({
  csvDelimiter,
  isDragging,
  inputRef,
  returnFocusRef,
  preview,
  onApply,
  onCancel,
  onDelimiterChange,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFileChange,
  onDownloadTemplate,
  onBrowse,
}: {
  csvDelimiter: PurchaseOrderCsvDelimiter;
  isDragging: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  preview: CsvImportPreview | null;
  onApply: () => void;
  onCancel: () => void;
  onDelimiterChange: (delimiter: PurchaseOrderCsvDelimiter) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
  onBrowse: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const productSummary = preview
    ? `${preview.products.length} producto${preview.products.length === 1 ? "" : "s"} listo${preview.products.length === 1 ? "" : "s"} para importar`
    : null;

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const restoreTarget = returnFocusRef.current;
    firstFocusableRef.current?.focus();

    const getFocusableElements = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []);

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      (restoreTarget ?? previousActiveElement)?.focus();
    };
  }, [returnFocusRef]);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-pw-ink/40 p-4" role="presentation">
    <div ref={dialogRef} className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-pw-line bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 id="csv-import-title" className="text-xl font-extrabold text-pw-ink">Importar productos desde CSV</h2>
          <p className="mt-1 text-sm text-pw-muted">Carga varias líneas de productos y sus tallas en una sola operación.</p>
        </div>
        <button ref={firstFocusableRef} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-lg text-pw-muted hover:bg-pw-brand-soft hover:text-pw-ink" type="button" aria-label="Cerrar importación CSV" onClick={onCancel}>×</button>
      </header>

      <fieldset className="mt-5 grid gap-2">
        <legend className="text-sm font-semibold text-pw-ink">Separador del CSV</legend>
        <div className="flex flex-wrap gap-3">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-pw-line px-3 text-sm text-pw-ink hover:bg-pw-brand-soft">
            <input type="radio" name="csv-delimiter" checked={csvDelimiter === ","} onChange={() => onDelimiterChange(",")} />
            Coma (,)
          </label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-pw-line px-3 text-sm text-pw-ink hover:bg-pw-brand-soft">
            <input type="radio" name="csv-delimiter" checked={csvDelimiter === ";"} onChange={() => onDelimiterChange(";")} />
            Punto y coma (;)
          </label>
        </div>
      </fieldset>

      <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" aria-label="Archivo CSV de productos" onChange={onFileChange} />
      <div
        className={`mt-5 grid min-h-36 cursor-pointer place-items-center rounded-xl border-2 border-dashed p-6 text-center transition ${isDragging ? "border-pw-brand bg-pw-brand-soft" : "border-pw-line bg-pw-canvas hover:border-pw-brand hover:bg-pw-brand-soft"}`}
        role="button"
        tabIndex={0}
        aria-label="Zona para soltar el archivo CSV"
        onClick={onBrowse}
        onDragOver={(event) => { event.preventDefault(); onDragEnter(); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) onDragLeave(); }}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onBrowse();
          }
        }}
      >
        <div>
          <strong className="block text-base text-pw-ink">Arrastra tu archivo CSV aquí</strong>
          <span className="mt-1 block text-sm text-pw-muted">o selecciona un archivo desde tu equipo</span>
          <span className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted">Seleccionar archivo</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-pw-muted">Usa el mismo separador al editar o guardar tu archivo.</p>
        <button className="min-h-10 shrink-0 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep" type="button" onClick={onDownloadTemplate}>Descargar plantilla</button>
      </div>

      {preview ? <>
        <div className="mt-5 rounded-lg border border-pw-line bg-pw-canvas p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-pw-ink">Vista previa de importación</h3>
              <p className="mt-1 text-sm text-pw-muted">{preview.fileName}</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" role="status">
              <span className="font-semibold text-pw-ink">{productSummary}</span>
              <span className="text-pw-muted">{preview.validRowCount} de {preview.rowCount} filas válidas</span>
            </div>
          </div>
          {preview.errors.length ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
            <p className="font-semibold">Corrige estas filas para continuar:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{preview.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>
          </div> : <div className="mt-3 space-y-1 text-sm text-pw-muted">
            {preview.products.map((product) => <p key={`${product.supplierProductCode}-${product.name}`}><span className="font-semibold text-pw-ink">{product.name}</span> · {product.presentations.reduce((total, presentation) => total + presentation.variants.length, 0)} talla{product.presentations.reduce((total, presentation) => total + presentation.variants.length, 0) === 1 ? "" : "s"}</p>)}
          </div>}
        </div>
      </> : <p className="mt-4 text-center text-sm text-pw-muted">Selecciona o arrastra un archivo CSV para ver una vista previa.</p>}

      <footer className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="min-h-10 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-ink" type="button" onClick={onCancel}>Cancelar</button>
        <button className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!preview || preview.errors.length > 0 || !preview.products.length} onClick={onApply}>Aplicar importación</button>
      </footer>
    </div>
  </div>;
}

function DuplicateIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>;
}

function TrashIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>;
}

export function PresentationEditor({
  catalog, errors, productIndex, presentation, presentationIndex, purchaseCurrencyId, bankRate, exchangeRateStatus, isCollapsed, onToggle, onPresentationChange, onVariantChange, onRemove, onDuplicatePresentation, onAddVariant, onDuplicateVariant, onRemoveVariant,
}: {
  catalog: CatalogState;
  errors: FieldError[];
  productIndex: number;
  presentation: PresentationDraft;
  presentationIndex: number;
  purchaseCurrencyId: string;
  bankRate: number | null;
  exchangeRateStatus: "idle" | "loading" | "ready" | "error";
  isCollapsed: boolean;
  onToggle: () => void;
  onPresentationChange: (productIndex: number, presentationIndex: number, value: string) => void;
  onVariantChange: (productIndex: number, presentationIndex: number, variantIndex: number, key: keyof VariantDraft, value: string) => void;
  onRemove: () => void;
  onDuplicatePresentation: () => void;
  onAddVariant: () => void;
  onDuplicateVariant: (variantIndex: number) => void;
  onRemoveVariant: (variantIndex: number) => void;
}) {
  const presentationDetailsId = `presentation-${presentation.id}-details`;
  const presentationHeadingId = `presentation-${presentation.id}`;

  return <section className="rounded-lg bg-pw-canvas p-4" aria-labelledby={presentationHeadingId}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-end gap-2">
        <button className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-pw-line bg-white text-pw-muted hover:border-pw-brand hover:text-pw-brand-deep" type="button" aria-expanded={!isCollapsed} aria-controls={presentationDetailsId} aria-label={`${isCollapsed ? "Expandir" : "Contraer"} presentación ${presentationIndex + 1} del producto ${productIndex + 1}`} onClick={onToggle}>
          <ChevronIcon collapsed={isCollapsed} />
        </button>
        <Field label={`Presentación ${presentationIndex + 1}`} error={fieldError(errors, `product-${productIndex}-presentation-${presentationIndex}-name`)} className="w-full min-w-0 sm:max-w-md"><input aria-label={`Presentación ${presentationIndex + 1} del producto ${productIndex + 1}`} className={inputClass(fieldError(errors, `product-${productIndex}-presentation-${presentationIndex}-name`))} maxLength={50} placeholder="Ej. Azul" value={presentation.name} onChange={(event) => onPresentationChange(productIndex, presentationIndex, event.target.value)} /></Field>
      </div>
      <div className="flex shrink-0 items-center gap-1"><button className="h-11 min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-semibold text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep" type="button" onClick={onAddVariant}>+ Agregar talla</button><button className="grid h-11 w-11 place-items-center rounded-lg border border-pw-line bg-white text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep" type="button" title="Duplicar presentación" aria-label={`Duplicar presentación ${presentationIndex + 1}`} onClick={onDuplicatePresentation}><DuplicateIcon /></button><button className="grid h-11 w-11 place-items-center rounded-lg border border-pw-line bg-white text-pw-muted hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50" type="button" title="Eliminar presentación" aria-label={`Eliminar presentación ${presentationIndex + 1}`} disabled={presentationIndex === 0} onClick={onRemove}><TrashIcon /></button></div>
    </div>
    <h4 id={`presentation-${productIndex}-${presentationIndex}`} className="sr-only">Tallas de la presentación {presentationIndex + 1}</h4>
    {!isCollapsed ? <div id={presentationDetailsId} className="mt-4 space-y-3">
      {presentation.variants.map((variant, variantIndex) => {
        const path = `product-${productIndex}-presentation-${presentationIndex}-variant-${variantIndex}`;
        return <div className="grid gap-3 rounded-lg border border-pw-line bg-white p-3 sm:grid-cols-2 xl:grid-cols-[1.1fr_.8fr_1fr_1fr_auto]" key={`variant-${variantIndex}`}>
          <Field label="Talla" error={fieldError(errors, `${path}-sizeId`)}>
            <SelectControl
              aria-label={`Talla ${variantIndex + 1} de la presentación ${presentationIndex + 1} del producto ${productIndex + 1}`}
              id={`${path}-sizeId`}
              value={variant.sizeId}
              options={[
                { value: "", label: "Selecciona" },
                ...catalog.sizes.map((size) => ({ value: String(size.id), label: size.name })),
              ]}
              searchable
              searchPlaceholder="Buscar talla…"
              onChange={(event) => onVariantChange(productIndex, presentationIndex, variantIndex, "sizeId", event.target.value)}
            />
          </Field>
          <Field label="Cantidad" error={fieldError(errors, `${path}-quantity`)}><input aria-label={`Cantidad ${variantIndex + 1} de la presentación ${presentationIndex + 1} del producto ${productIndex + 1}`} className={inputClass(fieldError(errors, `${path}-quantity`))} type="number" min="1" step="1" value={variant.quantity} onChange={(event) => onVariantChange(productIndex, presentationIndex, variantIndex, "quantity", event.target.value)} /></Field>
          <Field label="Costo unitario" error={fieldError(errors, `${path}-unitCost`)}><CurrencyInput prefix={purchaseCurrencyId === "2" ? "C$" : "$"} formatOnBlur aria-label={`Costo unitario ${variantIndex + 1} de la presentación ${presentationIndex + 1} del producto ${productIndex + 1}`} error={fieldError(errors, `${path}-unitCost`)} inputMode="decimal" min="0" step="0.01" value={variant.unitCost} onChange={(event) => onVariantChange(productIndex, presentationIndex, variantIndex, "unitCost", event.target.value)} /></Field>
          <Field label="Monto en C$"><CurrencyInput prefix="C$" aria-label={`Monto en C$ ${variantIndex + 1} de la presentación ${presentationIndex + 1} del producto ${productIndex + 1}`} readOnly value={lineCostEquivalent(variant.unitCost, purchaseCurrencyId, bankRate, exchangeRateStatus)} /></Field>
          <div className="flex items-end gap-1">
            <button className="grid h-11 w-11 place-items-center rounded-lg border border-pw-line bg-white text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep" type="button" title="Duplicar talla" aria-label={`Duplicar talla ${variantIndex + 1} de la presentación ${presentationIndex + 1} del producto ${productIndex + 1}`} onClick={() => onDuplicateVariant(variantIndex)}>
              <DuplicateIcon />
            </button>
            <button className="grid h-11 w-11 place-items-center rounded-lg border border-pw-line bg-white text-pw-muted hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50" type="button" title="Eliminar talla" aria-label={`Eliminar talla ${variantIndex + 1} de la presentación ${presentationIndex + 1} del producto ${productIndex + 1}`} disabled={presentation.variants.length === 1} onClick={() => onRemoveVariant(variantIndex)}>
              <TrashIcon />
            </button>
          </div>
        </div>;
      })}
    </div> : null}
  </section>;
}

function Field({ label, error, className = "", children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <label className={`grid min-w-0 gap-1.5 text-sm font-medium text-pw-ink ${className}`}>{label}{children}{error ? <small className="font-normal text-red-700" role="alert">{error}</small> : null}</label>;
}

function CurrencyInput({ prefix, error, readOnly = false, formatOnBlur = false, className = "", onBlur, onChange, onFocus, ...props }: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputValue = props.value === undefined || props.value === null ? "" : String(props.value);
  const rawValue = formatOnBlur ? inputValue.replace(/,/g, "") : inputValue;
  const displayValue = formatOnBlur && !isFocused ? formatEditableAmount(rawValue) : rawValue;

  return <div className="relative">
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-pw-muted">{prefix}</span>
    <input
      {...props}
      type={formatOnBlur ? "text" : props.type}
      inputMode={formatOnBlur ? "decimal" : props.inputMode}
      value={displayValue}
      readOnly={readOnly}
      onFocus={(event) => { setIsFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setIsFocused(false); onBlur?.(event); }}
      onChange={(event) => {
        if (formatOnBlur) event.currentTarget.value = event.currentTarget.value.replace(/,/g, "");
        onChange?.(event);
      }}
      className={`${inputClass(error)} pl-10 ${readOnly ? "cursor-default bg-pw-canvas text-pw-muted" : ""} ${className}`}
    />
  </div>;
}

type CurrencyInputProps = InputHTMLAttributes<HTMLInputElement> & {
  prefix: string;
  error?: string;
  formatOnBlur?: boolean;
};

function SummaryRow({ label, value, emphasized = false }: { label: string; value: React.ReactNode; emphasized?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 py-3 ${emphasized ? "border-t border-pw-line pt-4" : ""}`}><dt className="text-sm text-pw-muted">{label}</dt><dd className={emphasized ? "text-lg font-extrabold" : "font-bold"}>{value}</dd></div>;
}

function toUsd(amount: number, purchaseCurrencyId: string, bankRate: number | null) {
  if (purchaseCurrencyId === "1") return amount;
  return bankRate === null ? null : amount / bankRate;
}

function toCordobas(amount: number, purchaseCurrencyId: string, bankRate: number | null) {
  if (purchaseCurrencyId === "2") return amount;
  return bankRate === null ? null : convertToCordobas(amount, purchaseCurrencyId, bankRate);
}

function lineCostEquivalent(
  value: string,
  purchaseCurrencyId: string,
  bankRate: number | null,
  exchangeRateStatus: "idle" | "loading" | "ready" | "error",
) {
  const amount = lineCostInCordobas(value, purchaseCurrencyId, bankRate, exchangeRateStatus);
  if (amount === null) {
    return "—";
  }

  return formatCurrencyInputValue(amount);
}

function lineCostInCordobas(
  value: string,
  purchaseCurrencyId: string,
  bankRate: number | null,
  exchangeRateStatus: "idle" | "loading" | "ready" | "error",
) {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount)) {
    return null;
  }

  if (purchaseCurrencyId === "2") return amount;
  if (exchangeRateStatus !== "ready" || bankRate === null) return null;

  return convertToCordobas(amount, purchaseCurrencyId, bankRate);
}

function normalizeComparisonValue(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

function formatCurrencyInputValue(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatEditableAmount(value: string) {
  if (!value.trim()) return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? formatCurrencyInputValue(amount) : value;
}

function formatExchangeRate(value: number) {
  return "C$ " + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " por $1";
}

function money(value: number | null, currency: "USD" | "C$") {
  if (value === null) return "—";
  return (currency === "USD" ? "$" : "C$") + " " + formatCurrencyInputValue(value);
}
