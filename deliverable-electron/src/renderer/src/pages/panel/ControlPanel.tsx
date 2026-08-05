import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  KeyRound,
  ListRestart,
  PlayCircle,
  Power,
  RefreshCw,
  ScrollText,
  Settings2,
  StopCircle,
} from 'lucide-react';

import Button from '@renderer/components/Button';
import Card from '@renderer/components/Card';
import StatusDot from '@renderer/components/StatusDot';
import type { RunState, RuntimeSnapshot, ServerSpec } from '@shared/types';

import ShortcutDialog from './ShortcutDialog';


export default function ControlPanel() {
  console.log('WINDOW API:', window.api);
  const [specs, setSpecs] = useState<ServerSpec[]>([]);
  const [status, setStatus] = useState<Record<string, RuntimeSnapshot>>({});
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    void (async () => {
      const [manifests, initial] = await Promise.all([
        window.api.manifests.list(),
        window.api.serverControl.listStatuses(),
      ]);
      setSpecs(manifests);
      setStatus(index(initial));
    })();
    const off = window.api.events.onStatusChanged((snaps) => setStatus(index(snaps)));
    return () => off();
  }, []);

  const enabled = useMemo(
    () => specs.filter((s) => {
      const snap = status[s.key];
      return snap && snap.state !== 'UNCONFIGURED';
    }),
    [specs, status],
  );
  const configured = enabled.length > 0 ? enabled : specs;

  async function start(key: string) {
    await window.api.serverControl.start(key);
    toast.success(`${label(specs, key)} → starting`);
  }
  async function stop(key: string) {
    await window.api.serverControl.stop(key);
    toast.info(`${label(specs, key)} → stopped`);
  }
  async function restart(key: string) {
    await window.api.serverControl.restart(key);
    toast.info(`${label(specs, key)} → restarting`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-pag-text">SERVERS</h1>
          <p className="text-sm text-pag-text-muted">
            Nothing runs until you press <strong>Start</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const snaps = await window.api.serverControl.startAll();
              setStatus(index(snaps));
              toast.success('Starting all servers…');
            }}
          >
            <PlayCircle className="h-4 w-4" />
            Start all
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const snaps = await window.api.serverControl.stopAll();
              setStatus(index(snaps));
              toast.info('All servers stopped.');
            }}
          >
            <Power className="h-4 w-4" />
            Stop all
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {configured.map((spec) => {
          const s = status[spec.key];
          return (
            <ServerRow
              key={spec.key}
              spec={spec}
              status={s}
              onStart={() => start(spec.key)}
              onStop={() => stop(spec.key)}
              onRestart={() => restart(spec.key)}
              onLog={() => window.api.serverControl.openLog(spec.key)}
              onRotate={() => window.api.windows.openPatRotation(spec.key)}
            />
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-pag-border pt-4">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.api.windows.openWizard()}>
            <Settings2 className="h-4 w-4" />
            Reconfigure Wizard
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await window.api.vscode.integrate(configured.map((s) => s.key));
              if (res.updated.length) {
                toast.success(`VS Code integration updated:\n${res.updated.join('\n')}`);
              } else {
                toast.error('VS Code integration failed. See logs.');
              }
            }}
          >
            <ListRestart className="h-4 w-4" />
            VS Code integration
          </Button>
          <Button variant="secondary" onClick={() => setShowShortcuts(true)}>
            Shortcuts…
          </Button>
        </div>
        <Button variant="ghost" onClick={() => window.api.system.quit()}>
          Quit
        </Button>
      </div>

      {showShortcuts && <ShortcutDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

interface RowProps {
  spec: ServerSpec;
  status?: RuntimeSnapshot;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onLog: () => void;
  onRotate: () => void;
}

function ServerRow({ spec, status, onStart, onStop, onRestart, onLog, onRotate }: RowProps) {
  const state = status?.state ?? 'STOPPED';
  const tier = tierOf(state);
  const pulse = state === 'STARTING';
  const canStart = ['STOPPED', 'CRASHED', 'ERROR', 'UNCONFIGURED'].includes(state);
  const canStop = ['STARTING', 'RUNNING_OK', 'RUNNING_PAT_BAD'].includes(state);

  return (
    <Card interactive>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <StatusDot tier={tier} pulse={pulse} className="mt-1.5" />
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <div className="text-base font-semibold text-pag-text">{spec.displayName}</div>
              <div className="text-xs text-pag-text-muted">port {status?.port ?? spec.defaultPort}</div>
              <div className="rounded-full bg-pag-bg-muted px-2 py-0.5 text-xxs uppercase tracking-widest text-pag-text-muted">
                {stateLabel(state)}
              </div>
            </div>
            <div className="mt-1 text-sm text-pag-text-muted">
              {status?.displayUser && <>Signed in as <strong>{status.displayUser}</strong>. </>}
              {status?.message}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={onStart} disabled={!canStart}>
            <PlayCircle className="h-4 w-4" />
            Start
          </Button>
          <Button variant="secondary" size="sm" onClick={onStop} disabled={!canStop}>
            <StopCircle className="h-4 w-4" />
            Stop
          </Button>
          <Button variant="secondary" size="sm" onClick={onRestart} disabled={!canStop}>
            <RefreshCw className="h-4 w-4" />
            Restart
          </Button>
          <div className="mx-1 h-6 w-px bg-pag-border" />
          <Button variant="ghost" size="sm" onClick={onRotate}>
            <KeyRound className="h-4 w-4" />
            Rotate PAT
          </Button>
          <Button variant="ghost" size="sm" onClick={onLog}>
            <ScrollText className="h-4 w-4" />
            Logs
          </Button>
        </div>
      </div>
    </Card>
  );
}

function tierOf(state: RunState): 'ok' | 'warning' | 'error' | 'neutral' | 'progress' {
  switch (state) {
    case 'RUNNING_OK':
      return 'ok';
    case 'STARTING':
      return 'progress';
    case 'RUNNING_PAT_BAD':
    case 'CRASHED':
    case 'ERROR':
      return 'error';
    case 'STOPPED':
    case 'UNCONFIGURED':
    default:
      return 'neutral';
  }
}

function stateLabel(s: RunState): string {
  return {
    UNCONFIGURED: 'Not configured',
    STOPPED: 'Stopped',
    STARTING: 'Starting',
    RUNNING_OK: 'Running',
    RUNNING_PAT_BAD: 'PAT expired',
    CRASHED: 'Crashed',
    ERROR: 'Error',
  }[s];
}

function index(snaps: RuntimeSnapshot[]): Record<string, RuntimeSnapshot> {
  return Object.fromEntries(snaps.map((s) => [s.key, s]));
}

function label(specs: ServerSpec[], key: string): string {
  return specs.find((s) => s.key === key)?.displayName ?? key;
}
