import { PartyPopper } from 'lucide-react';

import Card from '@renderer/components/Card';
import Checkbox from '@renderer/components/Checkbox';
import { useWizardStore } from '@renderer/store/wizard';

export default function DoneStep() {
  const s = useWizardStore();
  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-pag-success">
        <div className="flex items-start gap-3">
          <PartyPopper className="mt-1 h-5 w-5 text-pag-success" />
          <div>
            <div className="text-base font-semibold text-pag-text">Configuration saved</div>
            <p className="mt-1 text-sm text-pag-text-muted">
              <code>.env</code> files were written, virtual environments were created, and MCPorsche is
              now registered in VS Code and Claude Desktop.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="text-xs uppercase tracking-wider text-pag-text-muted">Shortcuts</div>
        <div className="mt-2 space-y-1">
          <Checkbox
            label="Add a Start Menu shortcut"
            description="Type “MCPorsche” in Windows Start to launch."
            checked={s.createStartMenu}
            onChange={(e) => s.setDone({ createStartMenu: e.target.checked })}
          />
          <Checkbox
            label="Add a Desktop shortcut"
            description="The icon most users double-click."
            checked={s.createDesktop}
            onChange={(e) => s.setDone({ createDesktop: e.target.checked })}
          />
          <Checkbox
            label="Start automatically when I log in"
            description="Places a shortcut in the Windows Startup folder."
            checked={s.createStartup}
            onChange={(e) => s.setDone({ createStartup: e.target.checked })}
          />
        </div>
      </Card>

      <p className="text-xs text-pag-text-muted">
        Clicking <strong>Finish</strong> closes this window. Open the Control Panel any time
        from the Desktop or Start Menu shortcut.
      </p>
    </div>
  );
}
