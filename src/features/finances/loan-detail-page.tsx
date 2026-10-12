import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "../../shared/ui/data-table";
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from "../../shared/ui/screen-state";
import { StatusBadge } from "../../shared/ui/status-badge";
import { useToast } from "../../shared/ui/toast-context";
import { FinanceApiError } from "./finance-api";
import { LoanFormDialog } from "./loan-form-dialog";
import { LoanPaymentDialog } from "./loan-payment-dialog";
import { deleteLoan, loadLoan, loadLoanOwners } from "./loans-api";
import type { Loan, LoanOwner, LoanPayment } from "./loans-types";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
}

function formatAmount(value: number, currency: "NIO" | "USD" = "NIO") {
  const formatted = new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency === "NIO" ? `C$ ${formatted}` : `US$ ${formatted}`;
}

function paymentColumns(onEdit: (payment: LoanPayment) => void): DataTableColumn<LoanPayment>[] {
  return [
    { key: "date", header: "Fecha", render: (payment) => <time dateTime={payment.paymentDate}>{formatDate(payment.paymentDate)}</time> },
    { key: "principal", header: "Abono al principal", render: (payment) => <span className="whitespace-nowrap tabular-nums">{formatAmount(payment.amount)}</span> },
    { key: "interest", header: "Intereses", render: (payment) => <span className="whitespace-nowrap tabular-nums">{formatAmount(payment.interestAmount)}</span> },
    { key: "total", header: "Total", render: (payment) => <span className="whitespace-nowrap font-bold tabular-nums">{formatAmount(payment.totalAmount)}</span> },
    { key: "comments", header: "Comentarios", render: (payment) => <span className="block max-w-[18rem] whitespace-normal text-pw-muted">{payment.comments || "—"}</span> },
    { key: "edit", header: "Acción", render: (payment) => <button aria-label={`Editar pago ${payment.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" onClick={() => onEdit(payment)} type="button">Editar</button> },
  ];
}

export function LoanDetailPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { request } = useAuth();
  const navigate = useNavigate();
  const { setAction, setHeading } = usePageActions();
  const { showToast } = useToast();
  const [loanState, setLoanState] = useState<{ id: number; loan?: Loan; error?: Error } | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<LoanPayment | undefined>();
  const [owners, setOwners] = useState<LoanOwner[] | null>(null);
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const loan = loanState?.id === id ? loanState.loan ?? null : null;
  const error = loanState?.id === id ? loanState.error ?? null : null;
  const isLoading = loanState?.id !== id;
  const payments = useMemo(() => loan?.payments ?? [], [loan]);
  const canEditLoan = Boolean(loan && payments.length === 0);

  useEffect(() => {
    setHeading({ title: "Detalle del préstamo", breadcrumbs: <Link className="underline underline-offset-4 hover:text-pw-brand-deep" to="/finances/loans">← Préstamos</Link> });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) {
      setLoanState({ id, error: new Error("El identificador del préstamo no es válido.") });
      return;
    }
    let active = true;
    void loadLoan(request, id)
      .then((next) => { if (active) setLoanState({ id, loan: next }); })
      .catch((caught: unknown) => { if (active) setLoanState({ id, error: caught instanceof Error ? caught : new Error("No se pudo cargar el préstamo.") }); });
    return () => { active = false; };
  }, [id, reloadVersion, request]);

  useEffect(() => {
    if (isLoading || error || !loan) {
      setAction(null);
      return () => setAction(null);
    }
    setAction(loan.isActive && loan.balance > 0 ? <button className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" onClick={() => { setSelectedPayment(undefined); setPaymentDialogOpen(true); }} type="button">Registrar pago</button> : null);
    return () => setAction(null);
  }, [error, isLoading, loan, setAction]);

  const loadOwnersForEdit = useCallback(async () => {
    if (owners) {
      setLoanDialogOpen(true);
      return;
    }
    setIsLoadingOwners(true);
    try {
      const result = await loadLoanOwners(request);
      setOwners(result);
      if (!result.some((owner) => owner.enabled)) {
        showToast({ tone: "error", title: "No hay responsables habilitados para editar el préstamo.", durationMs: 5000 });
        return;
      }
      setLoanDialogOpen(true);
    } catch (caught) {
      showToast({ tone: "error", title: caught instanceof Error ? caught.message : "No se pudieron cargar los responsables.", durationMs: 5000 });
    } finally {
      setIsLoadingOwners(false);
    }
  }, [owners, request, showToast]);

  const handleDelete = async () => {
    if (!loan || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteLoan(request, loan.id);
      setIsDeleteOpen(false);
      showToast({ tone: "success", title: "Préstamo eliminado correctamente.", durationMs: 4000 });
      navigate("/finances/loans");
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "No se pudo eliminar el préstamo.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <LoadingState />;
  if (error instanceof FinanceApiError && error.status === 403) return <PermissionDeniedState />;
  if (error) return <ErrorState title="No pudimos cargar el préstamo" description={error.message} onRetry={() => { setLoanState(null); setReloadVersion((version) => version + 1); }} />;
  if (!loan) return <ErrorState title="No pudimos cargar el préstamo" description="Intenta cargar la información de nuevo." onRetry={() => setReloadVersion((version) => version + 1)} />;

  const updateFromResponse = (updated: Loan, toastTitle: string) => {
    setLoanState({ id, loan: updated });
    setLoanDialogOpen(false);
    setPaymentDialogOpen(false);
    setSelectedPayment(undefined);
    showToast({ tone: "success", title: toastTitle, durationMs: 4000 });
  };

  return <div className="space-y-5">
    <LoanFormDialog open={loanDialogOpen} request={request} owners={owners ?? []} loan={loan} onClose={() => setLoanDialogOpen(false)} onSaved={(updated) => updateFromResponse(updated, "Préstamo actualizado correctamente.")} />
    <LoanPaymentDialog key={selectedPayment?.id ?? "new-payment"} open={paymentDialogOpen} request={request} loan={loan} payment={selectedPayment} onClose={() => { setPaymentDialogOpen(false); setSelectedPayment(undefined); }} onSaved={(updated) => updateFromResponse(updated, selectedPayment ? "Pago actualizado correctamente." : "Pago registrado correctamente.")} />
    <ConfirmDialog open={isDeleteOpen} title="Eliminar préstamo" description="Esta acción eliminará el préstamo y su movimiento financiero asociado. Solo se puede eliminar si todavía no tiene pagos." confirmLabel="Eliminar préstamo" error={deleteError} isPending={isDeleting} onClose={() => { setIsDeleteOpen(false); setDeleteError(null); }} onConfirm={() => void handleDelete()} />
    {canEditLoan ? <div className="flex flex-wrap justify-end gap-2">
      <button className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-extrabold text-pw-ink hover:bg-pw-canvas disabled:opacity-60" disabled={isLoadingOwners} onClick={() => void loadOwnersForEdit()} type="button">{isLoadingOwners ? "Cargando…" : "Editar préstamo"}</button>
      <button className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-extrabold text-red-700 hover:bg-red-50" onClick={() => { setDeleteError(null); setIsDeleteOpen(true); }} type="button">Eliminar préstamo</button>
    </div> : null}
    <section aria-label="Resumen del préstamo" className="rounded-xl border border-pw-line bg-white p-5">
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryValue label="Responsable" value={loan.loanOwnerName} />
        <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Estado</dt><dd className="mt-1"><StatusBadge tone={loan.isActive ? "success" : "neutral"}>{loan.isActive ? "Activo" : "Cerrado"}</StatusBadge></dd></div>
        <SummaryValue label="Fecha del préstamo" value={formatDate(loan.loanDate)} />
        <SummaryValue label="Monto inicial" value={formatAmount(loan.initialAmount)} />
        <SummaryValue label="Equivalente inicial (USD)" value={formatAmount(loan.initialAmountUsd, "USD")} />
        <SummaryValue label="Saldo pendiente" value={formatAmount(loan.balance)} />
        <SummaryValue label="Intereses pagados" value={formatAmount(loan.interestPaidAmount)} />
        <SummaryValue label="Tipo de cambio" value={`C$ ${new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(loan.exchangeRate)} por USD`} />
        <SummaryValue label="Registrado" value={formatDate(loan.createdAt)} />
        <SummaryValue label="Cerrado" value={formatDate(loan.closedAt)} />
        <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Comentarios</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-pw-ink">{loan.comments || "—"}</dd></div>
      </dl>
    </section>
    <section aria-labelledby="loan-payments-title" className="space-y-4 rounded-xl border border-pw-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h2 className="text-lg font-black text-pw-ink" id="loan-payments-title">Historial de pagos</h2><p className="text-sm text-pw-muted">{payments.length} {payments.length === 1 ? "pago registrado" : "pagos registrados"}</p></div>
      {payments.length ? <DataTable caption={`Pagos del préstamo ${loan.id}`} columns={paymentColumns((payment) => { setSelectedPayment(payment); setPaymentDialogOpen(true); })} rows={payments} rowKey={(payment) => String(payment.id)} /> : <EmptyState title="Aún no hay pagos" description="Los pagos registrados para este préstamo aparecerán aquí." />}
    </section>
  </div>;
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">{label}</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-pw-ink">{value}</dd></div>;
}
