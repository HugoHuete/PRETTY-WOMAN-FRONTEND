import type { ReactNode } from 'react';

type StatusBadgeProps = {
  children: ReactNode;
  icon?: ReactNode;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
};

const toneClasses = {
  success: 'bg-green-50 text-green-800',
  warning: 'bg-amber-50 text-amber-900',
  danger: 'bg-red-50 text-red-800',
  info: 'bg-sky-50 text-sky-800',
  neutral: 'bg-stone-100 text-stone-700',
} as const;

export function StatusBadge({ children, icon, tone }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${toneClasses[tone]}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
