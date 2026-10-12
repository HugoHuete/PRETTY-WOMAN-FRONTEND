import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { SelectControl, type SelectOption } from "../../shared/ui/select-control";
import {
  createFinanceMovement,
  updateFinanceMovement,
  financeMovementTypeLabel,
  isManualFinancialMovementType,
  loadExpenseCategories,
  type AuthenticatedRequest,
} from "./finance-api";
import type { FinancialMovement, FinancialMovementType } from "./finance-types";

type ExpenseCategory = { id: number; name: string };
type CategoryState = { status: "loading" } | { status: "loaded"; categories: ExpenseCategory[] } | { status: "error"; message: string };

const controlClassName = "min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30";
const manualTypeDirection: SelectOption[] = [
  { value: "", label: "Selecciona una dirección" },
  { value: "1", label: "Ingreso" },
  { value: "2", label: "Egreso" },
];

function getTodayDateInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function getLocalDateInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function movementTimestampForDate(dateValue: string, movement?: FinancialMovement) {
  if (!dateValue) return undefined;
  if (!movement) return new Date(`${dateValue}T00:00:00`).toISOString();
  if (dateValue === getLocalDateInputValue(movement.movementDate)) return movement.movementDate;

  const originalDate = new Date(movement.movementDate);
  const time = [originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  const milliseconds = String(originalDate.getMilliseconds()).padStart(3, "0");
  return new Date(`${dateValue}T${time}.${milliseconds}`).toISOString();
}

export function FinanceMovementCreateDialog({
  isOpen,
  onOpenChange,
  request,
  movementTypes,
  movement,
  onSaved,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  request: AuthenticatedRequest;
  movementTypes: FinancialMovementType[];
  movement?: FinancialMovement;
  onSaved: () => void;
}) {
  const manualTypes = useMemo(() => movementTypes.filter((type) => isManualFinancialMovementType(type.name)), [movementTypes]);
  const [selectedTypeId, setSelectedTypeId] = useState(() => movement ? String(movement.financialMovementTypeId) : "");
  const [selectedDirectionId, setSelectedDirectionId] = useState(() => movement?.movementDirectionId === 1 || movement?.movementDirectionId === 2 ? String(movement.movementDirectionId) : "");
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState(() => movement?.expenseCategoryId == null ? "" : String(movement.expenseCategoryId));
  const [categoryState, setCategoryState] = useState<CategoryState | null>(null);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const selectedType = manualTypes.find((type) => String(type.id) === selectedTypeId);
  const isExpense = selectedType?.name === "Expense";
  const isAdjustment = selectedType?.name === "Adjustment";

  useEffect(() => {
    if (!isOpen || !isExpense) return;
    let active = true;
    void loadExpenseCategories(request)
      .then((categories) => { if (active) setCategoryState({ status: "loaded", categories }); })
      .catch((caught: unknown) => {
        if (active) setCategoryState({ status: "error", message: caught instanceof Error ? caught.message : "No se pudieron cargar las categorías de gasto." });
      });
    return () => { active = false; };
  }, [categoryRetry, isExpense, isOpen, request]);

  const closeDialog = () => {
    if (isSubmitting) return;
    onOpenChange(false);
    if (!movement) {
      setSelectedTypeId("");
      setSelectedDirectionId("");
      setSelectedExpenseCategoryId("");
    }
    setCategoryState(null);
    setSubmitError(null);
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedTypeId(event.target.value);
    setSelectedDirectionId("");
    setSelectedExpenseCategoryId("");
    setCategoryState(null);
    setSubmitError(null);
  };

  const retryCategories = () => {
    setCategoryState(null);
    setCategoryRetry((retry) => retry + 1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedType) {
      setSubmitError("Selecciona un tipo de movimiento.");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    const movementDirectionId = String(data.get("movementDirectionId") ?? "");
    const expenseCategoryId = String(data.get("expenseCategoryId") ?? "");
    if (isAdjustment && !movementDirectionId) {
      setSubmitError("Selecciona la dirección del ajuste.");
      return;
    }
    if (isExpense && !expenseCategoryId) {
      setSubmitError("Selecciona una categoría de gasto.");
      return;
    }
    if (!form.reportValidity()) return;
    const movementDate = String(data.get("movementDate") ?? "");
    const comments = String(data.get("comments") ?? "").trim();
    const movementDateTimestamp = movementTimestampForDate(movementDate, movement);
    const commonInput = {
      description: String(data.get("description") ?? "").trim(),
      ...(movementDateTimestamp ? { movementDate: movementDateTimestamp } : {}),
      financialMovementTypeId: selectedType.id,
      amount: Number(data.get("amount")),
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (movement) {
        await updateFinanceMovement(request, movement.id, {
          description: commonInput.description,
          ...(movementDateTimestamp ? { movementDate: movementDateTimestamp } : {}),
          financialMovementTypeId: selectedType.id,
          ...(isAdjustment ? { movementDirectionId: Number(movementDirectionId) } : {}),
          expenseCategoryId: isExpense ? Number(expenseCategoryId) : null,
          amount: commonInput.amount,
          comments: comments || null,
        });
      } else {
        await createFinanceMovement(request, {
          description: commonInput.description,
          ...(movementDateTimestamp ? { movementDate: movementDateTimestamp } : {}),
          financialMovementTypeId: selectedType.id,
          ...(isAdjustment ? { movementDirectionId: Number(movementDirectionId) } : {}),
          ...(isExpense ? { expenseCategoryId: Number(expenseCategoryId) } : {}),
          amount: commonInput.amount,
          ...(comments ? { comments } : {}),
        });
      }
      closeAfterSuccess();
      onSaved();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No se pudo registrar el movimiento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeAfterSuccess = () => {
    onOpenChange(false);
    setSelectedTypeId("");
    setSelectedDirectionId("");
    setSelectedExpenseCategoryId("");
    setCategoryState(null);
    setSubmitError(null);
  };

  const categoryOptions: SelectOption[] = categoryState?.status === "loaded"
    ? [{ value: "", label: "Selecciona una categoría" }, ...categoryState.categories.map((category) => ({ value: String(category.id), label: category.name }))]
    : [{ value: "", label: "Cargando categorías…" }];
  const visibleCategoryState = isExpense ? categoryState ?? { status: "loading" as const } : null;
  const canSubmit = !isSubmitting && (!isExpense || visibleCategoryState?.status === "loaded" && visibleCategoryState.categories.length > 0);

  return <>
    {isOpen ? <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
      onKeyDown={(event) => { if (event.key === "Escape") closeDialog(); }}
    >
      <section aria-labelledby="finance-create-title" aria-modal="true" className="max-h-[min(90vh,48rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-pw-line bg-white shadow-xl" role="dialog" aria-label={movement ? "Editar movimiento" : "Registrar movimiento"}>
        <header className="flex items-start justify-between gap-4 border-b border-pw-line p-5">
          <div>
            <h2 className="text-lg font-extrabold text-pw-ink" id="finance-create-title">{movement ? "Editar movimiento" : "Registrar movimiento"}</h2>
          </div>
          <button aria-label="Cerrar" className="grid size-10 shrink-0 place-items-center rounded-lg border border-pw-line text-lg font-bold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep" disabled={isSubmitting} onClick={closeDialog} type="button">×</button>
        </header>
        <form className="grid gap-4 p-5" onSubmit={(event) => { void handleSubmit(event); }}>
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="finance-create-type">
            Tipo de movimiento
            <SelectControl aria-label="Tipo de movimiento" id="finance-create-type" name="financialMovementTypeId" value={selectedTypeId} options={[{ value: "", label: "Selecciona un tipo" }, ...manualTypes.map((type) => ({ value: String(type.id), label: financeMovementTypeLabel(type.id, type.name) }))]} onChange={handleTypeChange} required />
          </label>
          {isAdjustment ? <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="finance-create-direction">
            Dirección
            <SelectControl aria-label="Dirección del ajuste" id="finance-create-direction" name="movementDirectionId" value={selectedDirectionId} options={manualTypeDirection} onChange={(event) => setSelectedDirectionId(event.target.value)} required />
          </label> : null}
          {isExpense ? <div className="grid gap-1.5 text-sm font-bold text-pw-ink">
            <label htmlFor="finance-create-category">Categoría de gasto</label>
            {visibleCategoryState?.status === "loading" ? <p className="text-sm font-normal text-pw-muted" role="status">Cargando categorías de gasto…</p> : null}
            {visibleCategoryState?.status === "error" ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert"><span>{visibleCategoryState.message}</span><button className="font-bold underline underline-offset-2" onClick={retryCategories} type="button">Reintentar</button></div> : null}
            {visibleCategoryState?.status === "loaded" && visibleCategoryState.categories.length > 0 ? <SelectControl aria-label="Categoría de gasto" id="finance-create-category" name="expenseCategoryId" value={selectedExpenseCategoryId} options={categoryOptions} onChange={(event) => setSelectedExpenseCategoryId(event.target.value)} required /> : null}
            {visibleCategoryState?.status === "loaded" && visibleCategoryState.categories.length === 0 ? <p className="text-sm font-normal text-pw-muted" role="status">No hay categorías de gasto disponibles.</p> : null}
          </div> : null}
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="finance-create-description">Descripción<input autoFocus={!selectedType} className={controlClassName} defaultValue={movement?.description ?? ""} id="finance-create-description" maxLength={250} name="description" placeholder="Ej. Compra de empaques" required /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="finance-create-amount">Monto<input className={controlClassName} defaultValue={movement?.amount} id="finance-create-amount" min="0.01" name="amount" required step="0.01" type="number" /></label>
            <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="finance-create-date">Fecha<input className={controlClassName} defaultValue={movement ? getLocalDateInputValue(movement.movementDate) : getTodayDateInputValue()} id="finance-create-date" name="movementDate" type="date" /></label>
          </div>
          <label className="grid gap-1.5 text-sm font-bold text-pw-ink" htmlFor="finance-create-comments">Comentarios<textarea className={`${controlClassName} min-h-24 py-2`} defaultValue={movement?.comments ?? ""} id="finance-create-comments" maxLength={1000} name="comments" /></label>
          {submitError ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{submitError}</p> : null}
          <footer className="flex flex-col-reverse justify-end gap-2 border-t border-pw-line pt-4 sm:flex-row">
            <button className="min-h-11 rounded-lg border border-pw-line px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} onClick={closeDialog} type="button">Cancelar</button>
            <button className="min-h-11 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep disabled:cursor-not-allowed disabled:opacity-60" disabled={!canSubmit} type="submit">{isSubmitting ? "Guardando…" : movement ? "Guardar cambios" : "Guardar movimiento"}</button>
          </footer>
        </form>
      </section>
    </div> : null}
  </>;
}
