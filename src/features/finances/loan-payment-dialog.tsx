import { useEffect, useState, type FormEvent } from "react";
import type { AuthenticatedRequest } from "./finance-api";
import { createLoanPayment, updateLoanPayment } from "./loans-api";
import {
  localDateTimeInputValue,
  localDateTimeInputValueFromIso,
  utcIsoFromLocalDateTime,
} from "./loan-date-time";
import type { Loan, LoanPayment } from "./loans-types";

const controlClassName = "min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30";

type PaymentFormValues = {
  paymentDate: string;
  amount: string;
  interestAmount: string;
  comments: string;
};

function formValuesFromPayment(payment?: LoanPayment): PaymentFormValues {
  return payment ? {
    paymentDate: localDateTimeInputValueFromIso(payment.paymentDate),
    amount: String(payment.amount),
    interestAmount: String(payment.interestAmount),
    comments: payment.comments ?? "",
  } : {
    paymentDate: localDateTimeInputValue(),
    amount: "",
    interestAmount: "0",
    comments: "",
  };
}

function formatCordobas(value: number) {
  return `C$ ${new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

export function LoanPaymentDialog({
  open,
  request,
  loan,
  payment,
  onClose,
  onSaved,
}: {
  open: boolean;
  request: AuthenticatedRequest;
  loan: Loan;
  payment?: LoanPayment;
  onClose: () => void;
  onSaved: (loan: Loan) => void;
}) {
  const [values, setValues] = useState(() => formValuesFromPayment(payment));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const availablePrincipal = loan.balance + (payment?.amount ?? 0);
  const amount = Number(values.amount);
  const interestAmount = Number(values.interestAmount);

  useEffect(() => {
    if (!open) return;
    setValues(formValuesFromPayment(payment));
    setError(null);
  }, [open, payment]);

  const updateValue = (field: keyof PaymentFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("El abono al principal debe ser mayor que cero.");
      return;
    }
    if (amount > availablePrincipal) {
      setError("El abono al principal no puede superar el saldo disponible.");
      return;
    }
    if (!Number.isFinite(interestAmount) || interestAmount < 0) {
      setError("Los intereses no pueden ser negativos.");
      return;
    }
    if (values.comments.length > 300) {
      setError("Los comentarios no pueden superar 300 caracteres.");
      return;
    }

    const paymentDate = utcIsoFromLocalDateTime(values.paymentDate);
    const input = {
      ...(paymentDate ? { paymentDate } : {}),
      amount,
      interestAmount,
      comments: values.comments.trim() || null,
    };

    setIsSaving(true);
    setError(null);
    try {
      const saved = payment
        ? await updateLoanPayment(request, loan.id, payment.id, input)
        : await createLoanPayment(request, loan.id, input);
      onSaved(saved);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el pago.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-pw-ink/45 p-4" role="presentation">
    <section aria-labelledby="loan-payment-title" aria-modal="true" className="w-full max-w-xl rounded-xl border border-pw-line bg-white shadow-xl" role="dialog">
      <header className="flex items-start justify-between gap-4 border-b border-pw-line p-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-pw-brand-deep">{loan.loanOwnerName}</p>
          <h2 className="mt-1 text-xl font-black text-pw-ink" id="loan-payment-title">{payment ? "Editar pago" : "Registrar pago"}</h2>
        </div>
        <button aria-label="Cerrar" className="grid size-10 place-items-center rounded-lg border border-pw-line text-lg text-pw-muted hover:bg-pw-canvas" disabled={isSaving} onClick={onClose} type="button">×</button>
      </header>
      <form className="space-y-5 p-5" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
        <p className="flex items-center justify-between rounded-lg bg-pw-canvas px-4 py-3 text-sm"><span className="font-semibold text-pw-muted">Saldo pendiente</span><strong className="tabular-nums text-pw-ink">{formatCordobas(loan.balance)}</strong></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink sm:col-span-2" htmlFor="loan-payment-date">
            Fecha y hora
            <input className={controlClassName} id="loan-payment-date" type="datetime-local" value={values.paymentDate} disabled={isSaving} onChange={(event) => updateValue("paymentDate", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="loan-payment-amount">
            Abono al principal (C$)
            <input className={controlClassName} id="loan-payment-amount" type="number" min="0.01" max={availablePrincipal} step="0.01" required value={values.amount} disabled={isSaving} onChange={(event) => updateValue("amount", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="loan-payment-interest">
            Intereses (C$)
            <input className={controlClassName} id="loan-payment-interest" type="number" min="0" step="0.01" required value={values.interestAmount} disabled={isSaving} onChange={(event) => updateValue("interestAmount", event.target.value)} />
          </label>
        </div>
        <p className="flex items-center justify-between text-sm"><span className="font-semibold text-pw-muted">Total del pago</span><strong className="tabular-nums text-pw-ink">{formatCordobas((Number.isFinite(amount) ? amount : 0) + (Number.isFinite(interestAmount) ? interestAmount : 0))}</strong></p>
        <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="loan-payment-comments">
          <span className="flex items-center gap-1.5"><span>Comentarios</span><span className="font-normal text-pw-muted">(opcional)</span></span>
          <textarea className={`${controlClassName} min-h-24 py-2`} id="loan-payment-comments" maxLength={300} value={values.comments} disabled={isSaving} onChange={(event) => updateValue("comments", event.target.value)} />
        </label>
        <footer className="flex flex-col-reverse justify-end gap-2 border-t border-pw-line pt-4 sm:flex-row">
          <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas disabled:opacity-60" disabled={isSaving} onClick={onClose} type="button">Cancelar</button>
          <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Guardando…" : payment ? "Guardar cambios" : "Registrar pago"}</button>
        </footer>
      </form>
    </section>
  </div>;
}
