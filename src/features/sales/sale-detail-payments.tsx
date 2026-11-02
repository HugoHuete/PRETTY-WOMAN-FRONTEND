import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import { LoadingButton } from "../../shared/ui/loading-button";
import { SelectControl } from "../../shared/ui/select-control";
import type { SaleDetail, SalePaymentMovement, CreateSalePaymentMovementPayload } from "./sales-types";
import { salePaymentMethods, type SaleCatalogOption, type UpdateSalePaymentMovementPayload, type RefundSalePaymentMovementPayload } from "./sales-types";
import { SalePaymentEditDialog, SalePaymentRefundButton } from "./sale-payment-actions";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const applied = (movement: SalePaymentMovement, value: number) => movement.movementDirectionId === 2 ? -value : value;

function AddPaymentDialog({ sale, terminals, busy, onClose, onSave }: { sale: SaleDetail; terminals: SaleCatalogOption[]; busy: boolean; onClose: () => void; onSave: (payload: CreateSalePaymentMovementPayload) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { storeRate } = useExchangeRate();
  const [method, setMethod] = useState("1");
  const [currency, setCurrency] = useState<"NIO" | "USD">("NIO");
  const [terminal, setTerminal] = useState("");
  const [received, setReceived] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); return () => dialog.current?.close(); }, []);
  const delivery = [...sale.deliveries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const balances = useMemo(() => {
    const productPaid = sale.paymentMovements.reduce((sum, movement) => sum + applied(movement, movement.productAmount), 0);
    const shippingPaid = sale.paymentMovements
      .filter((movement) => movement.saleDeliveryId === delivery?.id)
      .reduce((sum, movement) => sum + applied(movement, movement.shippingAmount), 0);
    return { products: Math.max(0, round(sale.total - productPaid)), shipping: Math.max(0, round((delivery?.shippingChargedToClient ?? 0) - shippingPaid)) };
  }, [delivery, sale.paymentMovements, sale.total]);
  const methodId = Number(method.startsWith("terminal:") ? 3 : method);
  const converted = round((Number(received) || 0) * (currency === "USD" ? (storeRate ?? 0) : 1));
  const remaining = round(balances.products + balances.shipping);
  const card = methodId === 3;
  const exceeds = card && converted > remaining;
  const appliedAmount = round(Math.min(remaining, converted));
  const productAmount = Math.min(balances.products, appliedAmount);
  const shippingAmount = round(appliedAmount - productAmount);
  const change = card ? 0 : Math.max(0, round(converted - appliedAmount));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (converted <= 0) { setError("Ingresa un monto recibido mayor que cero."); return; }
    if (currency === "USD" && !storeRate) { setError("No hay una tasa de cambio disponible para registrar dólares."); return; }
    if (card && (!terminal || exceeds)) { setError(exceeds ? "El pago con tarjeta no puede superar el saldo pendiente." : "Selecciona la terminal de la tarjeta."); return; }
    const saved = await onSave({ paymentMethodId: methodId, ...(card ? { paymentTerminalId: Number(terminal || method.slice("terminal:".length)) } : {}), productAmount, shippingAmount, ...(shippingAmount > 0 && delivery ? { saleDeliveryId: delivery.id } : {}), amountReceivedNio: currency === "NIO" ? Number(received) : 0, amountReceivedUsd: currency === "USD" ? Number(received) : 0, changeGivenNio: change, ...(currency === "USD" && storeRate ? { exchangeRate: storeRate } : {}) });
    if (saved) onClose();
  };
  const paymentOptions = [...salePaymentMethods.filter((entry) => entry.id !== 3).map((entry) => ({ value: String(entry.id), label: entry.name })), ...terminals.map((entry) => ({ value: `terminal:${entry.id}`, label: entry.name }))];
  return createPortal(<dialog ref={dialog} aria-labelledby="sale-detail-payment-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50">
    <form onSubmit={submit} className="space-y-4 p-5 sm:p-6"><header className="flex items-start justify-between"><div><h2 id="sale-detail-payment-title" className="text-lg font-extrabold">Registrar pago</h2><p className="mt-1 text-sm text-pw-muted">Saldo disponible: {money.format(remaining)}</p></div><button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-pw-muted">Método de pago<SelectControl id="sale-payment-method" aria-label="Método de pago" value={method} options={paymentOptions} onChange={(event) => { setMethod(event.target.value); if (event.target.value.startsWith("terminal:")) { setTerminal(event.target.value.slice(9)); setCurrency("NIO"); } }} /></label><label className="grid gap-1 text-xs font-bold text-pw-muted">Moneda recibida<SelectControl id="sale-payment-currency" aria-label="Moneda recibida" value={currency} options={[{ value: "NIO", label: "Córdobas (C$)" }, ...(card ? [] : [{ value: "USD", label: "Dólares (USD)" }])]} onChange={(event) => setCurrency(event.target.value as "NIO" | "USD")} /></label>
        {methodId === 3 && method === "3" ? <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-2">Terminal<SelectControl id="sale-payment-terminal" aria-label="Terminal de tarjeta" value={terminal} options={[{ value: "", label: "Seleccionar terminal" }, ...terminals.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={(event) => setTerminal(event.target.value)} /></label> : null}
        <label className="grid gap-1 text-xs font-bold text-pw-muted sm:col-span-2">Monto recibido <span className="flex min-h-11 items-center gap-2 rounded-lg border border-pw-line px-3"><span className="text-sm text-pw-muted">{currency === "USD" ? "$" : "C$"}</span><input autoFocus type="number" min="0.01" step="0.01" inputMode="decimal" required value={received} onChange={(event) => setReceived(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-sm text-pw-ink outline-none" /></span></label>
      </div>
      <dl className="space-y-2 rounded-xl bg-pw-canvas p-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-pw-muted">Equivalente recibido</dt><dd className="font-bold tabular-nums">{currency === "USD" ? `${usd.format(Number(received) || 0)} · ${money.format(converted)}` : money.format(converted)}</dd></div><div className="flex justify-between gap-3"><dt className="text-pw-muted">Se aplicará a la venta</dt><dd className="font-bold tabular-nums">{money.format(appliedAmount)}</dd></div>{!card ? <div className="flex justify-between gap-3"><dt className="text-pw-muted">Cambio a entregar</dt><dd className="font-bold tabular-nums">{money.format(change)}</dd></div> : null}<div className="flex justify-between gap-3 border-t border-pw-line pt-2"><dt className="font-extrabold">Saldo pendiente después del pago</dt><dd className="font-extrabold tabular-nums">{money.format(Math.max(0, remaining - appliedAmount))}</dd></div></dl>
      {exceeds ? <p role="alert" className="text-sm font-bold text-red-700">El pago con tarjeta no puede superar el saldo pendiente.</p> : null}{error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}
      <footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} disabled={exceeds || (card && method === "3" && !terminal)} className="min-h-10 text-sm">Agregar pago</LoadingButton></footer>
    </form>
  </dialog>, document.body);
}

export function SaleDetailPayments({ sale, isAdmin, busy, terminals, onAdd, onUpdate, onRefund }: { sale: SaleDetail; isAdmin: boolean; busy: boolean; terminals: SaleCatalogOption[]; onAdd: (payload: CreateSalePaymentMovementPayload) => Promise<boolean>; onUpdate: (movementId: number, payload: UpdateSalePaymentMovementPayload) => Promise<boolean>; onRefund: (movementId: number, payload: RefundSalePaymentMovementPayload) => Promise<boolean> }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SalePaymentMovement | null>(null);
  const movements = [...sale.paymentMovements].sort((a, b) => Date.parse(b.movementDate) - Date.parse(a.movementDate));
  const refundedAmounts = new Map<number, { product: number; shipping: number }>();
  sale.paymentMovements.forEach((movement) => {
    if (movement.movementDirectionId !== 2 || movement.reversedSalePaymentMovementId === null) return;
    const previousAmount = refundedAmounts.get(movement.reversedSalePaymentMovementId) ?? { product: 0, shipping: 0 };
    refundedAmounts.set(movement.reversedSalePaymentMovementId, {
      product: previousAmount.product + movement.productAmount,
      shipping: previousAmount.shipping + movement.shippingAmount,
    });
  });
  const productsPaid = sale.paymentMovements.reduce((sum, movement) => sum + applied(movement, movement.productAmount), 0);
  const shippingPaid = sale.paymentMovements.reduce((sum, movement) => sum + applied(movement, movement.shippingAmount), 0);
  const paid = productsPaid + shippingPaid;
  const shipping = [...sale.deliveries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]?.shippingChargedToClient ?? 0;
  const due = Math.max(0, round(sale.total + shipping - paid));
  const canAdd = sale.saleStatusId !== 6 && due > 0;
  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-payments-title"><header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="sale-payments-title" className="text-base font-extrabold">Pagos</h2></div>{canAdd ? <button type="button" disabled={busy} onClick={() => setAdding(true)} className="min-h-10 rounded-lg bg-pw-brand px-3 text-sm font-extrabold text-white">Registrar pago</button> : null}</header>
    <div className="grid gap-2 rounded-xl bg-pw-canvas p-3 sm:grid-cols-3"><div><span className="block text-xs text-pw-muted">Aplicado a productos</span><strong className="text-sm tabular-nums">{money.format(Math.max(0, productsPaid))}</strong></div><div><span className="block text-xs text-pw-muted">Aplicado al envío</span><strong className="text-sm tabular-nums">{money.format(Math.max(0, shippingPaid))}</strong></div><div><span className="block text-xs text-pw-muted">Saldo pendiente</span><strong className="text-sm tabular-nums">{money.format(due)}</strong></div></div>
    {movements.length ? <ul className="mt-4 divide-y divide-pw-line rounded-xl border border-pw-line">
      <li aria-hidden="true" className="hidden grid-cols-[minmax(0,1.1fr)_minmax(9rem,1fr)_minmax(0,1.3fr)_6.5rem_9rem] gap-4 bg-pw-canvas px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-pw-muted sm:grid"><span>Movimiento</span><span>Fecha y hora</span><span>Aplicado</span><span className="text-right">Monto</span><span className="text-right">Acciones</span></li>
      {movements.map((movement) => {
        const isRefund = movement.movementDirectionId === 2;
        const amount = movement.productAmount + movement.shippingAmount;
        const refundedAmount = refundedAmounts.get(movement.id) ?? { product: 0, shipping: 0 };
        const fullyRefunded = !isRefund && refundedAmount.product + refundedAmount.shipping >= amount - 0.01;
        return <li key={movement.id} className="grid grid-cols-2 items-center gap-x-4 gap-y-3 px-3 py-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(9rem,1fr)_minmax(0,1.3fr)_6.5rem_9rem] sm:gap-4">
          <div className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted sm:hidden">Movimiento</span><strong className="block truncate text-sm">{isRefund ? `Reembolso${movement.paymentTerminalName ? ` · ${movement.paymentTerminalName}` : ""}` : `${movement.paymentMethodName ?? "Pago"}${movement.paymentTerminalName ? ` · ${movement.paymentTerminalName}` : ""}`}</strong>{fullyRefunded ? <span className="mt-1 inline-flex rounded-full bg-pw-canvas px-2 py-0.5 text-[10px] font-bold text-pw-muted">Reembolsado</span> : null}</div>
          <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted sm:hidden">Fecha y hora</span><span className="text-xs text-pw-muted">{new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short" }).format(new Date(movement.movementDate))}</span></div>
          <div className="col-span-2 min-w-0 sm:col-span-1"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted sm:hidden">Aplicado</span><span className="block text-xs text-pw-muted">Productos {money.format(movement.productAmount)}</span><span className="block text-xs text-pw-muted">Envío {money.format(movement.shippingAmount)}</span>{movement.changeGivenNio ? <span className="block text-xs text-pw-muted">Cambio {money.format(movement.changeGivenNio)}</span> : null}</div>
          <strong className={"text-right text-sm tabular-nums " + (isRefund ? "text-red-700" : "text-pw-ink")}><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted sm:hidden">Monto</span>{isRefund ? "− " : ""}{money.format(amount)}</strong>
          <div className="col-span-2 flex justify-end sm:col-span-1">{isAdmin && !isRefund && !fullyRefunded ? <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => setEditing(movement)} className="min-h-9 rounded-lg border border-pw-line bg-white px-2 text-xs font-bold hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:opacity-50">Corregir</button><SalePaymentRefundButton movement={movement} refundedProductAmount={refundedAmount.product} refundedShippingAmount={refundedAmount.shipping} busy={busy} onRefund={(payload) => onRefund(movement.id, payload)} /></div> : null}</div>
        </li>;
      })}
    </ul> : <p className="mt-4 rounded-xl border border-dashed border-pw-line py-7 text-center text-sm text-pw-muted">Aún no hay pagos registrados.</p>}
    {editing ? <SalePaymentEditDialog movement={editing} terminals={terminals} busy={busy} onClose={() => setEditing(null)} onSave={(payload) => onUpdate(editing.id, payload)} /> : null}
    {adding ? <AddPaymentDialog sale={sale} terminals={terminals} busy={busy} onClose={() => setAdding(false)} onSave={onAdd} /> : null}
  </section>;
}
