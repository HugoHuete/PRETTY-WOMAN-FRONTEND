import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-pw-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs ? (
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-pw-muted">
            {breadcrumbs}
          </div>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-pw-ink sm:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-pw-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
