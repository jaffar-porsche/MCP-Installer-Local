import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';

import Card from '@renderer/components/Card';
import type { BootstrapPhase, BootstrapProgress } from '@shared/types';

const PHASE_HINTS: Record<BootstrapPhase, string> = {
  'venv': 'Creating isolated Python environments so nothing pollutes your system Python.',
  'pip-upgrade': 'Upgrading pip inside each virtual environment.',
  'requirements': 'Downloading and installing FastAPI, uvicorn, jira, atlassian-python-api …',
  'env': 'Writing your .env files with the configuration you entered.',
  'done': 'All set — closing the wizard opens the Control Panel.',
};

interface Props {
  error: string | null;
}

export default function InstallProgress({ error }: Props) {
  const [progress, setProgress] = useState<BootstrapProgress | null>(null);

  useEffect(() => {
    const off = window.api.bootstrap.onProgress((evt) => setProgress(evt));
    return () => off();
  }, []);

  const percent = error ? 100 : progress?.percent ?? 0;
  const done = progress?.phase === 'done';

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <StatusIcon done={done} error={!!error} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-pag-text">
              {error
                ? 'Installation failed'
                : progress?.message ?? 'Preparing…'}
            </div>
            <div className="mt-1 text-xs text-pag-text-muted">
              {error
                ? error
                : progress
                ? PHASE_HINTS[progress.phase]
                : 'Starting the parallel install pipeline…'}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-pag-bg-muted">
              <div
                className={`h-full transition-[width] duration-500 ease-pag ${
                  error ? 'bg-pag-error' : done ? 'bg-pag-success' : 'bg-pag-red'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      <p className="text-xs text-pag-text-muted">
        Each server is set up in turn — reliable on corporate networks even
        when pip has to fetch large wheels through a proxy. Watch the full
        pip output in <code>%APPDATA%\MCP-Installer\logs\bootstrap.log</code>.
      </p>
    </div>
  );
}

function StatusIcon({ done, error }: { done: boolean; error: boolean }) {
  if (error) return <XCircle className="mt-0.5 h-6 w-6 text-pag-error" />;
  if (done) return <CheckCircle2 className="mt-0.5 h-6 w-6 text-pag-success" />;
  return <LoaderCircle className="mt-0.5 h-6 w-6 animate-spin text-pag-info" />;
}
