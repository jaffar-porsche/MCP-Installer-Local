import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff, HelpCircle } from 'lucide-react';

import { cn } from '@renderer/lib/cn';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: string;
  hint?: string;
  error?: string | null;
  secret?: boolean;
  helpUrl?: string | null;
  helpAction?: { label: string; onClick: () => void };
  required?: boolean;
  dense?: boolean;
}

const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, hint, error, secret, helpUrl, helpAction, required, dense, className, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  const isEmpty = !rest.value || String(rest.value).trim() === '';
  const showError = Boolean(error);
  const labelColor = required && isEmpty && !showError ? 'text-pag-red' : 'text-pag-text';

  return (
    <div className={cn('flex flex-col gap-1', dense ? 'py-1' : 'py-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className={cn('text-sm font-medium', labelColor)}>
          {label}
          {required && <span className="ml-1 text-pag-red">*</span>}
        </label>
        {helpUrl && (
          <button
            type="button"
            onClick={() => window.api.system.openExternal(helpUrl)}
            className="inline-flex items-center gap-1 text-xs text-pag-text-muted hover:text-pag-red"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Get PAT
          </button>
        )}
        {helpAction && (
          <button
            type="button"
            onClick={helpAction.onClick}
            className="inline-flex items-center gap-1 text-xs text-pag-text-muted hover:text-pag-red"
          >
            {helpAction.label}
          </button>
        )}
      </div>
      <div className="relative">
        <input
          ref={ref}
          type={secret && !show ? 'password' : 'text'}
          {...rest}
          className={cn(
            'w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition',
            'placeholder:text-pag-text-faint',
            showError
              ? 'border-pag-error focus:border-pag-error focus:ring-2 focus:ring-pag-error/25'
              : 'border-pag-border focus:border-pag-red focus:ring-2 focus:ring-pag-red/25',
            secret && 'pr-10',
          )}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-2 grid place-items-center text-pag-text-muted hover:text-pag-text"
            aria-label={show ? 'Hide value' : 'Show value'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {showError ? (
        <div className="text-xs text-pag-error">{error}</div>
      ) : hint ? (
        <div className="text-xs text-pag-text-muted">{hint}</div>
      ) : null}
    </div>
  );
});

export default TextField;
