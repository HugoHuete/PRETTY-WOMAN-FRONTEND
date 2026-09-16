import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from "../../shared/ui/screen-state";
import { StatusBadge } from "../../shared/ui/status-badge";
import { InventoryIssueApiError, loadInventoryIssue } from "./inventory-issue-api";
import { inventoryIssueStatusTone, type InventoryIssue } from "./inventory-issue-types";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-pw-line bg-pw-canvas/40 p-4"><dt className="text-xs font-extrabold uppercase tracking-[0.04em] text-pw-muted">{label}</dt><dd className="mt-1 text-sm font-bold text-pw-ink">{children}</dd></div>;
}

function IssueDetail({ issue, currentSearch }: { issue: InventoryIssue; currentSearch: string }) {
  return <div className="space-y-5">
    <Link className="inline-flex min-h-11 items-center rounded-lg border border-pw-line bg-white px-4 text-sm font-extrabold text-pw-ink hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" aria-label="Volver a incidencias" to={`/inventory/issues${currentSearch}`}>← Volver a incidencias</Link>
    <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="issue-product-heading">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.05em] text-pw-muted">Incidencia INC-{issue.id}</p><h2 className="mt-1 text-2xl font-extrabold text-pw-ink" id="issue-product-heading">{issue.productName ?? "Producto sin nombre"}</h2><p className="mt-1 text-sm text-pw-muted">Código {issue.productCode ?? "—"} · {issue.variantName ?? "Sin variante"} · {issue.sizeName ?? "Sin talla"}</p></div><StatusBadge tone={inventoryIssueStatusTone(issue.status)}>{issue.statusName}</StatusBadge></div>
    </section>
    <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="issue-inventory-heading">
      <h2 className="text-lg font-extrabold text-pw-ink" id="issue-inventory-heading">Estado e inventario</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><DetailField label="Tipo">{issue.typeName}</DetailField><DetailField label="Cantidad afectada">{issue.quantity}</DetailField><DetailField label="Disponibilidad"><StatusBadge tone={issue.status === "open" ? "danger" : issue.status === "resolved" || issue.status === "cancelled" ? "success" : "neutral"}>{issue.availabilityImpact}</StatusBadge></DetailField></dl>
    </section>
    <section className="rounded-xl border border-pw-line bg-white p-5" aria-labelledby="issue-report-heading">
      <h2 className="text-lg font-extrabold text-pw-ink" id="issue-report-heading">Información de la incidencia</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><DetailField label="Reportada">{formatDate(issue.reportedAt)}</DetailField><DetailField label="Resuelta">{formatDate(issue.resolvedAt)}</DetailField><DetailField label="Creada">{formatDate(issue.createdAt)}</DetailField><DetailField label="Actualizada">{formatDate(issue.updatedAt)}</DetailField></dl>
      <div className="mt-4 rounded-lg border border-pw-line bg-pw-canvas/40 p-4"><h3 className="text-xs font-extrabold uppercase tracking-[0.04em] text-pw-muted">Comentarios</h3><p className="mt-2 whitespace-pre-wrap text-sm text-pw-ink">{issue.comments ?? "Sin comentarios registrados."}</p></div>
    </section>
  </div>;
}

export function InventoryIssueDetailPage() {
  const { request } = useAuth();
  const { setHeading } = usePageActions();
  const location = useLocation();
  const { id } = useParams();
  const [issue, setIssue] = useState<InventoryIssue | null>(null);
  const [error, setError] = useState<InventoryIssueApiError | Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    setHeading({ title: "Detalle de incidencia", breadcrumbs: "Incidencias" });
    return () => setHeading(null);
  }, [setHeading]);

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
  if (isLoading) return <LoadingState />;
  if (error instanceof InventoryIssueApiError && error.status === 403) return <PermissionDeniedState />;
  if (error instanceof InventoryIssueApiError && error.status === 404) return <EmptyState title="No encontramos esta incidencia" description={error.message} action={<Link className="inline-flex min-h-11 items-center rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2" to={`/inventory/issues${currentSearch}`}>Volver a incidencias</Link>} />;
  if (error) return <ErrorState title="No pudimos cargar la incidencia" description={error.message} onRetry={() => setRetryVersion((version) => version + 1)} />;
  return issue ? <IssueDetail currentSearch={currentSearch} issue={issue} /> : <EmptyState title="No encontramos esta incidencia" description="El detalle no está disponible." />;
}
