import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@renderer/lib/cn';

interface Props extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const PAD = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

export default function Card({
  padding = 'md',
  interactive,
  className,
  children,
  ...rest
}: PropsWithChildren<Props>) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-card border border-pag-border bg-pag-bg-surface shadow-card',
        interactive && 'transition-shadow duration-150 ease-pag hover:shadow-cardHover',
        PAD[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
