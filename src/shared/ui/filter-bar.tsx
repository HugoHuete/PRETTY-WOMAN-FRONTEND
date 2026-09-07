import type { FormHTMLAttributes, ReactNode } from 'react';

type FilterBarProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
};

export function FilterBar({ children, className = '', ...props }: FilterBarProps) {
  return (
    <form
      {...props}
      className={`flex flex-col gap-3 rounded-xl border border-pw-line bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end ${className}`}
    >
      {children}
    </form>
  );
}
