/**
 * Filesystem paths used by the deliverable.
 *
 * User-writable data lives under %APPDATA%\MCP-Installer\ so the installed app
 * bundle stays read-only and upgradable. Everything server-related is
 * derived from a ServerSpec.serverDirName so this module knows nothing
 * about specific MCP servers.
 */
import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const APPDATA = process.env.APPDATA ?? app.getPath('appData');

export const DATA_ROOT = join(APPDATA, 'MCP-Installer');
export const STATE_DIR = join(DATA_ROOT, 'state');
export const LOG_DIR = join(DATA_ROOT, 'logs');
export const BACKUP_DIR = join(DATA_ROOT, 'backups');

export const HEALTH_STATE_FILE = join(STATE_DIR, 'health.json');
export const SELECTED_SERVERS_FILE = join(STATE_DIR, 'enabled_servers.json');
export const INSTALLATION_STATE_FILE = join(STATE_DIR, 'installation.json');
export const BOOTSTRAP_LOG = join(LOG_DIR, 'bootstrap.log');

export function ensureDataDirs(): void {
  for (const d of [DATA_ROOT, STATE_DIR, LOG_DIR, BACKUP_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

/**
 * Portable root: the folder where the user extracted the ZIP. Contains
 * MCP-Installer.exe + mcp-servers/ + all Electron internals.
 *
 * In dev, we sit at deliverable-electron/; the "sibling servers" live one
 * level up.
 */
export function portableRoot(): string {
  if (app.isPackaged) return dirname(app.getPath('exe'));
  return resolve(app.getAppPath(), '..');
}

/**
 * Root that contains all Python server subfolders. Packaged: `mcp-servers/`
 * next to the exe. Dev: the parent of `deliverable-electron/` (the repo root).
 */
export function serversRoot(): string {
  if (app.isPackaged) return join(portableRoot(), 'mcp-servers');
  return portableRoot();
}

/** On-disk directory for a specific server (holds sources, venv, .env). */
export function serverDir(dirName: string): string {
  return join(serversRoot(), dirName);
}

export function envFile(dirName: string): string {
  return join(serverDir(dirName), '.env');
}

export function venvDir(dirName: string): string {
  return join(serverDir(dirName), 'venv');
}

export function venvPython(dirName: string, prefer: 'windowless' | 'default' = 'windowless'): string {
  if (process.platform === 'win32') {
    const scripts = join(venvDir(dirName), 'Scripts');
    if (prefer === 'windowless' && existsSync(join(scripts, 'pythonw.exe'))) {
      return join(scripts, 'pythonw.exe');
    }
    return join(scripts, 'python.exe');
  }
  return join(venvDir(dirName), 'bin', 'python');
}

export function requirementsFile(dirName: string): string {
  return join(serverDir(dirName), 'requirements.txt');
}

export function pidFileFor(serverKey: string): string {
  return join(STATE_DIR, `${serverKey}.pid`);
}

export function logFileFor(serverKey: string): string {
  return join(LOG_DIR, `${serverKey}.log`);
}

export function manifestsDir(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'manifests');
  return resolve(app.getAppPath(), 'resources', 'manifests');
}
