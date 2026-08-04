import { CheckCircle2 } from 'lucide-react';
import Card from '@renderer/components/Card';

export default function WelcomeStep() {
  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-pag-red">
        <p className="text-sm leading-relaxed text-pag-text">
          MCPorsche gives you fast, local access to <strong>Jira</strong>, <strong>Confluence</strong>,
          and <strong>GitLab</strong> from AI assistants such as GitHub Copilot and Claude Code.
          The next few screens will:
        </p>
        <ul className="mt-4 space-y-2">
          {[
            'Detect your corporate proxy from Windows.',
            'Ask which servers you want to enable.',
            'Collect one Personal Access Token per server, with a live connectivity test.',
            'Register the endpoints in VS Code and Claude Desktop for you.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-pag-text">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-pag-success" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-pag-text-muted">
        Secrets stay on this machine — they’re stored only in local <code>.env</code> files and never sent to any
        third party.
      </p>
    </div>
  );
}
