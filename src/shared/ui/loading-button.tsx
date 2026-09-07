import type { ButtonHTMLAttributes, ReactNode } from 'react';

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isLoading?: boolean;
};

export function LoadingButton({ children, isLoading = false, disabled, ...props }: LoadingButtonProps) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-lg bg-pw-brand px-4 font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ''}`}
      type={props.type ?? 'button'}
      disabled={isLoading || disabled}
      aria-busy={isLoading || undefined}
    >
      {children}
    </button>
  );
}
