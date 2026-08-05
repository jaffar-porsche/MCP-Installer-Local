import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@renderer/components/Button';
import Checkbox from '@renderer/components/Checkbox';
import type { ShortcutInfo, ShortcutLocation } from '@shared/types';

interface Props {
  onClose: () => void;
}

const LOCATIONS: Array<{ id: ShortcutLocation; title: string; description: string }> = [
  { id: 'start_menu', title: 'Start Menu shortcut', description: 'Type “MCP-Installer” in Windows Start.' },
  { id: 'desktop', title: 'Desktop shortcut', description: 'The icon most users double-click.' },
  { id: 'startup', title: 'Auto-start on login', description: 'Launch MCP-Installer every time you log in to Windows.' },
];

export default function ShortcutDialog({ onClose }: Props) {
  const [rows, setRows] = useState<Record<ShortcutLocation, ShortcutInfo | null>>({
    start_menu: null,
    desktop: null,
    startup: null,
  });
  const [selected, setSelected] = useState<Record<ShortcutLocation, boolean>>({
    start_menu: false,
    desktop: false,
    startup: false,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const entries = await Promise.all(
        LOCATIONS.map(async (l) => [l.id, await window.api.shortcuts.info(l.id)] as const),
      );
      const map: Record<ShortcutLocation, ShortcutInfo | null> = { start_menu: null, desktop: null, startup: null };
      const sel: Record<ShortcutLocation, boolean> = { start_menu: false, desktop: false, startup: false };
      for (const [id, info] of entries) {
        map[id] = info;
        sel[id] = info.exists;
      }
      setRows(map);
      setSelected(sel);
    })();
  }, []);

  async function apply() {
    setBusy(true);
    const results: string[] = [];
    for (const loc of LOCATIONS) {
      const want = selected[loc.id];
      const info = rows[loc.id];
      if (!info) continue;
      try {
        if (want && !info.exists) {
          await window.api.shortcuts.create(loc.id);
          results.push(`+ ${loc.title}`);
        } else if (want && info.exists) {
          await window.api.shortcuts.create(loc.id); // repair
          results.push(`↻ ${loc.title}`);
        } else if (!want && info.exists) {
          await window.api.shortcuts.remove(loc.id);
          results.push(`− ${loc.title}`);
        }
      } catch (err) {
        toast.error(`${loc.title}: ${String(err)}`);
      }
    }
    setBusy(false);
    toast.success(results.length ? results.join('\n') : 'Nothing to change.');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-pag-ink/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-card border border-pag-border bg-pag-bg-surface p-6 shadow-raised">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-pag-text">Shortcuts</div>
            <div className="text-xs text-pag-text-muted">Choose where the MCP-Installer shortcut should live.</div>
          </div>
          <button
            className="rounded-md p-1 text-pag-text-muted hover:bg-pag-bg-muted"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-2">
          {LOCATIONS.map((l) => {
            const info = rows[l.id];
            const path = info?.path ?? '';
            const exists = info?.exists ?? false;
            return (
              <div key={l.id} className="rounded-md border border-pag-border p-3">
                <Checkbox
                  label={l.title}
                  description={l.description}
                  checked={selected[l.id]}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [l.id]: e.target.checked }))
                  }
                />
                <div className="mt-1 flex items-center justify-between text-xxs text-pag-text-faint">
                  <span>{exists ? 'Already installed' : 'Not installed'}</span>
                  <span className="max-w-[16rem] truncate font-mono">{path}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void apply()} disabled={busy}>
            {busy ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      </div>
    </div>
  );
}
