import { SaleCardAction } from "./sale-card-action";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import { salePaymentMethods, type CreateSalePaymentPayload, type SaleCatalogOption } from "./sales-types";

import { PaymentDialogContent, calculatePayment, emptyPayment, roundMoney, type PaymentDraft } from "./sale-payment-form";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
function formatReceived(amount: number, currency: PaymentDraft["currency"]) {
  return currency === "USD"
    ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : money.format(amount);
}

export function SaleInitialPayment({ estimatedBalance: productBalance, shippingBalance = 0, exchangeRate: fallbackRate, terminals, terminalLoading, terminalError, onRetryTerminals, onChange }: {
  estimatedBalance: number;
  shippingBalance?: number;
  exchangeRate: number | null;
  terminals: SaleCatalogOption[];
  terminalLoading: boolean;
  terminalError: string | null;
  onRetryTerminals: () => void;
  onChange: (movements: CreateSalePaymentPayload[]) => void;
}) {
  const estimatedBalance = roundMoney(Math.max(0, productBalance) + Math.max(0, shippingBalance));
  const { storeRate: contextRate, status } = useExchangeRate();
  const storeRate = contextRate ?? fallbackRate;
  const [drafts, setDrafts] = useState<PaymentDraft[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const calculate = useCallback(
    (draft: PaymentDraft, balance: number) => calculatePayment(draft, balance, storeRate),
    [storeRate],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogOpen && dialog && !dialog.open) dialog.showModal();
  }, [dialogOpen]);

  const payments = useMemo(() => {
    let remaining = Math.max(0, estimatedBalance);
    let remainingProducts = Math.max(0, productBalance);
    return drafts.map((draft) => {
      const calculation = calculate(draft, remaining);
      if (!calculation) {
        return {
          paymentMethodId: draft.methodId,
          ...(draft.methodId === 3 && draft.terminalId ? { paymentTerminalId: Number(draft.terminalId) } : {}),
          productAmount: 0,
          shippingAmount: 0,
          amountReceivedNio: 0,
          amountReceivedUsd: 0,
          changeGivenNio: 0,
        } satisfies CreateSalePaymentPayload;
      }
      remaining = roundMoney(Math.max(0, remaining - calculation.applied));
      const productAmount = roundMoney(Math.min(remainingProducts, calculation.applied));
      const shippingAmount = roundMoney(calculation.applied - productAmount);
      remainingProducts = roundMoney(Math.max(0, remainingProducts - productAmount));
      const payload: CreateSalePaymentPayload = {
        paymentMethodId: draft.methodId,
        productAmount,
        shippingAmount,
        amountReceivedNio: draft.currency === "NIO" ? calculation.received : 0,
        amountReceivedUsd: draft.currency === "USD" ? calculation.received : 0,
        changeGivenNio: calculation.change,
      };
      if (draft.methodId === 3 && draft.terminalId) payload.paymentTerminalId = Number(draft.terminalId);
      if (draft.currency === "USD" && calculation.rate) payload.exchangeRate = calculation.rate;
      return payload;
    });
  }, [calculate, drafts, estimatedBalance, productBalance]);

  useEffect(() => { onChange(payments); }, [onChange, payments]);

  const paymentOptions = [
    ...salePaymentMethods
      .filter((method) => method.id !== 3)
      .map((method) => ({ value: String(method.id), label: method.name })),
    ...terminals.map((terminal) => ({ value: `terminal:${terminal.id}`, label: terminal.name })),
  ];

  const getMethodLabel = (draft: PaymentDraft) => draft.methodId === 3
    ? terminals.find((terminal) => String(terminal.id) === draft.terminalId)?.name ?? "Tarjeta"
    : salePaymentMethods.find((method) => method.id === draft.methodId)?.name ?? "Pago";

  const openAddDialog = () => {
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const savePayment = (nextDraft: PaymentDraft) => {
    setDrafts((current) => editingIndex === null
      ? [...current, nextDraft]
      : current.map((draft, index) => index === editingIndex ? nextDraft : draft));
    dialogRef.current?.close();
    setDialogOpen(false);
  };

  const closePaymentDialog = () => {
    dialogRef.current?.close();
    setDialogOpen(false);
  };

  const removePayment = (index: number) => {
    setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const totalApplied = roundMoney(payments.reduce((sum, payment) => sum + payment.productAmount + payment.shippingAmount, 0));
  const remainingBalance = roundMoney(Math.max(0, estimatedBalance - totalApplied));

  return (
    <div className="space-y-3">
      <header className="-mr-2 flex items-center justify-between gap-2">
        <h2 id="sale-payment-heading" className="text-base font-extrabold text-pw-ink">
          Pago inicial <span className="font-medium text-pw-muted">(opcional)</span>
        </h2>
        <button
          type="button"
          onClick={openAddDialog}
          disabled={remainingBalance <= 0}
          aria-label="Agregar pago"
          title="Agregar pago"
          className="grid size-10 shrink-0 place-items-center rounded-lg text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      {terminalLoading ? <p className="text-xs text-pw-muted">Cargando métodos de pago…</p> : null}
      {terminalError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>No se pudieron cargar las terminales. Puedes registrar efectivo o transferencia.</span>
          <button type="button" onClick={onRetryTerminals} className="min-h-9 rounded-md px-2 font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand">Reintentar</button>
        </div>
      ) : null}
      {!terminalLoading && !terminalError && terminals.length === 0 ? <p className="text-xs text-pw-muted">No hay terminales activas; puedes registrar efectivo o transferencia.</p> : null}

      {drafts.length ? (
        <ul aria-label="Pagos iniciales agregados" className="divide-y divide-pw-line">
          {drafts.map((draft, index) => {
            const payment = payments[index];
            const received = draft.received.trim() ? Number(draft.received) || 0 : 0;
            return (
              <li key={`${index}-${draft.methodId}-${draft.terminalId}`} className="grid gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-sm font-bold text-pw-ink">
                    <span className="wrap-anywhere">{getMethodLabel(draft)}</span>
                    <span>({draft.currency === "USD" ? "US$" : "C$"})</span>
                  </p>
                  <div className="-mr-2 flex shrink-0">
                    <SaleCardAction action="edit" borderless label={`Editar pago ${index + 1}`} onClick={() => openEditDialog(index)} />
                    <button type="button" onClick={() => removePayment(index)} aria-label={`Quitar pago ${index + 1}`} className="grid min-h-9 w-9 place-items-center rounded-lg text-pw-muted hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M8.5 9v4m3-4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </div>
                <dl className="grid gap-1.5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <dt className="text-pw-muted">Recibido</dt>
                    <dd className="ml-auto font-extrabold tabular-nums text-pw-ink">{formatReceived(received, draft.currency)}</dd>
                  </div>
                  {payment.changeGivenNio > 0 ? (
                    <div className="flex flex-wrap justify-between gap-x-2 border-t border-pw-line pt-1.5 text-xs font-bold text-pw-ink">
                      <dt>Cambio a entregar</dt>
                      <dd className="ml-auto tabular-nums">{money.format(payment.changeGivenNio)}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-pw-muted">Aún no se ha agregado ningún pago inicial.</p>
      )}

      {dialogOpen ? <dialog
        ref={dialogRef}
        aria-labelledby="sale-payment-dialog-title"
        onClose={() => setDialogOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50"
      >
        <PaymentDialogContent
          editing={editingIndex !== null}
          initialDraft={editingIndex === null ? emptyPayment() : drafts[editingIndex]}
          drafts={drafts}
          editingIndex={editingIndex}
          estimatedBalance={estimatedBalance}
          calculate={calculate}
          remainingBalance={remainingBalance}
          availableBalance={editingIndex === null
            ? remainingBalance
            : roundMoney(remainingBalance + (payments[editingIndex]?.productAmount ?? 0) + (payments[editingIndex]?.shippingAmount ?? 0))}
          storeRate={storeRate}
          exchangeRateStatus={status}
          paymentOptions={paymentOptions}
          onCancel={closePaymentDialog}
          onSave={savePayment}
        />
      </dialog> : null}
    </div>
  );
}
