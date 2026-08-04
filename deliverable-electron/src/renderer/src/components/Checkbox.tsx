import type { InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@renderer/lib/cn';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export default function Checkbox({ label, description, className, ...rest }: Props) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 py-1.5', className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-5 flex-shrink-0">
        <input type="checkbox" {...rest} className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-pag-border transition checked:border-pag-red checked:bg-pag-red hover:border-pag-red" />
        <Check className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="min-w-0 flex-1 select-none">
        <span className="block text-sm font-medium text-pag-text">{label}</span>
        {description && <span className="block text-xs text-pag-text-muted">{description}</span>}
      </span>
    </label>
  );
}
