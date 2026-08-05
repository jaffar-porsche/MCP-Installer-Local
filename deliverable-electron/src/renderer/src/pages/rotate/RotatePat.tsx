import { useEffect, useMemo, useState } from 'react';
import { KeyRound, LoaderCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@renderer/components/Button';
import Card from '@renderer/components/Card';
import StatusDot from '@renderer/components/StatusDot';
import TextField from '@renderer/components/TextField';

import type { ServerSpec, TestResult } from '@shared/types';

interface Props {
  serverKey: string;
}

export default function RotatePat({ serverKey }: Props) {
  const [spec, setSpec] = useState<ServerSpec | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const manifests = await window.api.manifests.list();
      const nextSpec = manifests.find((entry) => entry.key === serverKey) ?? null;
      if (!nextSpec) {
        if (!cancelled) setLoaded(true);
        return;
      }

      const env = await window.api.env.read(serverKey).catch(() => ({}));
      if (cancelled) return;

      setSpec(nextSpec);
      setValues(env);
      setToken(env[nextSpec.tokenEnv] ?? '');
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [serverKey]);

  const tokenField = useMemo(() => spec?.fields.find((field) => field.key === spec.tokenEnv) ?? null, [spec]);

  async function runTest() {
    if (!spec) return;
    setBusy(true);
    setResult(null);
    try {
      const nextValues = { ...values, [spec.tokenEnv]: token };
      const tested = await window.api.tester.test(spec.key, nextValues);
      setResult(tested);
      if (tested.status === 'OK') toast.success('PAT accepted.');
      else toast.error(tested.message);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function savePat() {
    if (!spec) return;
    if (!token.trim()) {
      toast.error('Paste a PAT before saving.');
      return;
    }

    setSaving(true);
    try {
      const nextValues = { ...values, [spec.tokenEnv]: token.trim() };
      await window.api.env.write(spec.key, nextValues);
      setValues(nextValues);
      await window.api.serverControl.stop(spec.key);
      toast.success(`${spec.displayName} PAT saved. Server stopped.`);
      await window.api.windows.closeCurrent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="grid h-64 place-items-center text-pag-text-muted">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!spec || !tokenField) {
    return (
      <Card>
        <div className="space-y-3">
          <div className="text-lg font-semibold text-pag-text">PAT rotation unavailable</div>
          <div className="text-sm text-pag-text-muted">
            The selected server could not be loaded. Close this window and try again from the Control Panel.
          </div>
          <div>
            <Button variant="secondary" onClick={() => window.api.windows.closeCurrent()}>
              Close
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const tier = result ? statusToTier(result.status) : 'neutral';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-pag-text">Rotate PAT</h1>
        <p className="mt-1 text-sm text-pag-text-muted">
          Update the token for {spec.displayName}. Saving stops the server.
        </p>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-pag-text-muted">
          <KeyRound className="h-4 w-4 text-pag-red" />
          Authentication
        </div>
        <TextField
          label={tokenField.label}
          required={tokenField.required}
          secret={tokenField.secret}
          helpUrl={tokenField.helpUrl}
          hint={'Paste the new token, test it, then save.'}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={tokenField.placeholder ?? undefined}
        />
      </Card>

      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-pag-text">
          <StatusDot tier={tier as any} pulse={busy} />
          <span className="font-medium">{result ? statusLabel(result) : 'PAT not tested yet.'}</span>
          {result?.hint && <span className="text-pag-text-muted">- {result.hint}</span>}
        </div>
        <Button variant="secondary" onClick={() => void runTest()} disabled={busy || saving}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Test PAT
        </Button>
      </Card>

      <div className="flex items-center justify-between border-t border-pag-border pt-5">
        <Button variant="ghost" onClick={() => window.api.windows.closeCurrent()} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void savePat()} disabled={saving || busy || !token.trim()}>
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save and stop server
        </Button>
      </div>
    </div>
  );
}

function statusToTier(s: TestResult['status']): 'ok' | 'warning' | 'error' | 'neutral' {
  switch (s) {
    case 'OK':
      return 'ok';
    case 'PAT_INVALID':
    case 'PAT_EXPIRED':
      return 'error';
    case 'NETWORK':
    case 'PROXY_REQUIRED':
    case 'CERT_ERROR':
      return 'warning';
    default:
      return 'neutral';
  }
}

function statusLabel(r: TestResult): string {
  if (r.status === 'OK') return `PAT accepted${r.displayName ? ` - ${r.displayName}` : ''}.`;
  return r.message;
}