import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import type { SaleDetail, SalePaymentMovement, CreateSalePaymentMovementPayload } from "./sales-types";
import { salePaymentMethods, type SaleCatalogOption, type UpdateSalePaymentMovementPayload, type RefundSalePaymentMovementPayload } from "./sales-types";
import { SalePaymentEditDialog, SalePaymentRefundButton } from "./sale-payment-actions";

import { PaymentDialogContent, calculatePayment, emptyPayment, roundMoney as round, type PaymentDraft } from "./sale-payment-form";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const applied = (movement: SalePaymentMovement, value: number) => movement.movementDirectionId === 2 ? -value : value;

function AddPaymentDialog({ productBalance, shippingBalance, deliveryId, terminals, busy, onClose, onSave }: { productBalance: number; shippingBalance: number; deliveryId?: number; terminals: SaleCatalogOption[]; busy: boolean; onClose: () => void; onSave: (payload: CreateSalePaymentMovementPayload) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { storeRate, status } = useExchangeRate();
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  const remaining = round(productBalance + shippingBalance);
  const calculate = (draft: PaymentDraft, balance: number) => calculatePayment(draft, balance, storeRate);
  const paymentOptions = [
    ...salePaymentMethods.filter((entry) => entry.id !== 3).map((entry) => ({ value: String(entry.id), label: entry.name })),
    ...terminals.map((entry) => ({ value: `terminal:${entry.id}`, label: entry.name })),
  ];

  const save = async (draft: PaymentDraft) => {
    const payment = calculate(draft, remaining);
    if (!payment || payment.exceedsBalance) return;
    const productAmount = round(Math.min(productBalance, payment.applied));
    const shippingAmount = round(payment.applied - productAmount);
    const saved = await onSave({
      paymentMethodId: draft.methodId,
      ...(draft.methodId === 3 ? { paymentTerminalId: Number(draft.terminalId) } : {}),
      productAmount,
      shippingAmount,
      ...(shippingAmount > 0 && deliveryId !== undefined ? { saleDeliveryId: deliveryId } : {}),
      amountReceivedNio: draft.currency === "NIO" ? payment.received : 0,
      amountReceivedUsd: draft.currency === "USD" ? payment.received : 0,
      changeGivenNio: payment.change,
      ...(draft.currency === "USD" ? { exchangeRate: payment.rate } : {}),
    });
    if (saved) onClose();
  };

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="sale-payment-dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50"
    >
      <PaymentDialogContent
        title="Registrar pago"
        busy={busy}
        editing={false}
        initialDraft={emptyPayment()}
        drafts={[]}
        editingIndex={null}
        estimatedBalance={remaining}
        calculate={calculate}
        remainingBalance={remaining}
        availableBalance={remaining}
        storeRate={storeRate}
        exchangeRateStatus={status}
        paymentOptions={paymentOptions}
        onCancel={onClose}
        onSave={save}
      />
    </dialog>,
    document.body,
  );
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
  const delivery = sale.deliveries
    .filter((item) => item.deliveryStatusId !== 3)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const deliveryShippingPaid = sale.paymentMovements
    .filter((movement) => movement.saleDeliveryId === delivery?.id)
    .reduce((sum, movement) => sum + applied(movement, movement.shippingAmount), 0);
  const productBalance = Math.max(0, round(sale.total - productsPaid));
  const shippingBalance = Math.max(0, round((delivery?.shippingChargedToClient ?? 0) - deliveryShippingPaid));
  const due = round(productBalance + shippingBalance);
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
          <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted sm:hidden">Fecha y hora</span><span className="text-xs text-pw-muted">{new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(movement.movementDate))}</span></div>
          <div className="col-span-2 min-w-0 sm:col-span-1"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted sm:hidden">Aplicado</span><span className="block text-xs text-pw-muted">Productos {money.format(movement.productAmount)}</span><span className="block text-xs text-pw-muted">Envío {money.format(movement.shippingAmount)}</span>{movement.changeGivenNio ? <span className="block text-xs text-pw-muted">Cambio {money.format(movement.changeGivenNio)}</span> : null}</div>
          <strong className={"text-right text-sm tabular-nums " + (isRefund ? "text-red-700" : "text-pw-ink")}><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-pw-muted sm:hidden">Monto</span>{isRefund ? "− " : ""}{money.format(amount)}</strong>
          <div className="col-span-2 flex justify-end sm:col-span-1">{isAdmin && !isRefund && !fullyRefunded ? <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => setEditing(movement)} className="min-h-9 rounded-lg border border-pw-line bg-white px-2 text-xs font-bold hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:opacity-50">Corregir</button><SalePaymentRefundButton movement={movement} refundedProductAmount={refundedAmount.product} refundedShippingAmount={refundedAmount.shipping} busy={busy} onRefund={(payload) => onRefund(movement.id, payload)} /></div> : null}</div>
        </li>;
      })}
    </ul> : <p className="mt-4 rounded-xl border border-dashed border-pw-line py-7 text-center text-sm text-pw-muted">Aún no hay pagos registrados.</p>}
    {editing ? <SalePaymentEditDialog movement={editing} terminals={terminals} busy={busy} onClose={() => setEditing(null)} onSave={(payload) => onUpdate(editing.id, payload)} /> : null}
    {adding ? <AddPaymentDialog productBalance={productBalance} shippingBalance={shippingBalance} deliveryId={delivery?.id} terminals={terminals} busy={busy} onClose={() => setAdding(false)} onSave={onAdd} /> : null}
  </section>;
}
