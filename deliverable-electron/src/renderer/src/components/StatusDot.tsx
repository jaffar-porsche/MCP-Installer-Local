import type { HTMLAttributes } from 'react';
import { cn } from '@renderer/lib/cn';

type Tier = 'ok' | 'warning' | 'error' | 'neutral' | 'progress';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tier: Tier;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const COLORS: Record<Tier, string> = {
  ok: 'bg-pag-success',
  warning: 'bg-pag-warning',
  error: 'bg-pag-error',
  neutral: 'bg-pag-text-faint',
  progress: 'bg-pag-info',
};

const SIZES = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
};

export default function StatusDot({ tier, pulse, size = 'md', className, ...rest }: Props) {
  return (
    <span className={cn('relative inline-flex items-center justify-center', className)} {...rest}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            COLORS[tier],
            SIZES[size],
          )}
        />
      )}
      <span className={cn('relative inline-flex rounded-full', COLORS[tier], SIZES[size])} />
    </span>
  );
}
