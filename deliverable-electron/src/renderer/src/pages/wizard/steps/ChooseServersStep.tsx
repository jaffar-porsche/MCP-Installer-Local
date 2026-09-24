import Card from '@renderer/components/Card';
import Checkbox from '@renderer/components/Checkbox';
import { useWizardStore } from '@renderer/store/wizard';

export default function ChooseServersStep() {
  const specs = useWizardStore((s) => s.specs);
  const selected = useWizardStore((s) => s.selectedKeys);
  const toggle = useWizardStore((s) => s.toggleServer);

  return (
    <Card>
      <div className="space-y-1">
        {specs.map((spec) => (
          <Checkbox
            key={spec.key}
            checked={selected.includes(spec.key)}
            onChange={() => toggle(spec.key)}
            label={spec.displayName}
            description={describeSpec(spec)}
          />
        ))}
      </div>
      <p className="mt-4 text-xs text-pag-text-muted">
        Each selected server gets its own configuration screen next. If unsure, keep them all enabled.
      </p>
    </Card>
  );
}

function describeSpec(spec: { defaultPort: number; tokenEnv?: string | null }): string {
  const auth = spec.tokenEnv ? `env: ${spec.tokenEnv}` : 'no PAT required';
  return `Runs locally on port ${spec.defaultPort} · ${auth}`;
}
