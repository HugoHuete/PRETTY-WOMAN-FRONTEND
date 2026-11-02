import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { useToast } from "../../shared/ui/toast-context";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { ApiRequestError, cancelSale, addSalePayment, createSaleDelivery, refundSalePayment, updateSalePayment, getSale, getSaleDeliveryAgencies, getSaleMunicipalities, getSaleClient, getSalePaymentTerminals, getSaleProductCatalog, patchSaleHeader, replaceSaleProducts, runSaleDeliveryAction, resolveSaleSelectionHold, returnSaleSelectionHold, undoSaleSelectionHoldResolution, updateSaleDelivery, addSaleSelectionHolds } from "./sales-api";
import { SaleDetailClient } from "./sale-detail-client";
import { SaleDetailOverview } from "./sale-detail-overview";
import { SaleDetailProducts } from "./sale-detail-products";
import { SaleDetailSummary } from "./sale-detail-summary";
import { SaleDetailPayments } from "./sale-detail-payments";
import { SaleDetailLogistics, SaleDetailSelectionHolds } from "./sale-detail-logistics";
import type { CreateSalePaymentMovementPayload, CreateSaleDeliveryPayload, SaleDeliveryAgency, SaleMunicipality, PatchSaleHeaderPayload, PatchSaleDeliveryPayload, CreateSaleSelectionProductPayload, RefundSalePaymentMovementPayload, ReplaceSaleProductsPayload, SaleClient, SaleDetail as SaleDetailModel, UpdateSalePaymentMovementPayload } from "./sales-types";
import type { ProductDTO } from "../products/product-types";

function errorMessage(caught: unknown, fallback: string) { return caught instanceof Error ? caught.message : fallback; }

