import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';

import Button from '@renderer/components/Button';
import { useWizardStore } from '@renderer/store/wizard';

import WelcomeStep from './steps/WelcomeStep';
import PythonCheckStep from './steps/PythonCheckStep';
import ChooseServersStep from './steps/ChooseServersStep';
import ProxyStep from './steps/ProxyStep';
import ServerStep from './steps/ServerStep';
import ReviewStep from './steps/ReviewStep';
import DoneStep from './steps/DoneStep';
import InstallProgress from './InstallProgress';

type StepDef = {
  key: string;
  title: string;
  subtitle: string;
  render: () => JSX.Element;
};

export default function Wizard() {
  const store = useWizardStore();
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [pythonReady, setPythonReady] = useState<boolean>(true);

  useEffect(() => {
    void store.bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const steps: StepDef[] = useMemo(() => {
    if (!store.loaded) return [];
    const perServer = store.selectedKeys.map((k) => {
      const spec = store.specs.find((s) => s.key === k)!;
      return {
        key: `server:${k}`,
        title: `Configure ${spec.displayName}`,
        subtitle: 'Paste your Personal Access Token and test the connection.',
        render: () => <ServerStep spec={spec} />,
      } satisfies StepDef;
    });
    return [
      {
        key: 'welcome',
        title: 'Welcome to MCP-Installer',
        subtitle: 'This wizard configures your MCP servers step by step.',
        render: () => <WelcomeStep />,
      },
      {
        key: 'python',
        title: 'Python runtime',
        subtitle: 'MCP-Installer needs Python to run the MCP servers.',
        render: () => <PythonCheckStep onReady={setPythonReady} />,
      },
      {
        key: 'choose',
        title: 'Choose MCP servers',
        subtitle: 'Select which integrations you need. You can add more later.',
        render: () => <ChooseServersStep />,
      },
      {
        key: 'proxy',
        title: 'Corporate proxy',
        subtitle: 'Most Porsche machines need a proxy for outbound HTTPS.',
        render: () => <ProxyStep />,
      },
      ...perServer,
      {
        key: 'review',
        title: 'Review & install',
        subtitle: 'Verify your settings, then click Install.',
        render: () => <ReviewStep />,
      },
      {
        key: 'progress',
        title: 'Installing',
        subtitle: 'Copying sources, creating virtual environments, installing dependencies…',
        render: () => <InstallProgress error={installError} />,
      },
      {
        key: 'done',
        title: 'All done',
        subtitle: 'Your MCP servers are configured and ready to launch.',
        render: () => <DoneStep />,
      },
    ];
  }, [store.loaded, store.selectedKeys, store.specs]);

  const step = steps[stepIdx];
  const stepKey = step?.key ?? '';
  const isReview = stepKey === 'review';
  const isProgress = stepKey === 'progress';
  const isDone = stepKey === 'done';
  const [canGoNext, setCanGoNext] = useState(true);

  useEffect(() => {
    if (!stepKey) return;
    let cancelled = false;
    void (async () => {
      const ok = await canAdvance(stepKey, useWizardStore.getState(), pythonReady);
      if (!cancelled) setCanGoNext(ok);
    })();
    return () => { cancelled = true; };
  }, [stepKey, store.selectedKeys, store.values, pythonReady]);

  if (!store.loaded || steps.length === 0 || !step) {
    return (
      <div className="grid h-64 place-items-center text-pag-text-muted">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  async function goNext() {
    if (isReview) {
      setBusy(true);
      setInstalling(true);
      setInstallError(null);
      setStepIdx((i) => i + 1);
      try {
        await performInstall();
        setStepIdx((i) => i + 1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setInstallError(msg);
        console.error('Install failed', err);
      } finally {
        setBusy(false);
        setInstalling(false);
      }
      return;
    }
    if (isDone) {
      await applyDoneChoices();
      await window.api.windows.closeCurrent();
      return;
    }
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }

  const showBack = !isProgress && !isDone;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xxs uppercase tracking-widest text-pag-text-faint">
          <span>Step {stepIdx + 1} of {steps.length}</span>
          <span className="mx-1 h-px flex-1 bg-pag-border" />
          <span>{Math.round(((stepIdx + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="mt-1 h-1 rounded-full bg-pag-bg-muted">
          <div
            className="h-1 rounded-full bg-pag-red transition-all duration-300 ease-pag"
            style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-pag-text">{step.title}</h1>
      <p className="mt-1 text-sm text-pag-text-muted">{step.subtitle}</p>

      <div className="mt-6">{step.render()}</div>

      <div className="mt-10 flex items-center justify-between border-t border-pag-border pt-5">
        {showBack ? (
          <Button
            variant="ghost"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0 || busy}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <div />
        )}
        {!isProgress && (
          <Button
            variant="primary"
            onClick={() => void goNext()}
            disabled={!canGoNext || busy || installing}
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {isReview ? 'Install' : isDone ? 'Finish' : 'Next'}
                {!isDone && <ChevronRight className="h-4 w-4" />}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

async function canAdvance(
  stepKey: string,
  s: ReturnType<typeof useWizardStore.getState>,
  pythonReady: boolean,
): Promise<boolean> {
  if (stepKey === 'python') return pythonReady;
  if (stepKey === 'choose') return s.selectedKeys.length > 0;
  if (stepKey.startsWith('server:')) {
    const serverKey = stepKey.slice('server:'.length);
    const spec = s.specs.find((sp) => sp.key === serverKey);
    if (!spec) return true;
    const values = s.values[serverKey] ?? {};
    for (const f of spec.fields) {
      if (f.required && !(values[f.key] ?? '').trim()) return false;
    }
  }
  return true;
}

async function performInstall(): Promise<void> {
  const s = useWizardStore.getState();
  await window.api.selection.save(s.selectedKeys);

  const proxy = s.proxyHttps || s.proxyHttp || null;
  const envValuesByServer: Record<string, Record<string, string>> = {};
  for (const key of s.selectedKeys) {
    const spec = s.specs.find((sp) => sp.key === key)!;
    const values: Record<string, string> = { ...(s.values[key] ?? {}) };
    if (s.proxyHttp) values.HTTP_PROXY = s.proxyHttp;
    if (s.proxyHttps) values.HTTPS_PROXY = s.proxyHttps;
    if (!values.MCP_PORT) values.MCP_PORT = String(spec.defaultPort);
    if (!values.MCP_TRANSPORT) values.MCP_TRANSPORT = 'http';
    envValuesByServer[key] = values;
  }

  const result = await window.api.bootstrap.run({
    serverKeys: s.selectedKeys,
    envValuesByServer,
    proxy,
  });
  if (!result.success) throw new Error(result.error ?? 'bootstrap failed');

  await window.api.vscode.integrate(s.selectedKeys).catch(() => undefined);
  await window.api.bootstrap.markCompleted();
  useWizardStore.getState().markCompleted();
}

async function applyDoneChoices(): Promise<void> {
  const s = useWizardStore.getState();
  const tasks: Promise<unknown>[] = [];
  if (s.createStartMenu) tasks.push(window.api.shortcuts.create('start_menu'));
  else tasks.push(window.api.shortcuts.remove('start_menu'));
  if (s.createDesktop) tasks.push(window.api.shortcuts.create('desktop'));
  else tasks.push(window.api.shortcuts.remove('desktop'));
  if (s.createStartup) tasks.push(window.api.shortcuts.create('startup'));
  else tasks.push(window.api.shortcuts.remove('startup'));
  await Promise.allSettled(tasks);
}
