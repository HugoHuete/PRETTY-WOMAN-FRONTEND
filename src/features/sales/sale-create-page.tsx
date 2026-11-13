import { saleDateForApi, todayInManagua } from "./sale-date";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { useToast } from "../../shared/ui/toast-context";
import { LoadingButton } from "../../shared/ui/loading-button";
import { SelectControl } from "../../shared/ui/select-control";
import { useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import { SaleClientCreateDialog } from "./sale-client-create-dialog";
import { SaleDeliveryCreateDialog } from "./sale-delivery-create-dialog";
import { SaleClientPicker } from "./sale-client-picker";
import { SaleGlobalDiscountDialog } from "./sale-global-discount-dialog";
import { SaleInitialPayment } from "./sale-initial-payment";
import { SaleProductLines } from "./sale-product-lines";
import { SaleProductPicker } from "./sale-product-picker";
import { createSale, getSalePaymentTerminals, getSaleMunicipalities, getSaleDeliveryAgencies } from "./sales-api";
import type { ProductVariantDTO } from "../products/product-types";
import {
  discountSourceIds,
  saleChannels,
  type CreateSalePaymentPayload,
  type CreateSaleDeliveryPayload,
  type SaleMunicipality,
  type SaleDeliveryAgency,
  type SaleCatalogOption,
  type SaleClient,
} from "./sales-types";
import {
  calculateManualDiscountAmount,
  type SaleDraftLine,
  type SaleManualDiscountType,
  type SaleVariantOption,
} from "./sale-product-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });

function lineFrom(option: SaleVariantOption): SaleDraftLine {
  const { variant } = option;
  const hasCampaignDiscount =
    variant.discountedSalePrice !== null &&
    variant.discountCampaignId !== null &&
    variant.discountedSalePrice < variant.salePrice;
  const campaignDiscountAmount = hasCampaignDiscount
    ? Math.max(0, variant.salePrice - (variant.discountedSalePrice ?? variant.salePrice))
    : 0;

  return {
    productVariantId: variant.id,
    productName: option.product.name,
    productCode: option.product.code,
    presentationName: option.presentationName,
    imageUrl: option.imageUrl,
    presentationVariants: option.presentationVariants,
    sizeName: variant.sizeName,
    availableQuantity: variant.availableQuantity,
    quantity: 1,
    forSelection: false,
    unitPrice: variant.salePrice,
    campaignDiscountAmount,
    discountAmount: campaignDiscountAmount,
    discountSourceId: hasCampaignDiscount ? discountSourceIds.campaign : discountSourceIds.none,
    discountCampaignId: hasCampaignDiscount ? variant.discountCampaignId : null,
    campaignId: hasCampaignDiscount ? variant.discountCampaignId : null,
  };
}

export function SaleCreatePage() {
  const { request } = useAuth();
  const { setHeading } = usePageActions();
  const { showToast } = useToast();
  const { storeRate } = useExchangeRate();
  const navigate = useNavigate();

  const [saleDate, setSaleDate] = useState(() => todayInManagua());
  const [channel, setChannel] = useState("1");
  const [saleStatusId, setSaleStatusId] = useState<1 | 2>(1);
  const [delivery, setDelivery] = useState<CreateSaleDeliveryPayload | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [municipalities, setMunicipalities] = useState<SaleMunicipality[]>([]);
  const [agencies, setAgencies] = useState<SaleDeliveryAgency[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliveryRetry, setDeliveryRetry] = useState(0);
  const [client, setClient] = useState<SaleClient | null>(null);
  const [lines, setLines] = useState<SaleDraftLine[]>([]);
  const [comments, setComments] = useState("");
  const [payments, setPayments] = useState<CreateSalePaymentPayload[]>([]);
  const [terminals, setTerminals] = useState<SaleCatalogOption[]>([]);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [terminalLoading, setTerminalLoading] = useState(true);
  const [terminalRetry, setTerminalRetry] = useState(0);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [globalDiscountOpen, setGlobalDiscountOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorSection, setErrorSection] = useState<"products" | "payment" | "form">("form");
  useEffect(() => {
    if (!deliveryOpen) return undefined;
    let active = true;
    setDeliveryLoading(true);
    setDeliveryError(null);
    void Promise.all([getSaleMunicipalities(request), getSaleDeliveryAgencies(request)])
      .then(([nextMunicipalities, nextAgencies]) => { if (active) { setMunicipalities(nextMunicipalities); setAgencies(nextAgencies); } })
      .catch(() => { if (active) setDeliveryError("No se pudieron cargar los municipios y agencias."); })
      .finally(() => { if (active) setDeliveryLoading(false); });
    return () => { active = false; };
  }, [deliveryOpen, deliveryRetry, request]);

  const handlePaymentsChange = useCallback((nextPayments: CreateSalePaymentPayload[]) => {
    setPayments(nextPayments);
    if (errorSection === "payment") setError(null);
  }, [errorSection]);

  const itemCount = useMemo(
    () => lines.filter((line) => !line.forSelection).reduce((count, line) => count + line.quantity, 0),
    [lines],
  );
  const selectionCount = useMemo(
    () => lines.filter((line) => line.forSelection).reduce((count, line) => count + line.quantity, 0),
    [lines],
  );
  const saleLines = useMemo(() => lines.filter((line) => !line.forSelection), [lines]);
  const grossSubtotal = useMemo(
    () => saleLines.reduce((amount, line) => amount + line.unitPrice * line.quantity, 0),
    [saleLines],
  );
  const campaignDiscount = useMemo(
    () => saleLines.reduce(
      (total, line) => line.discountSourceId === discountSourceIds.campaign
        ? total + line.discountAmount * line.quantity
        : total,
      0,
    ),
    [saleLines],
  );
  const manualDiscount = useMemo(
    () => saleLines.reduce(
      (total, line) => line.discountSourceId === discountSourceIds.manual
        ? total + line.discountAmount * line.quantity
        : total,
      0,
    ),
    [saleLines],
  );
  const total = useMemo(
    () => Math.max(0, grossSubtotal - saleLines.reduce((amount, line) => amount + line.discountAmount * line.quantity, 0)),
    [grossSubtotal, saleLines],
  );
  const appliedPayment = useMemo(
    () => payments.reduce((amount, payment) => amount + payment.productAmount, 0),
    [payments],
  );
  const appliedShipping = payments.reduce((amount, payment) => amount + payment.shippingAmount, 0);
  const balance = Math.max(0, total - appliedPayment);

  useEffect(() => {
    setHeading({
      title: "Nueva venta",
      breadcrumbs: (
        <Link to="/sales" className="underline underline-offset-4 hover:text-pw-brand-deep">
          ← Ventas
        </Link>
      ),
    });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    let active = true;
    setTerminalLoading(true);
    setTerminalError(null);
    void getSalePaymentTerminals(request)
      .then((result) => {
        if (active) setTerminals(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setTerminalError(caught instanceof Error ? caught.message : "No se pudieron cargar las terminales.");
        }
      })
      .finally(() => {
        if (active) setTerminalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, terminalRetry]);

  const addProduct = (option: SaleVariantOption) => {
    setLines((current) => current.some((line) => line.productVariantId === option.variant.id)
      ? current
      : [...current, lineFrom(option)]);
    setError(null);
  };

  const applyGlobalDiscount = (
    type: SaleManualDiscountType,
    value: number,
    discounts: Map<number, number>,
  ) => {
    setLines((current) => current.map((line) => {
      if (line.forSelection || !discounts.has(line.productVariantId)) return line;

      const discountAmount = discounts.get(line.productVariantId) ?? 0;
      const manualDiscountValue = type === "percent"
        ? value
        : type === "amount" ? discountAmount : line.unitPrice - discountAmount;
      return {
        ...line,
        discountAmount,
        discountSourceId: discountAmount > 0 ? discountSourceIds.manual : discountSourceIds.none,
        discountCampaignId: null,
        campaignId: null,
        campaignDiscountAmount: 0,
        manualDiscountType: discountAmount > 0 ? type : null,
        manualDiscountValue: discountAmount > 0 ? manualDiscountValue : null,
      };
    }));
    setGlobalDiscountOpen(false);
    setError(null);
  };

  const clearCurrentDiscounts = () => {
    setLines((current) => current.map((line) => {
      if (line.forSelection) return line;
      return {
        ...line,
        discountAmount: 0,
        discountSourceId: discountSourceIds.none,
        discountCampaignId: null,
        campaignId: null,
        campaignDiscountAmount: 0,
        manualDiscountType: null,
        manualDiscountValue: null,
      };
    }));
    setGlobalDiscountOpen(false);
    setError(null);
  };

  const changeProductVariant = (currentVariantId: number, variant: ProductVariantDTO) => {
    setLines((current) => {
      if (current.some((line) => line.productVariantId !== currentVariantId && line.productVariantId === variant.id)) return current;

      return current.map((line) => {
        if (line.productVariantId !== currentVariantId) return line;

        const hasCampaignDiscount =
          variant.discountedSalePrice !== null &&
          variant.discountCampaignId !== null &&
          variant.discountedSalePrice < variant.salePrice;
        const campaignDiscountAmount = hasCampaignDiscount
          ? variant.salePrice - (variant.discountedSalePrice ?? variant.salePrice)
          : 0;
        const manualDiscount = line.discountSourceId === discountSourceIds.manual;
        const manualDiscountValue = manualDiscount && line.manualDiscountValue !== null && line.manualDiscountValue !== undefined
          ? line.manualDiscountType === "percent"
            ? line.manualDiscountValue
            : Math.min(line.manualDiscountValue, variant.salePrice)
          : null;
        const discountAmount = manualDiscount
          ? Math.min(
            variant.salePrice,
            line.manualDiscountType && manualDiscountValue !== null
              ? calculateManualDiscountAmount(line.manualDiscountType, manualDiscountValue, variant.salePrice)
              : line.discountAmount,
          )
          : campaignDiscountAmount;
        const discountSourceId = manualDiscount && discountAmount > 0
          ? discountSourceIds.manual
          : (hasCampaignDiscount ? discountSourceIds.campaign : discountSourceIds.none);

        return {
          ...line,
          productVariantId: variant.id,
          sizeName: variant.sizeName,
          availableQuantity: variant.availableQuantity,
          quantity: Math.min(line.quantity, variant.availableQuantity),
          unitPrice: variant.salePrice,
          campaignDiscountAmount,
          discountAmount,
          discountSourceId,
          manualDiscountType: discountSourceId === discountSourceIds.manual ? line.manualDiscountType : null,
          manualDiscountValue: discountSourceId === discountSourceIds.manual ? manualDiscountValue : null,
          discountCampaignId: discountSourceId === discountSourceIds.campaign ? variant.discountCampaignId : null,
          campaignId: hasCampaignDiscount ? variant.discountCampaignId : null,
        };
      });
    });
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setErrorSection("form");

    const saleDateValue = saleDateForApi(saleDate);
    if (!saleDateValue) {
      setError("Ingresa una fecha de venta válida.");
      return;
    }
    if (!channel) {
      setError("Selecciona el canal por el que se realizó la venta.");
      return;
    }
    if (delivery && channel === "1") {
      setError("Selecciona un canal de venta con envío o elimina el envío.");
      return;
    }
    if (!lines.length) {
      setError("Agrega al menos una prenda a la venta.");
      setErrorSection("products");
      return;
    }
    if (channel === "1" && selectionCount > 0) {
      setError("La selección de prendas está disponible solo para ventas fuera de tienda física. Cambia el canal o desmarca las prendas para selección.");
      setErrorSection("products");
      return;
    }
    if (saleStatusId === 2 && channel === "1" && appliedPayment >= total) {
      setError("Una venta de tienda física se completa al pagar el total. Para dejar un pedido totalmente pagado pendiente de retiro, usa el canal donde se confirmó la compra.");
      return;
    }

    const invalidLine = lines.find((line) =>
      line.quantity > line.availableQuantity ||
      line.discountAmount > line.unitPrice ||
      (line.discountAmount > 0 && (
        (line.discountSourceId === discountSourceIds.campaign && !line.discountCampaignId) ||
        (line.discountSourceId === discountSourceIds.manual && line.discountCampaignId !== null) ||
        (line.discountSourceId !== discountSourceIds.campaign && line.discountSourceId !== discountSourceIds.manual)
      )) ||
      (line.discountAmount === 0 && (
        line.discountSourceId !== discountSourceIds.none || line.discountCampaignId !== null
      )),
    );
    if (invalidLine) {
      setError("Revisa la cantidad y el descuento de las prendas agregadas.");
      setErrorSection("products");
      return;
    }
    const firstPayment = payments[0];
    const hasPaymentAmount = payments.some((payment) => payment.amountReceivedNio > 0 || payment.amountReceivedUsd > 0);
    if (hasPaymentAmount && (!firstPayment || !(firstPayment.productAmount + firstPayment.shippingAmount > 0))) {
      setError("Ingresa un monto recibido para el pago inicial.");
      setErrorSection("payment");
      return;
    }

    const payload = {
      saleDate: saleDateValue,
      ...(delivery ? { delivery } : {}),
      saleChannelId: Number(channel),
      saleStatusId,
      ...(client ? { clientId: client.id } : {}),
      ...(comments.trim() ? { comments: comments.trim() } : {}),
      productVariants: saleLines.map((line) => ({
        productId: line.productVariantId,
        quantity: line.quantity,
        discountAmount: line.discountAmount,
        discountSourceId: line.discountSourceId,
        ...(line.discountCampaignId ? { discountCampaignId: line.discountCampaignId } : {}),
      })),
      ...(selectionCount > 0
        ? {
          selectionProducts: lines.filter((line) => line.forSelection).map((line) => ({
            productId: line.productVariantId,
            quantity: line.quantity,
          })),
        }
        : {}),
      ...(hasPaymentAmount && payments.some((payment) => payment.productAmount + payment.shippingAmount > 0)
        ? { paymentMovements: payments.filter((payment) => payment.productAmount + payment.shippingAmount > 0) }
        : {}),
    };

    setSubmitting(true);
    try {
      await createSale(request, payload);
      showToast({
        tone: "success",
        title: saleStatusId === 2 ? "Reserva creada" : "Venta registrada",
        detail: saleStatusId === 2
          ? "Las prendas quedaron apartadas en inventario."
          : "La venta quedó guardada correctamente.",
      });
      navigate("/sales", { replace: true });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudo registrar la venta.";
      setError(message);
      setErrorSection(
        /stock|inventario|disponible|descuento|prenda|variante/i.test(message)
          ? "products"
          : /pago|terminal|monto|moneda|tasa/i.test(message)
            ? "payment"
            : "form",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="w-full pb-8">
      {error ? (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-extrabold">No se pudo guardar la venta</p>
          <p className="mt-1">{error}</p>
          <a
            href={errorSection === "products" ? "#sale-products" : errorSection === "payment" ? "#sale-payment" : "#sale-channel"}
            className="mt-2 inline-block font-bold underline"
          >
            Revisar {errorSection === "products" ? "prendas" : errorSection === "payment" ? "pago" : "formulario"}
          </a>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <section id="sale-channel" className="rounded-2xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="sale-channel-heading">
            <div className="mb-4">
              <h2 id="sale-channel-heading" className="text-base font-extrabold text-pw-ink">Datos de la venta</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 sm:items-start">
              <label htmlFor="sale-date" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
                Fecha de venta
                <input id="sale-date" type="date" required value={saleDate} onChange={(event) => setSaleDate(event.target.value)} className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand" />
              </label>
              <label htmlFor="sale-status-select" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
                Tipo de registro
                <SelectControl
                  id="sale-status-select"
                  aria-label="Tipo de registro"
                  value={String(saleStatusId)}
                  onChange={(event) => setSaleStatusId(Number(event.target.value) as 1 | 2)}
                  options={[
                    { value: "1", label: "Venta pendiente" },
                    { value: "2", label: "Reserva" },
                  ]}
                />
                {saleStatusId === 2 ? <span className="font-medium">Aparta el inventario mientras se coordina el retiro o envío.</span> : null}
              </label>
              <label htmlFor="sale-channel-select" className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
                Canal de venta
                <SelectControl
                  id="sale-channel-select"
                  aria-label="Canal de venta"
                  required
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                  options={[
                    { value: "", label: "Seleccionar canal" },
                    ...saleChannels.map((option) => ({ value: String(option.id), label: option.name })),
                  ]}
                />
              </label>
              <div>
                <h3 className="mb-1.5 text-xs font-extrabold text-pw-muted">Clienta <span className="font-medium">(opcional)</span></h3>
                <SaleClientPicker
                  selectedClient={client}
                  onSelect={setClient}
                  onCreateClient={() => setCreateClientOpen(true)}
                />
              </div>
            </div>
          </section>

          <section id="sale-products" className="scroll-mt-6 rounded-2xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="sale-products-heading">
            {error && errorSection === "products" ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="sale-products-heading" className="text-base font-extrabold text-pw-ink">Prendas de la venta</h2>
                {channel === "1" ? <p className="mt-1 text-xs text-pw-muted">La selección de prendas está disponible para ventas con envío.</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setGlobalDiscountOpen(true)}
                  disabled={!saleLines.length}
                  className="min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Descuento global
                </button>
                <SaleProductPicker lines={lines} onAdd={addProduct} />
              </div>
            </header>
            <SaleProductLines
              lines={lines}
              allowSelection={channel !== "1"}
              onChange={setLines}
              onChangeVariant={changeProductVariant}
              onRemove={(id) => setLines((current) => current.filter((line) => line.productVariantId !== id))}
            />
          </section>

          <section className="rounded-2xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="sale-delivery-heading">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="sale-delivery-heading" className="text-base font-extrabold text-pw-ink">Envío <span className="font-medium text-pw-muted">(opcional)</span></h2><p className="mt-1 text-sm text-pw-muted">{channel === "1" ? "Selecciona un canal distinto de tienda física para agregar un envío." : "Agrega los datos de entrega para registrar el envío junto con la venta."}</p></div><button type="button" disabled={channel === "1"} onClick={() => setDeliveryOpen(true)} className="min-h-10 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand-deep disabled:opacity-50">{delivery ? "Editar envío" : "Agregar envío"}</button></div>
            {delivery ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-pw-canvas p-3 text-sm"><p><strong>{delivery.code}</strong> · {agencies.find((agency) => agency.id === delivery.deliveryAgencyId)?.name ?? "Agencia"} · {money.format(delivery.shippingChargedToClient)}{channel === "1" ? <span className="block text-red-700">Cambia el canal o elimina el envío antes de guardar.</span> : null}</p><button type="button" onClick={() => setDelivery(null)} className="min-h-10 px-2 font-bold text-red-700">Quitar envío</button></div> : null}
          </section>

          <section className="rounded-2xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="sale-comments-heading">
            <h2 id="sale-comments-heading" className="text-base font-extrabold text-pw-ink">Notas <span className="font-medium text-pw-muted">(opcional)</span></h2>
            <label htmlFor="sale-comments" className="sr-only">Comentarios de la venta</label>
            <textarea
              id="sale-comments"
              rows={3}
              maxLength={1000}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Agrega observaciones sobre la venta…"
              className="mt-3 w-full rounded-lg border border-pw-line px-3 py-2.5 text-sm text-pw-ink"
            />
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-5" aria-label="Resumen y cierre de venta">
          <section className="rounded-2xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="sale-summary-heading">
            <header className="flex items-start justify-between gap-3 border-b border-pw-line pb-4">
              <div>
                <h2 id="sale-summary-heading" className="text-base font-extrabold text-pw-ink">Resumen</h2>
                <p className="mt-1 text-sm text-pw-muted">{itemCount} {itemCount === 1 ? "artículo" : "artículos"}</p>
                {saleStatusId === 2 ? <p className="mt-1 text-xs font-bold text-pw-brand-deep">Reserva · inventario apartado</p> : null}
                {selectionCount > 0 ? (
                  <p className="mt-1 text-xs text-pw-muted">
                    {selectionCount} {selectionCount === 1 ? "prenda" : "prendas"} para selección · no se cobra ahora
                  </p>
                ) : null}
              </div>
              <span className="rounded-full bg-pw-brand-soft px-3 py-1 text-xs font-bold text-pw-brand-deep">
                {saleChannels.find((option) => String(option.id) === channel)?.name ?? "Venta"}
              </span>
            </header>

            <dl className="space-y-3 py-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-pw-muted">Subtotal</dt>
                <dd className="font-semibold tabular-nums text-pw-ink">{money.format(grossSubtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-pw-muted">Descuentos de campaña</dt>
                <dd className="font-semibold tabular-nums text-pw-ink">− {money.format(campaignDiscount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-pw-muted">Descuentos manuales</dt>
                <dd className="font-semibold tabular-nums text-pw-ink">− {money.format(manualDiscount)}</dd>
              </div>
              {delivery ? <div className="flex justify-between gap-4"><dt className="text-pw-muted">Envío cobrado</dt><dd className="font-semibold tabular-nums">{money.format(delivery.shippingChargedToClient)}</dd></div> : null}
              <div className="flex justify-between gap-4 border-t border-pw-line pt-4 text-base">
                <dt className="font-extrabold text-pw-ink">Total estimado</dt>
                <dd className="font-extrabold tabular-nums text-pw-ink">{money.format(total + (delivery?.shippingChargedToClient ?? 0))}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-pw-line pt-4 text-base">
                <dt className="font-bold text-pw-ink">Saldo estimado</dt>
                <dd className="font-extrabold tabular-nums text-pw-ink">{money.format(balance + Math.max(0, (delivery?.shippingChargedToClient ?? 0) - appliedShipping))}</dd>
              </div>
            </dl>
          </section>

          <section id="sale-payment" className="scroll-mt-6 rounded-2xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="sale-payment-heading">
            {error && errorSection === "payment" ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
            <div className="mb-3">
              <h2 id="sale-payment-heading" className="text-base font-extrabold text-pw-ink">Pago inicial <span className="font-medium text-pw-muted">(opcional)</span></h2>
            </div>
            <SaleInitialPayment
              estimatedBalance={total}
              shippingBalance={delivery?.shippingChargedToClient ?? 0}
              exchangeRate={storeRate}
              terminals={terminals}
              terminalLoading={terminalLoading}
              terminalError={terminalError}
              onRetryTerminals={() => setTerminalRetry((value) => value + 1)}
              onChange={handlePaymentsChange}
            />
          </section>

          <div className="space-y-3">
            <LoadingButton type="submit" isLoading={submitting} className="w-full justify-center">
              {submitting ? saleStatusId === 2 ? "Guardando reserva…" : "Guardando venta…" : saleStatusId === 2 ? "Crear reserva" : "Registrar venta"}
            </LoadingButton>
          </div>
        </aside>
      </div>

      {deliveryOpen ? <SaleDeliveryCreateDialog municipalities={municipalities} agencies={agencies} loading={deliveryLoading} error={deliveryError} busy={false} clientId={null} initialDelivery={delivery ?? undefined} onRetryCatalogs={() => setDeliveryRetry((value) => value + 1)} onClose={() => setDeliveryOpen(false)} onSave={async (payload) => { setDelivery(payload); return true; }} /> : null}
      <SaleClientCreateDialog
        open={createClientOpen}
        onClose={() => setCreateClientOpen(false)}
        onCreated={(next) => {
          setClient(next);
          setCreateClientOpen(false);
        }}
      />
      <SaleGlobalDiscountDialog
        open={globalDiscountOpen}
        lines={saleLines}
        onClose={() => setGlobalDiscountOpen(false)}
        onApply={applyGlobalDiscount}
        onClear={clearCurrentDiscounts}
      />
    </form>
  );
}
