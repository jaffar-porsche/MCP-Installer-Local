import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@renderer/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-pag-red text-white hover:bg-pag-red-hover active:bg-pag-red-dark shadow-sm disabled:bg-pag-text-faint disabled:shadow-none',
  secondary:
    'bg-pag-bg-surface text-pag-text border border-pag-border hover:bg-pag-bg-muted disabled:text-pag-text-faint disabled:bg-pag-bg-muted',
  ghost: 'text-pag-text hover:bg-pag-bg-muted disabled:text-pag-text-faint',
  danger:
    'bg-pag-error text-white hover:bg-pag-error/90 disabled:bg-pag-error/50',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-11 px-5 text-base rounded-md',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...rest
}: PropsWithChildren<Props>) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 ease-pag',
        'disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}
