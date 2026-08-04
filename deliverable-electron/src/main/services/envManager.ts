/**
 * Atomic .env read / write with rotating backups.
 *
 * Mirrors the Python env_manager. Values are always quoted so shells and
 * python-dotenv both round-trip cleanly. Empty values are dropped so the
 * wizard can remove a key by clearing the input.
 */
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { BACKUP_DIR, ensureDataDirs } from './paths';

const SECRET_HINTS = ['PAT', 'TOKEN', 'PASSWORD', 'SECRET', 'KEY'];
const KV_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

export function isSecretKey(key: string): boolean {
  const upper = key.toUpperCase();
  return SECRET_HINTS.some((h) => upper.includes(h));
}

export function redact(value: string, keep = 4): string {
  if (!value) return '';
  const v = value.trim().replace(/^["']|["']$/g, '');
  if (v.length <= keep) return '*'.repeat(v.length);
  return v.slice(0, keep) + '…' + '*'.repeat(Math.min(8, Math.max(1, v.length - keep)));
}

export async function readEnv(path: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(path, 'utf-8');
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = KV_RE.exec(trimmed);
      if (!m) continue;
      out[m[1]!] = unquote(m[2] ?? '');
    }
    return out;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {};
    throw err;
  }
}

export async function writeEnv(
  path: string,
  values: Record<string, string>,
  header = '',
): Promise<void> {
  ensureDataDirs();
  await backup(path);
  await mkdir(dirname(path), { recursive: true });

  const lines: string[] = [];
  if (header) {
    for (const h of header.split('\n')) lines.push(`# ${h}`);
    lines.push('');
  }
  const keys = Object.keys(values).sort();
  for (const k of keys) {
    const v = (values[k] ?? '').trim();
    if (!v) continue;
    lines.push(`${k}="${escapeEnv(v)}"`);
  }

  const tmp = `${path}.tmp`;
  await writeFile(tmp, lines.join('\n') + '\n', { encoding: 'utf-8' });
  await rename(tmp, path);
}

// ---- internals ----------------------------------------------------------- //

function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

function escapeEnv(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function backup(src: string): Promise<void> {
  if (!existsSync(src)) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15);
  const parentName = basename(dirname(src));
  const dest = join(BACKUP_DIR, `${parentName}.env.${ts}.bak`);
  try {
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    rotateBackups(parentName, 5);
  } catch {
    // Non-fatal — backing up shouldn't block a write.
  }
}

function rotateBackups(prefix: string, keep: number): void {
  const entries = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(`${prefix}.env.`) && f.endsWith('.bak'))
    .map((f) => ({ name: f, mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const old of entries.slice(keep)) {
    try {
      unlink(join(BACKUP_DIR, old.name));
    } catch {
      /* ignore */
    }
  }
}
