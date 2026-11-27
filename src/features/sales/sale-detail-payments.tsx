import { SaleCardAction } from "./sale-card-action";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import type { SaleDetail, SalePaymentMovement, CreateSalePaymentMovementPayload } from "./sales-types";
import { salePaymentMethods, type SaleCatalogOption, type UpdateSalePaymentMovementPayload, type RefundSalePaymentMovementPayload } from "./sales-types";
import { SalePaymentEditDialog, SalePaymentRefundButton } from "./sale-payment-actions";

import { PaymentDialogContent, calculatePayment, emptyPayment, roundMoney as round, type PaymentDraft } from "./sale-payment-form";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const paymentDate = new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
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
  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="sale-payments-title"><header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="sale-payments-title" className="text-base font-extrabold">Pagos</h2></div>{canAdd ? <button type="button" disabled={busy} onClick={() => setAdding(true)} aria-label="Registrar pago" title="Registrar pago" className="grid size-10 place-items-center rounded-lg text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></button> : null}</header>
    <div className="grid gap-2 rounded-xl bg-pw-canvas p-3 sm:grid-cols-3"><div><span className="block text-xs text-pw-muted">Aplicado a productos</span><strong className="text-sm tabular-nums">{money.format(Math.max(0, productsPaid))}</strong></div><div><span className="block text-xs text-pw-muted">Aplicado al envío</span><strong className="text-sm tabular-nums">{money.format(Math.max(0, shippingPaid))}</strong></div><div><span className="block text-xs text-pw-muted">Por pagar</span><strong className="text-sm tabular-nums">{money.format(due)}</strong></div></div>
    {movements.length ? <ul aria-label="Movimientos de pago" className="mt-3 divide-y divide-pw-line">
      {movements.map((movement) => {
        const isRefund = movement.movementDirectionId === 2;
        const amount = movement.productAmount + movement.shippingAmount;
        const refundedAmount = refundedAmounts.get(movement.id) ?? { product: 0, shipping: 0 };
        const fullyRefunded = !isRefund && refundedAmount.product + refundedAmount.shipping >= amount - 0.01;
        const currency = movement.amountReceivedUsd > 0
          ? movement.amountReceivedNio > 0 ? "C$ / US$" : "US$"
          : "C$";
        const received = [
          movement.amountReceivedNio > 0 ? money.format(movement.amountReceivedNio) : null,
          movement.amountReceivedUsd > 0 ? `US${usd.format(movement.amountReceivedUsd)}` : null,
        ].filter(Boolean).join(" · ");
        const method = movement.paymentMethodName ?? "Pago";

        return <li key={movement.id} className="py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="min-w-0 flex-1 basis-36">
              <strong className="block wrap-anywhere text-sm">{isRefund ? "Reembolso" : `${method} (${currency})`}{movement.paymentTerminalName ? ` · ${movement.paymentTerminalName}` : ""}</strong>
              <span className="block text-xs text-pw-muted">{paymentDate.format(new Date(movement.movementDate))}{fullyRefunded ? " · Reembolsado" : ""}</span>
            </div>
            <div className="ml-auto text-right">
              <span className="block text-xs text-pw-muted">{!isRefund && received ? "Recibido" : "Monto"}</span>
              <strong className={`text-sm tabular-nums ${isRefund ? "text-red-700" : "text-pw-ink"}`}>{isRefund ? `− ${money.format(amount)}` : received || money.format(amount)}</strong>
            </div>
            {isAdmin && !isRefund && !fullyRefunded ? (
              <div className="flex shrink-0 items-center gap-1">
                <SaleCardAction action="edit" borderless label="Corregir pago" disabled={busy} onClick={() => setEditing(movement)} />
                <SalePaymentRefundButton movement={movement} refundedProductAmount={refundedAmount.product} refundedShippingAmount={refundedAmount.shipping} busy={busy} onRefund={(payload) => onRefund(movement.id, payload)} />
              </div>
            ) : null}
          </div>
          {!isRefund && movement.changeGivenNio > 0 ? <p className="mt-2 flex flex-wrap justify-between gap-x-2 text-xs font-bold"><span>Cambio a entregar</span><span className="tabular-nums">{money.format(movement.changeGivenNio)}</span></p> : null}
          <details className="mt-2 text-xs text-pw-muted">
            <summary className="w-fit cursor-pointer rounded font-semibold focus-visible:outline-2 focus-visible:outline-pw-brand">Desglose del movimiento</summary>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <div className="flex gap-2"><dt>Productos</dt><dd className="font-semibold tabular-nums">{money.format(movement.productAmount)}</dd></div>
              <div className="flex gap-2"><dt>Envío</dt><dd className="font-semibold tabular-nums">{money.format(movement.shippingAmount)}</dd></div>
            </dl>
          </details>
        </li>;
      })}
    </ul> : <p className="mt-4 rounded-xl border border-dashed border-pw-line py-7 text-center text-sm text-pw-muted">Aún no hay pagos registrados.</p>}
    {editing ? <SalePaymentEditDialog movement={editing} terminals={terminals} busy={busy} onClose={() => setEditing(null)} onSave={(payload) => onUpdate(editing.id, payload)} /> : null}
    {adding ? <AddPaymentDialog productBalance={productBalance} shippingBalance={shippingBalance} deliveryId={delivery?.id} terminals={terminals} busy={busy} onClose={() => setAdding(false)} onSave={onAdd} /> : null}
  </section>;
}