export function SaleDetailPage() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const id = Number(routeId);
  const { request, session } = useAuth();
  const isAdmin = session?.user.roles.includes("Admin") ?? false;
  const { setAction, setHeading } = usePageActions();
  const { showToast } = useToast();
  const [sale, setSale] = useState<SaleDetailModel | null>(null);
  const [client, setClient] = useState<SaleClient | null>(null);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [terminals, setTerminals] = useState<{ id: number; name: string }[]>([]);
  const [municipalities, setMunicipalities] = useState<SaleMunicipality[]>([]);
  const [deliveryAgencies, setDeliveryAgencies] = useState<SaleDeliveryAgency[]>([]);
  const [deliveryCatalogLoading, setDeliveryCatalogLoading] = useState(true);
  const [deliveryCatalogError, setDeliveryCatalogError] = useState<string | null>(null);
  const [deliveryCatalogRetry, setDeliveryCatalogRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState<{ message: string; forbidden: boolean; notFound: boolean } | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const processedDeliveryAnchor = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const result = await getSale(request, id);
    setSale(result);
    return result;
  }, [id, request]);

  useEffect(() => {
    setHeading({ title: Number.isInteger(id) && id > 0 ? `Venta #${id}` : "Detalle de venta", breadcrumbs: <Link to="/sales" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-pw-brand-deep"><span aria-hidden="true">←</span> Ventas</Link> });
    setAction(null);
    return () => setHeading(null);
  }, [id, setAction, setHeading]);

  useEffect(() => {
    let active = true;
    if (!Number.isInteger(id) || id < 1) {
      setError({ message: "La referencia de la venta no es válida.", forbidden: false, notFound: true });
      setSale(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    setSale(null);
    void getSale(request, id).then((result) => {
      if (active) setSale(result);
    }).catch((caught: unknown) => {
      if (!active) return;
      setError({ message: errorMessage(caught, "No se pudo cargar la venta."), forbidden: caught instanceof ApiRequestError && caught.status === 403, notFound: caught instanceof ApiRequestError && caught.status === 404 });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, request, retry]);

  useEffect(() => {
    if (!location.hash) {
      processedDeliveryAnchor.current = null;
      return;
    }
    if (!sale || sale.id !== id) return;
    const anchorKey = `${location.key}:${location.hash}`;
    if (processedDeliveryAnchor.current === anchorKey) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    processedDeliveryAnchor.current = anchorKey;
    target.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [id, location.hash, location.key, sale]);

  const variantIds = sale ? [...sale.productVariants.map((line) => line.productId), ...sale.selectionHolds.map((hold) => hold.productId)].join(",") : "";
  useEffect(() => {
    if (!sale || !variantIds) { setProducts([]); setCatalogLoading(false); return undefined; }
    let active = true;
    setCatalogLoading(true);
    void getSaleProductCatalog(request).then((catalog) => { if (active) setProducts(catalog); }).catch(() => { if (active) setProducts([]); }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [request, sale?.id, variantIds]);

  useEffect(() => {
    let active = true;
    void getSalePaymentTerminals(request).then((items) => { if (active) setTerminals(items); }).catch(() => { if (active) setTerminals([]); });
    return () => { active = false; };
  }, [request]);
  useEffect(() => {
    let active = true;
    setDeliveryCatalogLoading(true);
    setDeliveryCatalogError(null);
    void Promise.all([getSaleMunicipalities(request), getSaleDeliveryAgencies(request)]).then(([municipalityItems, agencyItems]) => {
      if (!active) return;
      setMunicipalities(municipalityItems);
      setDeliveryAgencies(agencyItems);
    }).catch((caught: unknown) => {
      if (active) setDeliveryCatalogError(errorMessage(caught, "No se pudieron cargar los municipios y agencias."));
    }).finally(() => { if (active) setDeliveryCatalogLoading(false); });
    return () => { active = false; };
  }, [request, deliveryCatalogRetry]);
  useEffect(() => {
    if (!sale?.clientId) { setClient(null); return undefined; }
    let active = true;
    void getSaleClient(request, sale.clientId).then((result) => {
      if (active) setClient(result);
    }).catch(() => { if (active) setClient({ id: sale.clientId!, name: sale.clientName ?? "Clienta", phone: null, instagram: null, messenger: null }); });
    return () => { active = false; };
  }, [request, sale?.clientId, sale?.clientName]);

  const runMutation = async (action: () => Promise<unknown>, successTitle: string, successDetail?: string) => {
    setBusy(true);
    setMutationError(null);
    try {
      await action();
      await reload();
      showToast({ tone: "success", title: successTitle, detail: successDetail });
      return true;
    } catch (caught: unknown) {
      const message = errorMessage(caught, "No se pudo guardar el cambio.");
      setMutationError(message);
      showToast({ tone: "error", title: "No pudimos guardar el cambio", detail: message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveHeader = (payload: PatchSaleHeaderPayload) => runMutation(() => patchSaleHeader(request, id, payload), "Información de la venta actualizada.");
  const cancelCurrentSale = () => runMutation(() => cancelSale(request, id), "Venta cancelada.");
  const saveProducts = (payload: ReplaceSaleProductsPayload) => runMutation(() => replaceSaleProducts(request, id, payload), "Prendas de la venta actualizadas.");
  const saveClient = async (selected: SaleClient | null) => {
    const saved = await saveHeader({ clientId: selected?.id ?? null });
    if (!saved) return;
    if (!selected) {
      setClient(null);
      return;
    }
    try {
      setClient(await getSaleClient(request, selected.id));
    } catch {
      setClient(selected);
    }
  };
  const addPayment = (payload: CreateSalePaymentMovementPayload) => runMutation(() => addSalePayment(request, id, payload), "Pago registrado.");
  const updatePayment = (movementId: number, payload: UpdateSalePaymentMovementPayload) => runMutation(() => updateSalePayment(request, id, movementId, payload), "Pago corregido.");
  const refundPayment = (movementId: number, payload: RefundSalePaymentMovementPayload) => runMutation(() => refundSalePayment(request, id, movementId, payload), "Reembolso registrado.");
  const deliveryAction = (deliveryId: number, action: "send" | "delivered-pending-selection" | "complete" | "fail" | "cancel") => runMutation(() => runSaleDeliveryAction(request, id, deliveryId, action), "Estado de entrega actualizado.");
  const editDelivery = (deliveryId: number, payload: PatchSaleDeliveryPayload) => runMutation(() => updateSaleDelivery(request, id, deliveryId, payload), "Envío actualizado.");
  const addDelivery = (payload: CreateSaleDeliveryPayload) => runMutation(() => createSaleDelivery(request, id, payload), "Envío creado.");
  const addHold = (payload: CreateSaleSelectionProductPayload[]) => runMutation(() => addSaleSelectionHolds(request, id, payload), "Prenda apartada para selección.");
  const resolveHold = (holdId: number, selected: boolean) => runMutation(() => resolveSaleSelectionHold(request, id, holdId, { selected, ...(selected ? { discountAmount: 0, discountSourceId: 1 } : {}) }), "Selección actualizada.");
  const returnHold = (holdId: number) => runMutation(() => returnSaleSelectionHold(request, id, holdId), "Devolución confirmada.");
  const undoHoldResolution = (holdId: number) => runMutation(() => undoSaleSelectionHoldResolution(request, id, holdId), "Decisión de selección revertida.");

  return <div className="space-y-5">
    {loading ? <LoadingState /> : null}
    {!loading && error?.forbidden ? <EmptyState title="Acceso restringido" description="No tienes permiso para consultar esta venta." action={<Link to="/sales">Volver a ventas</Link>} /> : null}
    {!loading && error?.notFound ? <EmptyState title="No encontramos esta venta" description={error.message} action={<Link to="/sales">Volver a ventas</Link>} /> : null}
    {!loading && error && !error.forbidden && !error.notFound ? <ErrorState title="No pudimos cargar la venta" description={error.message} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {!loading && sale ? <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-5">
          <SaleDetailOverview sale={sale} isAdmin={isAdmin} busy={busy} onSave={saveHeader} onCancelSale={cancelCurrentSale} cancelError={mutationError} />
          {mutationError ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{mutationError}</p> : null}
          <SaleDetailProducts sale={sale} products={products} isAdmin={isAdmin} busy={busy} onSave={saveProducts} />
          <SaleDetailSelectionHolds sale={sale} products={products} isAdmin={isAdmin} busy={busy} onAddHold={addHold} onResolveHold={resolveHold} onReturnHold={returnHold} onUndoResolution={undoHoldResolution} />
          <SaleDetailPayments sale={sale} isAdmin={isAdmin} busy={busy} terminals={terminals} onAdd={addPayment} onUpdate={updatePayment} onRefund={refundPayment} />
          <SaleDetailLogistics sale={sale} isAdmin={isAdmin} busy={busy} municipalities={municipalities} deliveryAgencies={deliveryAgencies} deliveryCatalogLoading={deliveryCatalogLoading} deliveryCatalogError={deliveryCatalogError} onRetryDeliveryCatalogs={() => setDeliveryCatalogRetry((value) => value + 1)} onDeliveryAction={deliveryAction} onEditDelivery={editDelivery} onCreateDelivery={addDelivery} />
        </div>
        <aside className="min-w-0 space-y-5 self-start xl:sticky xl:top-5"><SaleDetailSummary sale={sale} /><SaleDetailClient sale={sale} client={client} isAdmin={isAdmin} busy={busy} onSave={saveClient} onCreateClient={(created) => saveClient(created)} /></aside>
      </div>
      {catalogLoading ? <p className="sr-only" role="status">Cargando datos de productos</p> : null}
    </> : null}
  </div>;
}
