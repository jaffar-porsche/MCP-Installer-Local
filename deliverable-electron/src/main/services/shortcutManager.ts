/**
 * Windows shortcut manager — Start Menu, Desktop and Startup folder.
 *
 * Uses WScript.Shell via a PowerShell subprocess so we stay dep-free on the
 * JS side. On non-Windows platforms all operations return a no-op-safe
 * ShortcutInfo so the UI can render cleanly during development on macOS/Linux.
 */
import { execFile } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { ShortcutInfo, ShortcutLocation } from '@shared/types';

const pExecFile = promisify(execFile);

const SHORTCUT_NAME = 'MCP-Installer.lnk';

export function pathFor(location: ShortcutLocation): string {
  const appdata = process.env.APPDATA ?? '';
  const userprofile = process.env.USERPROFILE ?? '';
  switch (location) {
    case 'start_menu':
      return join(appdata, 'Microsoft', 'Windows', 'Start Menu', 'Programs', SHORTCUT_NAME);
    case 'desktop':
      return join(userprofile, 'Desktop', SHORTCUT_NAME);
    case 'startup':
      return join(
        appdata,
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs',
        'Startup',
        SHORTCUT_NAME,
      );
  }
}

export async function info(location: ShortcutLocation): Promise<ShortcutInfo> {
  const path = pathFor(location);
  if (!existsSync(path)) return { location, exists: false, path };
  if (process.platform !== 'win32') return { location, exists: true, path };
  const [target, args] = await readLnk(path);
  return { location, exists: true, path, target: target ?? undefined, arguments: args ?? undefined };
}

export async function createOrRepair(
  location: ShortcutLocation,
  target: string,
  args = '',
  workdir?: string,
): Promise<ShortcutInfo> {
  if (process.platform !== 'win32') {
    throw new Error('Shortcuts are a Windows-only feature.');
  }
  const path = pathFor(location);
  const ps =
    "$s = New-Object -ComObject WScript.Shell; " +
    `$l = $s.CreateShortcut([string]'${escape(path)}'); ` +
    `$l.TargetPath = [string]'${escape(target)}'; ` +
    `$l.Arguments = [string]'${escape(args)}'; ` +
    (workdir ? `$l.WorkingDirectory = [string]'${escape(workdir)}'; ` : '') +
    `$l.IconLocation = [string]'${escape(target)},0'; ` +
    "$l.Description = 'MCP-Installer — Powered by PEG-IT'; " +
    '$l.Save()';
  await pExecFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
    windowsHide: true,
    timeout: 10000,
  });
  return info(location);
}

export async function remove(location: ShortcutLocation): Promise<boolean> {
  const path = pathFor(location);
  if (!existsSync(path)) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

async function readLnk(path: string): Promise<[string | null, string | null]> {
  try {
    const ps =
      "$s = New-Object -ComObject WScript.Shell; " +
      `$l = $s.CreateShortcut([string]'${escape(path)}'); ` +
      'Write-Output ($l.TargetPath); Write-Output ($l.Arguments)';
    const { stdout } = await pExecFile('powershell', ['-NoProfile', '-Command', ps], {
      windowsHide: true,
      timeout: 6000,
    });
    const [target = '', args = ''] = stdout.split(/\r?\n/).filter(Boolean);
    return [target.trim() || null, args.trim() || null];
  } catch {
    return [null, null];
  }
}

function escape(v: string): string {
  return v.replace(/'/g, "''");
}
