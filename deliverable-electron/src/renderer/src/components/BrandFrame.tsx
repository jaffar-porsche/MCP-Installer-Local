import type { PropsWithChildren } from 'react';
import { cn } from '@renderer/lib/cn';

interface Props {
  variant: 'wizard' | 'panel';
}

/**
 * The BrandFrame is the persistent chrome around both windows:
 *   • Top wordmark "MCPorsche" + subtle red bar
 *   • Ambient canvas gradient
 *   • Footer "Powered by PEG-IT"
 *
 * Content is placed in the center scrollable area.
 */
export default function BrandFrame({ children, variant }: PropsWithChildren<Props>) {
  return (
    <div className="flex h-full flex-col canvas-gradient">
      <header className="border-b border-pag-border bg-pag-bg-surface/70 backdrop-blur-sm">
        {/* Red brand bar */}
        <div className="h-1 bg-pag-red" />
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden text-xxs uppercase tracking-widest text-pag-text-muted sm:inline">
              {variant === 'wizard' ? 'Setup' : 'Control Panel'}
            </span>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-pag-text-muted">Porsche Engineering</div>
            <div className="text-xxs uppercase tracking-widest text-pag-text-faint">
              Internal · PEG-IT
            </div>
          </div>
        </div>
      </header>

      <main className={cn('flex-1 overflow-y-auto', variant === 'wizard' ? 'py-8' : 'py-6')}>
        <div className="mx-auto w-full max-w-4xl px-6">{children}</div>
      </main>

      <footer className="border-t border-pag-border bg-pag-bg-surface/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-2 text-xxs uppercase tracking-widest text-pag-text-faint">
          <span>MCPorsche · {new Date().getFullYear()}</span>
          <span>Powered by PEG-IT</span>
        </div>
      </footer>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-pag-ink text-pag-bg-surface">
        <span className="font-bold text-sm tracking-tight">MC</span>
      </div>
      <div className="leading-none">
        <div className="text-lg font-semibold tracking-tight text-pag-text">
          MC<span className="text-pag-red">Porsche</span>
        </div>
        <div className="text-xxs uppercase tracking-widest text-pag-text-faint">
          MCP Server Suite
        </div>
      </div>
    </div>
  );
}
