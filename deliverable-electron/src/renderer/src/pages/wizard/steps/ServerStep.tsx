import { useMemo, useState, useEffect } from 'react';
import { PlugZap } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@renderer/components/Button';
import Card from '@renderer/components/Card';
import StatusDot from '@renderer/components/StatusDot';
import TextField from '@renderer/components/TextField';

import { useWizardStore } from '@renderer/store/wizard';

import type { FieldCategory, FieldSpec, ServerSpec, TestResult } from '@shared/types';

interface Props {
  spec: ServerSpec;
}

const CATEGORIES: FieldCategory[] = ['Connection', 'Auth', 'Proxy', 'Advanced'];

export default function ServerStep({ spec }: Props) {
  const values = useWizardStore((s) => s.values[spec.key] ?? {});
  const setValue = useWizardStore((s) => s.setValue);
  const proxyHttp = useWizardStore((s) => s.proxyHttp);
  const proxyHttps = useWizardStore((s) => s.proxyHttps);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  // Reset the last test result whenever the values or proxy settings change
  // so stale "OK"/error indicators don't persist when moving between servers.
  // Also reset when the spec changes.
  useEffect(() => {
    setResult(null);
  }, [spec.key, values, proxyHttp, proxyHttps]);

  const groups = useMemo(() => {
    const byCategory: Record<FieldCategory, FieldSpec[]> = {
      Connection: [],
      Auth: [],
      Proxy: [],
      Advanced: [],
    };
    for (const field of spec.fields) byCategory[field.category].push(field);
    return CATEGORIES.filter((c) => byCategory[c].length > 0).map((c) => ({ category: c, fields: byCategory[c] }));
  }, [spec]);

  async function runTest() {
    setBusy(true);
    setResult(null);
    try {
      const merged = { ...values, HTTP_PROXY: proxyHttp, HTTPS_PROXY: proxyHttps };
      const r = await window.api.tester.test(spec.key, merged);
      setResult(r);
      if (r.status === 'OK') {
        toast.success(`PAT accepted${r.displayName ? ` — signed in as ${r.displayName}` : ''}.`);
      } else {
        toast.error(r.message);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  const pillTier = result ? statusToTier(result.status) : 'neutral';

  return (
    <div className="space-y-4">
      {groups.map(({ category, fields }) => (
        <Card key={category}>
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-pag-text-muted">
            <span className="h-1 w-1 rounded-full bg-pag-red" />
            {category}
          </div>
          <div className="space-y-1">
            {fields.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                required={f.required}
                secret={f.secret}
                helpUrl={f.helpUrl}
                placeholder={f.placeholder ?? undefined}
                hint={f.helpText || undefined}
                value={values[f.key] ?? f.default ?? ''}
                onChange={(e) => setValue(spec.key, f.key, e.target.value)}
              />
            ))}
          </div>
        </Card>
      ))}

      <Card padding="sm" className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-pag-text">
          <StatusDot tier={pillTier as any} pulse={busy} />
          <span className="font-medium">
            {result ? statusLabel(result) : 'PAT not tested yet.'}
          </span>
          {result?.hint && <span className="text-pag-text-muted">— {result.hint}</span>}
        </div>
        <Button variant="secondary" onClick={() => void runTest()} disabled={busy}>
          <PlugZap className="h-4 w-4" />
          {busy ? 'Testing…' : 'Test connection'}
        </Button>
      </Card>

      <p className="text-xs text-pag-text-muted">
        Only the PAT is validated by this test. If you also configured a client certificate (mTLS), the
        running server will use both — the test only checks the token itself.
      </p>
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
  if (r.status === 'OK') return `✔ ${r.message}${r.displayName ? ` — ${r.displayName}` : ''}`;
  return `✖ ${r.message}`;
}
