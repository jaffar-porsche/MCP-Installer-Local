import Card from '@renderer/components/Card';
import { useWizardStore } from '@renderer/store/wizard';

export default function ReviewStep() {
  const s = useWizardStore();
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Enabled servers" value={s.selectedKeys.join(', ') || '(none)'} />
        <Row label="HTTP proxy" value={s.proxyHttp || '(none)'} />
        <Row label="HTTPS proxy" value={s.proxyHttps || '(none)'} mono />
      </div>

      <div className="mt-6 space-y-4">
        {s.selectedKeys.map((key) => {
          const spec = s.specs.find((sp) => sp.key === key);
          if (!spec) return null;
          const vals = s.values[key] ?? {};
          return (
            <div key={key} className="rounded-md border border-pag-border p-4">
              <div className="text-sm font-semibold text-pag-text">{spec.displayName}</div>
              <div className="mt-2 grid gap-1 text-sm text-pag-text-muted">
                {spec.fields
                  .filter((f) => f.category !== 'Proxy' && f.category !== 'Advanced')
                  .map((f) => {
                    const raw = vals[f.key] ?? '';
                    const shown = f.secret ? redact(raw) : raw || '(not set)';
                    return (
                      <div key={f.key} className="flex gap-2">
                        <span className="w-56 shrink-0 text-pag-text-faint">{f.label}</span>
                        <span className={f.secret ? 'font-mono' : ''}>{shown}</span>
                      </div>
                    );
                  })}
                <div className="flex gap-2">
                  <span className="w-56 shrink-0 text-pag-text-faint">Port</span>
                  <span>{spec.defaultPort}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-pag-text-muted">
        Click Install to write <code>.env</code> files and register the MCP endpoints with VS Code and
        Claude Desktop. No servers are started yet — you can choose to open the Control Panel afterwards.
      </p>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xxs uppercase tracking-widest text-pag-text-faint">{label}</div>
      <div className={`text-sm text-pag-text ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function redact(v: string): string {
  if (!v) return '(not set)';
  const t = v.trim();
  if (t.length <= 4) return '*'.repeat(t.length);
  return t.slice(0, 4) + '…' + '*'.repeat(Math.min(8, Math.max(1, t.length - 4)));
}
