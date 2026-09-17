import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { SelectControl } from "../../shared/ui/select-control";
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from "../../shared/ui/screen-state";
import { StatusBadge } from "../../shared/ui/status-badge";
import { deleteInventoryIssue, InventoryIssueApiError, loadInventoryIssue, resolveInventoryIssue } from "./inventory-issue-api";
import { inventoryIssueResolutionOptions, inventoryIssueStatusTone, type InventoryIssue } from "./inventory-issue-types";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
}

function DetailField({ label, children, className = "min-w-0" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><dt className="text-xs font-extrabold uppercase tracking-[0.04em] text-pw-muted">{label}</dt><dd className="mt-1 text-sm font-bold text-pw-ink">{children}</dd></div>; }

function IssueResolutionDialog({
  open,
  statusId,
  error,
  isPending,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  statusId: string;
  error: string | null;
  isPending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-pw-ink/45 p-4" role="presentation">
    <form aria-labelledby="resolve-issue-title" aria-modal="true" className="w-full max-w-md rounded-xl border border-pw-line bg-white p-6 shadow-xl" role="dialog" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.08em] text-pw-brand-deep">Inventario</p><h2 className="mt-1 text-xl font-extrabold text-pw-ink" id="resolve-issue-title">Resolver incidencia</h2></div><button aria-label="Cerrar resolución" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-pw-line text-xl text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" disabled={isPending} type="button" onClick={onClose}>×</button></div>
      <label className="mt-5 grid gap-1.5 text-sm font-extrabold text-pw-ink" htmlFor="resolve-issue-status">Resultado de la incidencia<SelectControl aria-label="Estado de resolución" id="resolve-issue-status" value={statusId} disabled={isPending} options={[{ value: "", label: "Selecciona un resultado" }, ...inventoryIssueResolutionOptions.map((option) => ({ value: String(option.id), label: option.label }))]} onChange={(event) => onChange(event.target.value)} /></label>
      {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className="min-h-11 rounded-lg border border-pw-line px-4 font-bold text-pw-ink hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" disabled={isPending} type="button" onClick={onClose}>Cancelar</button><button className="min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending || !statusId} type="submit">{isPending ? "Resolviendo…" : "Resolver incidencia"}</button></div>
    </form>
  </div>;
}

function IssueDetail({ issue }: { issue: InventoryIssue }) { return <div className="space-y-4"><section className="rounded-xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="issue-product-heading"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.05em] text-pw-muted">Incidencia INC-{issue.id}</p><h2 className="mt-1 text-2xl font-extrabold leading-tight text-pw-ink" id="issue-product-heading">{issue.productName ?? "Producto sin nombre"}</h2><p className="mt-2 text-sm text-pw-muted">Código {issue.productCode ?? "—"} · {issue.variantName ?? "Sin variante"} · {issue.sizeName ?? "Sin talla"}</p></div><StatusBadge tone={inventoryIssueStatusTone(issue.status)}>{issue.statusName}</StatusBadge></div></section><section className="rounded-xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="issue-inventory-heading"><div className="flex items-end justify-between gap-4"><h2 className="text-lg font-extrabold text-pw-ink" id="issue-inventory-heading">Estado e inventario</h2><span className="hidden text-xs font-bold uppercase tracking-[0.04em] text-pw-muted sm:inline">Resumen actual</span></div><dl className="mt-4 grid overflow-hidden rounded-lg border border-pw-line bg-pw-canvas/35 divide-y divide-pw-line sm:grid-cols-3 sm:divide-x sm:divide-y-0"><DetailField className="px-4 py-4" label="Tipo">{issue.typeName}</DetailField><DetailField className="px-4 py-4" label="Cantidad afectada">{issue.quantity}</DetailField><DetailField className="px-4 py-4" label="Disponibilidad"><StatusBadge tone={issue.status === "open" ? "danger" : issue.status === "resolved" || issue.status === "cancelled" ? "success" : "neutral"}>{issue.availabilityImpact}</StatusBadge></DetailField></dl></section><section className="rounded-xl border border-pw-line bg-white p-5 sm:p-6" aria-labelledby="issue-report-heading"><h2 className="text-lg font-extrabold text-pw-ink" id="issue-report-heading">Información de la incidencia</h2><dl className="mt-3 grid gap-x-8 sm:grid-cols-2"><DetailField className="border-b border-pw-line py-4 sm:pr-4" label="Reportada">{formatDate(issue.reportedAt)}</DetailField><DetailField className="border-b border-pw-line py-4 sm:pl-4" label="Resuelta">{formatDate(issue.resolvedAt)}</DetailField><DetailField className="border-b border-pw-line py-4 sm:pr-4" label="Creada">{formatDate(issue.createdAt)}</DetailField><DetailField className="border-b border-pw-line py-4 sm:pl-4" label="Actualizada">{formatDate(issue.updatedAt)}</DetailField></dl><section className="mt-5 rounded-lg bg-pw-canvas/50 p-4 sm:p-5" aria-labelledby="issue-comments-heading"><h3 className="text-xs font-extrabold uppercase tracking-[0.04em] text-pw-muted" id="issue-comments-heading">Comentarios</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-pw-ink">{issue.comments ?? "Sin comentarios registrados."}</p></section></section></div>; }

export function InventoryIssueDetailPage() {
  const { request, session } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [issue, setIssue] = useState<InventoryIssue | null>(null);
  const [error, setError] = useState<InventoryIssueApiError | Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryVersion, setRetryVersion] = useState(0);
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  const [resolutionStatusId, setResolutionStatusId] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);

  useEffect(() => {
    setHeading({ title: "Detalle de incidencia", breadcrumbs: <Link className="inline-flex items-center underline underline-offset-4 hover:text-pw-brand-deep" to={`/inventory/issues${location.search}`}>← Regresar a incidencias</Link> });
    return () => setHeading(null);
  }, [location.search, setHeading]);

  const isAdmin = Boolean(session?.user.roles.includes("Admin"));
  const canManageIssue = Boolean(isAdmin && issue?.status === "open");

  useEffect(() => {
    setAction(canManageIssue ? <div className="flex flex-wrap gap-2"><button className="inline-flex min-h-10 items-center rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" type="button" onClick={() => { setMutationError(null); setIsResolutionOpen(true); }}>Resolver incidencia</button><button className="inline-flex min-h-10 items-center rounded-lg border border-red-200 bg-white px-4 text-sm font-extrabold text-red-700 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-red-700 focus-visible:outline-offset-2" type="button" onClick={() => { setMutationError(null); setIsDeleteConfirmationOpen(true); }}>Eliminar incidencia</button></div> : null);
    return () => setAction(null);
  }, [canManageIssue, setAction]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setIssue(null);
    if (!id) {
      setError(new InventoryIssueApiError(404, "No encontramos esta incidencia."));
      setIsLoading(false);
      return () => { active = false; };
    }
    void loadInventoryIssue(request, id)
      .then((next) => { if (active) setIssue(next); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught : new Error("No se pudo cargar la incidencia.")); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [id, request, retryVersion]);

  const currentSearch = location.search;

  async function handleResolve() {
    if (!id || !resolutionStatusId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      const nextIssue = await resolveInventoryIssue(request, id, Number(resolutionStatusId));
      setIssue(nextIssue);
      setIsResolutionOpen(false);
      setResolutionStatusId("");
    } catch (caught: unknown) {
      setMutationError(caught instanceof Error ? caught.message : "No se pudo resolver la incidencia.");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete() {
    if (!id || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      await deleteInventoryIssue(request, id);
      navigate(`/inventory/issues${currentSearch}`);
    } catch (caught: unknown) {
      setMutationError(caught instanceof Error ? caught.message : "No se pudo eliminar la incidencia.");
    } finally {
      setIsMutating(false);
    }
  }
  if (isLoading) return <LoadingState />;
  if (error instanceof InventoryIssueApiError && error.status === 403) return <PermissionDeniedState />;
  if (error instanceof InventoryIssueApiError && error.status === 404) return <EmptyState title="No encontramos esta incidencia" description={error.message} action={<Link className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" to={`/inventory/issues${currentSearch}`}>Volver a incidencias</Link>} />;
  if (error) return <ErrorState title="No pudimos cargar la incidencia" description={error.message} onRetry={() => setRetryVersion((version) => version + 1)} />;
  return issue ? <><IssueDetail issue={issue} /><IssueResolutionDialog open={isResolutionOpen} statusId={resolutionStatusId} error={mutationError} isPending={isMutating} onChange={setResolutionStatusId} onSubmit={() => void handleResolve()} onClose={() => { if (!isMutating) { setIsResolutionOpen(false); setMutationError(null); } }} /><ConfirmDialog open={isDeleteConfirmationOpen} title="Eliminar incidencia" description="La incidencia se marcará como cancelada y la cantidad volverá a estar disponible. ¿Deseas continuar?" confirmLabel="Eliminar incidencia" error={mutationError} isPending={isMutating} onConfirm={() => void handleDelete()} onClose={() => { if (!isMutating) { setIsDeleteConfirmationOpen(false); setMutationError(null); } }} /></> : <EmptyState title="No encontramos esta incidencia" description="El detalle no está disponible." />;
}
