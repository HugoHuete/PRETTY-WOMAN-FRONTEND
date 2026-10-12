import { useEffect, useState, type FormEvent } from "react";
import { SelectControl } from "../../shared/ui/select-control";
import type { AuthenticatedRequest } from "./finance-api";
import { createLoan, updateLoan } from "./loans-api";
import {
  localDateTimeInputValue,
  localDateTimeInputValueFromIso,
  utcIsoFromLocalDateTime,
} from "./loan-date-time";
import type { Loan, LoanOwner } from "./loans-types";

const controlClassName = "min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30";

type LoanFormValues = {
  loanDate: string;
  loanOwnerId: string;
  initialAmount: string;
  comments: string;
};

function formValuesFromLoan(loan?: Loan): LoanFormValues {
  return loan ? {
    loanDate: localDateTimeInputValueFromIso(loan.loanDate),
    loanOwnerId: String(loan.loanOwnerId),
    initialAmount: String(loan.initialAmount),
    comments: loan.comments ?? "",
  } : {
    loanDate: localDateTimeInputValue(),
    loanOwnerId: "",
    initialAmount: "",
    comments: "",
  };
}

export function LoanFormDialog({
  open,
  request,
  owners,
  loan,
  onClose,
  onSaved,
}: {
  open: boolean;
  request: AuthenticatedRequest;
  owners: LoanOwner[];
  loan?: Loan;
  onClose: () => void;
  onSaved: (loan: Loan) => void;
}) {
  const [values, setValues] = useState(() => formValuesFromLoan(loan));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const enabledOwners = owners.filter((owner) => owner.enabled);

  useEffect(() => {
    if (!open) return;
    setValues(formValuesFromLoan(loan));
    setError(null);
  }, [loan, open]);

  const updateValue = (field: keyof LoanFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const initialAmount = Number(values.initialAmount);
    const loanOwnerId = Number(values.loanOwnerId);
    if (!Number.isFinite(initialAmount) || initialAmount <= 0) {
      setError("El monto inicial debe ser mayor que cero.");
      return;
    }
    if (!enabledOwners.some((owner) => owner.id === loanOwnerId)) {
      setError("Selecciona un responsable habilitado.");
      return;
    }
    if (values.comments.length > 500) {
      setError("Los comentarios no pueden superar 500 caracteres.");
      return;
    }

    const loanDate = utcIsoFromLocalDateTime(values.loanDate);
    const input = {
      ...(loanDate ? { loanDate } : {}),
      loanOwnerId,
      initialAmount,
      comments: values.comments.trim() || null,
    };

    setIsSaving(true);
    setError(null);
    try {
      const saved = loan
        ? await updateLoan(request, loan.id, input)
        : await createLoan(request, input);
      onSaved(saved);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el préstamo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-pw-ink/45 p-4" role="presentation">
    <section aria-labelledby="loan-form-title" aria-modal="true" className="w-full max-w-2xl rounded-xl border border-pw-line bg-white shadow-xl" role="dialog">
      <header className="flex items-start justify-between gap-4 border-b border-pw-line p-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-pw-brand-deep">Finanzas</p>
          <h2 className="mt-1 text-xl font-black text-pw-ink" id="loan-form-title">{loan ? "Editar préstamo" : "Nuevo préstamo"}</h2>
        </div>
        <button aria-label="Cerrar" className="grid size-10 place-items-center rounded-lg border border-pw-line text-lg text-pw-muted hover:bg-pw-canvas" disabled={isSaving} onClick={onClose} type="button">×</button>
      </header>
      <form className="space-y-5 p-5" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
        {enabledOwners.length === 0 ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">No hay responsables habilitados para asociar al préstamo.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="loan-owner">
            Responsable
            <SelectControl
              aria-label="Responsable"
              id="loan-owner"
              value={values.loanOwnerId}
              required
              disabled={enabledOwners.length === 0 || isSaving}
              options={[{ value: "", label: "Selecciona un responsable" }, ...enabledOwners.map((owner) => ({ value: String(owner.id), label: owner.name }))]}
              onChange={(event) => updateValue("loanOwnerId", event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="loan-date">
            Fecha y hora
            <input className={controlClassName} id="loan-date" type="datetime-local" value={values.loanDate} disabled={isSaving} onChange={(event) => updateValue("loanDate", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink sm:col-span-2" htmlFor="loan-amount">
            Monto inicial (C$)
            <input className={controlClassName} id="loan-amount" type="number" min="0.01" step="0.01" required value={values.initialAmount} disabled={isSaving} onChange={(event) => updateValue("initialAmount", event.target.value)} />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="loan-comments">
          Comentarios <span className="font-normal text-pw-muted">(opcional)</span>
          <textarea className={`${controlClassName} min-h-24 py-2`} id="loan-comments" maxLength={500} value={values.comments} disabled={isSaving} onChange={(event) => updateValue("comments", event.target.value)} />
        </label>
        <footer className="flex flex-col-reverse justify-end gap-2 border-t border-pw-line pt-4 sm:flex-row">
          <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas disabled:opacity-60" disabled={isSaving} onClick={onClose} type="button">Cancelar</button>
          <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving || enabledOwners.length === 0} type="submit">{isSaving ? "Guardando…" : loan ? "Guardar cambios" : "Crear préstamo"}</button>
        </footer>
      </form>
    </section>
  </div>;
}
