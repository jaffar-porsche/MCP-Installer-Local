import { useEffect, useState } from 'react';
import { CheckCircle2, Download, LoaderCircle, XCircle } from 'lucide-react';

import Button from '@renderer/components/Button';
import Card from '@renderer/components/Card';
import type { PythonInfo } from '@shared/types';

interface Props {
  onReady: (ready: boolean) => void;
}

export default function PythonCheckStep({ onReady }: Props) {
  const [info, setInfo] = useState<PythonInfo | null>(null);
  const [checking, setChecking] = useState(true);

  async function check() {
    setChecking(true);
    const result = await window.api.python.detect();
    setInfo(result);
    onReady(result.found);
    setChecking(false);
  }

  useEffect(() => { void check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-pag-red">
        <p className="text-sm leading-relaxed text-pag-text">
          MCPorsche runs Python-based MCP servers. It bundles the server code, but{' '}
          <strong>Python {info?.minSupported ?? '3.10'}+ must be installed</strong> on this
          machine so we can create isolated virtual environments and install dependencies.
        </p>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-widest text-pag-text-faint">
              Python interpreter
            </div>
            {checking ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-pag-text-muted">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Detecting…
              </div>
            ) : info?.found ? (
              <div className="mt-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-pag-success" />
                <span className="text-sm">
                  Python <strong>{info.version}</strong> found
                  <span className="ml-1 font-mono text-pag-text-muted">({info.executable})</span>
                </span>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-sm text-pag-error">
                  <XCircle className="h-4 w-4" />
                  <span>Python {info?.minSupported ?? '3.10'}+ not found on PATH.</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.api.system.openExternal('https://www.python.org/downloads/')}
                >
                  <Download className="h-4 w-4" />
                  Download Python
                </Button>
              </div>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => void check()} disabled={checking}>
            Re-check
          </Button>
        </div>
      </Card>

      {!info?.found && !checking && (
        <p className="text-xs text-pag-text-muted">
          After installing Python, either close and reopen this wizard <em>or</em> click{' '}
          <strong>Re-check</strong>. Windows sometimes needs a fresh terminal/app session to
          pick up the new PATH.
        </p>
      )}
    </div>
  );
}
