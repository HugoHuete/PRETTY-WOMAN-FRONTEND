import type { ReactNode } from 'react';

type StateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

function StateFrame({ title, description, action, role = 'status' }: StateProps & { role?: 'status' | 'alert' }) {
  return (
    <section className="grid min-h-48 place-items-center rounded-xl border border-dashed border-pw-line bg-white p-8 text-center" role={role}>
      <div>
        <h2 className="text-lg font-extrabold text-pw-ink">{title}</h2>
        {description ? <p className="mt-2 max-w-md text-sm text-pw-muted">{description}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </section>
  );
}

export function LoadingState() {
  return <StateFrame title="Cargando…" description="Estamos preparando la información." />;
}

export function EmptyState({ title, description, action }: StateProps) {
  return <StateFrame title={title} description={description} action={action} />;
}

export function ErrorState({ title, description, onRetry }: StateProps & { onRetry?: () => void }) {
  return (
    <StateFrame
      role="alert"
      title={title}
      description={description}
      action={
        onRetry ? (
          <button
            className="min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
            type="button"
            onClick={onRetry}
          >
            Reintentar
          </button>
        ) : undefined
      }
    />
  );
}

export function PermissionDeniedState() {
  return (
    <StateFrame
      title="Acceso restringido"
      description="No tienes permiso para ver esta sección."
    />
  );
}
