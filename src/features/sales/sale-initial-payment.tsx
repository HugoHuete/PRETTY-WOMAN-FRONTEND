import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import { SelectControl } from "../../shared/ui/select-control";
import { salePaymentMethods, type CreateSalePaymentPayload, type SaleCatalogOption } from "./sales-types";

type PaymentDraft = { methodId: number; currency: "NIO" | "USD"; received: string; terminalId: string };
type PaymentCalculation = { received: number; converted: number; applied: number; change: number; exceedsBalance: boolean; rate: number };
const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const emptyPayment = (): PaymentDraft => ({ methodId: 1, currency: "NIO", received: "", terminalId: "" });
function roundMoney(amount: number) { return Math.round((amount + Number.EPSILON) * 100) / 100; }
function formatReceived(amount: number, currency: PaymentDraft["currency"]) {
  return currency === "USD"
    ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : money.format(amount);
}

export function SaleInitialPayment({ estimatedBalance, exchangeRate: fallbackRate, terminals, terminalLoading, terminalError, onRetryTerminals, onChange }: {
  estimatedBalance: number;
  exchangeRate: number | null;
  terminals: SaleCatalogOption[];
  terminalLoading: boolean;
  terminalError: string | null;
  onRetryTerminals: () => void;
  onChange: (movements: CreateSalePaymentPayload[]) => void;
}) {
  const { storeRate: contextRate, status } = useExchangeRate();
  const storeRate = contextRate ?? fallbackRate;
  const [drafts, setDrafts] = useState<PaymentDraft[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const calculate = useCallback((draft: PaymentDraft, balance: number): PaymentCalculation | null => {
    const received = roundMoney(Math.max(0, Number(draft.received) || 0));
    const rate = storeRate ? Math.round(storeRate * 10000) / 10000 : 0;
    if (received <= 0 || (draft.currency === "USD" && rate <= 0)) return null;
    const converted = roundMoney(received * (draft.currency === "USD" ? rate : 1));
    const applied = roundMoney(Math.min(Math.max(0, balance), converted));
    const exceedsBalance = draft.methodId === 3 && converted > Math.max(0, balance);
    return {
      received,
      converted,
      applied,
      change: draft.methodId === 3 ? 0 : roundMoney(Math.max(0, converted - applied)),
      exceedsBalance,
      rate,
    };
  }, [storeRate]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogOpen && dialog && !dialog.open) dialog.showModal();
  }, [dialogOpen]);

  const payments = useMemo(() => {
    let remaining = Math.max(0, estimatedBalance);
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
      const payload: CreateSalePaymentPayload = {
        paymentMethodId: draft.methodId,
        productAmount: calculation.applied,
        shippingAmount: 0,
        amountReceivedNio: draft.currency === "NIO" ? calculation.received : 0,
        amountReceivedUsd: draft.currency === "USD" ? calculation.received : 0,
        changeGivenNio: calculation.change,
      };
      if (draft.methodId === 3 && draft.terminalId) payload.paymentTerminalId = Number(draft.terminalId);
      if (draft.currency === "USD" && calculation.rate) payload.exchangeRate = calculation.rate;
      return payload;
    });
  }, [calculate, drafts, estimatedBalance]);

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

  const totalApplied = roundMoney(payments.reduce((sum, payment) => sum + payment.productAmount, 0));
  const remainingBalance = roundMoney(Math.max(0, estimatedBalance - totalApplied));

  return (
    <div className="space-y-3">
      {terminalLoading ? <p className="text-xs text-pw-muted">Cargando métodos de pago…</p> : null}
      {terminalError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>No se pudieron cargar las terminales. Puedes registrar efectivo o transferencia.</span>
          <button type="button" onClick={onRetryTerminals} className="min-h-9 rounded-md px-2 font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand">Reintentar</button>
        </div>
      ) : null}
      {!terminalLoading && !terminalError && terminals.length === 0 ? <p className="text-xs text-pw-muted">No hay terminales activas; puedes registrar efectivo o transferencia.</p> : null}

      {drafts.length ? (
        <>
          <ul aria-label="Pagos iniciales agregados" className="divide-y divide-pw-line overflow-hidden rounded-xl border border-pw-line">
            {drafts.map((draft, index) => {
              const payment = payments[index];
              const received = draft.received.trim() ? Number(draft.received) || 0 : 0;
              return (
                <li key={`${index}-${draft.methodId}-${draft.terminalId}`} className="flex flex-wrap items-center justify-between gap-3 bg-white px-3 py-3 sm:px-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-pw-ink">{getMethodLabel(draft)} <span className="font-medium text-pw-muted">· {draft.currency === "USD" ? "USD" : "Córdobas"}</span></p>
                    <p className="mt-0.5 text-xs text-pw-muted">Recibido {formatReceived(received, draft.currency)} · Aplicado {money.format(payment.productAmount)}</p>
                    {payment.changeGivenNio > 0 ? <p className="mt-0.5 text-xs font-semibold text-pw-brand-deep">Cambio a entregar: {money.format(payment.changeGivenNio)}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openEditDialog(index)} aria-label={`Editar pago ${index + 1}`} className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-bold text-pw-ink hover:border-pw-brand hover:text-pw-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand">Editar</button>
                    <button type="button" onClick={() => removePayment(index)} aria-label={`Quitar pago ${index + 1}`} className="grid min-h-9 w-9 place-items-center rounded-lg text-pw-muted hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M8.5 9v4m3-4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-pw-muted">Saldo pendiente después de los pagos: <strong className="text-pw-ink">{money.format(remainingBalance)}</strong></p>
        </>
      ) : (
        <p className="text-sm text-pw-muted">Aún no se ha agregado ningún pago inicial.</p>
      )}

      <button
        type="button"
        onClick={openAddDialog}
        disabled={remainingBalance <= 0}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-pw-brand px-3 text-sm font-bold text-pw-brand transition-colors hover:bg-pw-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        Agregar pago
      </button>

      {dialogOpen ? <dialog
        ref={dialogRef}
        aria-labelledby="sale-payment-dialog-title"
        onClose={() => setDialogOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50"
      >
        <PaymentDialogContent
          editing={editingIndex !== null}
          initialDraft={editingIndex === null ? emptyPayment() : drafts[editingIndex]}
          drafts={drafts}
          editingIndex={editingIndex}
          estimatedBalance={estimatedBalance}
          calculate={calculate}
          currentRemainingBalance={remainingBalance}
          availableBalance={editingIndex === null
            ? remainingBalance
            : roundMoney(remainingBalance + (payments[editingIndex]?.productAmount ?? 0))}
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

function PaymentDialogContent({ editing, initialDraft, drafts, editingIndex, estimatedBalance, calculate, currentRemainingBalance, availableBalance, storeRate, exchangeRateStatus, paymentOptions, onCancel, onSave }: {
  editing: boolean;
  initialDraft: PaymentDraft;
  drafts: PaymentDraft[];
  editingIndex: number | null;
  estimatedBalance: number;
  calculate: (draft: PaymentDraft, balance: number) => PaymentCalculation | null;
  currentRemainingBalance: number;
  availableBalance: number;
  storeRate: number | null;
  exchangeRateStatus: string;
  paymentOptions: { value: string; label: string }[];
  onCancel: () => void;
  onSave: (draft: PaymentDraft) => void;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PaymentDraft>(initialDraft);
  const [error, setError] = useState("");
  const calculation = calculate(draft, availableBalance);
  const projectedRemainingBalance = useMemo(() => {
    const previewDrafts = editingIndex === null
      ? [...drafts, draft]
      : drafts.map((existingDraft, index) => index === editingIndex ? draft : existingDraft);
    let remaining = Math.max(0, estimatedBalance);
    for (const previewDraft of previewDrafts) {
      const preview = calculate(previewDraft, remaining);
      if (preview) remaining = roundMoney(Math.max(0, remaining - preview.applied));
    }
    return remaining;
  }, [calculate, draft, drafts, editingIndex, estimatedBalance]);
  const amount = Number(draft.received);
  const exceedsAvailableBalance = Boolean(calculation?.exceedsBalance);
  const valid = Number.isFinite(amount)
    && amount > 0
    && (draft.currency === "NIO" || Boolean(storeRate))
    && !exceedsAvailableBalance
    && (availableBalance <= 0 || Boolean(calculation?.applied));
  const coversAvailableBalance = calculation && draft.methodId !== 3
    ? calculation.converted >= availableBalance
    : false;

  useEffect(() => {
    setError("");
    requestAnimationFrame(() => amountRef.current?.focus());
  }, [editing]);

  const handleSave = () => {
    if (!valid) {
      setError(draft.currency === "USD" && !storeRate
        ? "No hay una tasa de cambio disponible para registrar pagos en dólares."
        : exceedsAvailableBalance
          ? "El monto no puede superar el saldo disponible para este pago."
        : amount > 0 && availableBalance > 0 && !calculation?.applied
          ? "El monto es demasiado pequeño para aplicarse al saldo."
          : "Ingresa un monto recibido mayor que cero.");
      amountRef.current?.focus();
      return;
    }
    onSave(draft);
  };

  return (
    <div>
      <header className="flex items-start justify-between gap-4 border-b border-pw-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="sale-payment-dialog-title" className="text-lg font-extrabold">{editing ? "Editar pago" : "Agregar pago"}</h2>
          <p className="mt-1 text-sm text-pw-muted">Saldo pendiente actual: {money.format(currentRemainingBalance)}.</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cerrar" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-lg text-pw-muted hover:bg-pw-brand-soft hover:text-pw-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand">×</button>
      </header>

      <div className="grid gap-4 px-5 py-5 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
            Método de pago
            <SelectControl
              id="sale-payment-method"
              aria-label="Método de pago"
              value={draft.methodId === 3 ? `terminal:${draft.terminalId}` : String(draft.methodId)}
              options={paymentOptions}
              onChange={(event) => {
                const value = event.target.value;
                if (value.startsWith("terminal:")) setDraft({ ...draft, methodId: 3, terminalId: value.slice("terminal:".length), currency: "NIO" });
                else setDraft({ ...draft, methodId: Number(value), terminalId: "" });
                setError("");
              }}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
            Moneda recibida
            <SelectControl
              id="sale-payment-currency"
              aria-label="Moneda recibida"
              value={draft.currency}
              disabled={draft.methodId === 3}
              options={[
                { value: "NIO", label: "Córdobas (C$)" },
                { value: "USD", label: "Dólares (USD)", disabled: !storeRate },
              ]}
              onChange={(event) => { setDraft({ ...draft, currency: event.target.value as PaymentDraft["currency"] }); setError(""); }}
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-xs font-extrabold text-pw-muted">
          {draft.methodId === 2 ? "Monto transferido" : "Monto recibido"}
          <span className="flex min-h-11 items-center overflow-hidden rounded-lg border border-pw-line bg-white focus-within:border-pw-brand focus-within:ring-2 focus-within:ring-pw-brand/20">
            <span className="px-3 text-sm font-semibold text-pw-muted" aria-hidden="true">{draft.currency === "USD" ? "$" : "C$"}</span>
            <input
              ref={amountRef}
              aria-label={draft.methodId === 2 ? "Monto transferido" : "Monto recibido"}
              type="number"
              min="0"
              max={draft.methodId === 3 ? availableBalance : undefined}
              step="0.01"
              placeholder="0.00"
              inputMode="decimal"
              aria-invalid={exceedsAvailableBalance}
              value={draft.received}
              onChange={(event) => { setDraft({ ...draft, received: event.target.value }); setError(""); }}
              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-pw-ink outline-none"
            />
          </span>
        </label>

        {draft.currency === "USD" && storeRate ? <p className="-mt-2 text-xs text-pw-muted">Tasa disponible: {money.format(storeRate)} por dólar.</p> : null}
        {draft.currency === "USD" && !storeRate && exchangeRateStatus === "error" ? <p role="alert" className="text-xs text-amber-800">No se pudo cargar la tasa; el pago en dólares no está disponible.</p> : null}

        <dl aria-live="polite" className="grid gap-2 rounded-xl bg-pw-canvas p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-pw-muted">Equivalente recibido</dt>
            <dd className="m-0 font-semibold tabular-nums">{calculation ? money.format(calculation.converted) : money.format(0)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-pw-line pt-2">
            <dt className="font-bold">Se aplicará a la venta</dt>
            <dd className="m-0 font-extrabold tabular-nums">{calculation ? money.format(calculation.applied) : money.format(0)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-pw-line pt-2">
            <dt className={`font-bold ${exceedsAvailableBalance ? "text-red-700" : ""}`}>
              {exceedsAvailableBalance
                ? "Excede el saldo disponible"
                : coversAvailableBalance ? "Cambio a entregar" : "Saldo pendiente"}
            </dt>
            <dd className={`m-0 font-extrabold tabular-nums ${exceedsAvailableBalance ? "text-red-700" : coversAvailableBalance ? "text-pw-brand-deep" : "text-pw-ink"}`}>
              {exceedsAvailableBalance && calculation
                ? money.format(calculation.converted - availableBalance)
                : calculation
                  ? money.format(coversAvailableBalance ? calculation.change : projectedRemainingBalance)
                  : money.format(projectedRemainingBalance)}
            </dd>
          </div>
        </dl>

        {exceedsAvailableBalance
          ? <p role="alert" className="text-sm font-semibold text-red-700">El monto de tarjeta no puede superar el saldo disponible para este pago.</p>
          : error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>

      <footer className="flex justify-end gap-2 border-t border-pw-line px-5 py-4 sm:px-6">
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-pw-line px-4 text-sm font-bold text-pw-ink hover:bg-pw-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand">Cancelar</button>
        <button type="button" onClick={handleSave} disabled={!valid} className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-bold text-white hover:bg-pw-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pw-brand disabled:cursor-not-allowed disabled:opacity-50">{editing ? "Guardar cambios" : "Agregar pago"}</button>
      </footer>
    </div>
  );
}
