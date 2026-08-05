/**
 * Load server manifests from disk.
 *
 * Discovery order (later wins on key clash):
 *   1. Built-in manifests shipped with the app under resources/manifests/*.json
 *   2. Repo-local manifests at <repo-root>/<name>-mcp/MCP-Installer.json
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { app } from 'electron';

import type { FieldSpec, ServerSpec } from '@shared/types';

import { manifestsDir } from './paths';

interface RawManifest {
  key: string;
  display_name: string;
  server_dir_name: string;
  default_port: number;
  app_module: string;
  health_path: string;
  myself_path: string;
  base_url_env: string;
  token_env: string;
  fields: RawField[];
  include_common?: string[];
}

interface RawField {
  key: string;
  label?: string;
  category?: FieldSpec['category'];
  default?: string | null;
  secret?: boolean;
  required?: boolean;
  help_text?: string;
  help_url?: string | null;
  placeholder?: string | null;
  validator?: FieldSpec['validator'];
}

type CommonGroups = Record<string, RawField[]>;

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function loadCommonGroups(dir: string): CommonGroups {
  const path = join(dir, '_common.json');
  const raw = readJson<Record<string, unknown>>(path);
  if (!raw) return {};
  const out: CommonGroups = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_') || k.startsWith('$')) continue;
    if (Array.isArray(v)) out[k] = v as RawField[];
  }
  return out;
}

function makeField(raw: RawField): FieldSpec {
  return {
    key: raw.key,
    label: raw.label ?? raw.key,
    category: raw.category ?? 'Advanced',
    default: raw.default ?? null,
    secret: Boolean(raw.secret),
    required: Boolean(raw.required),
    helpText: raw.help_text ?? '',
    helpUrl: raw.help_url ?? null,
    placeholder: raw.placeholder ?? null,
    validator: raw.validator ?? null,
  };
}

function makeSpec(raw: RawManifest, common: CommonGroups): ServerSpec {
  const fields: FieldSpec[] = raw.fields.map(makeField);
  for (const groupName of raw.include_common ?? []) {
    const group = common[groupName];
    if (!group) continue;
    fields.push(...group.map(makeField));
  }
  return {
    key: raw.key,
    displayName: raw.display_name,
    serverDirName: raw.server_dir_name,
    defaultPort: raw.default_port,
    appModule: raw.app_module,
    healthPath: raw.health_path,
    myselfPath: raw.myself_path,
    baseUrlEnv: raw.base_url_env,
    tokenEnv: raw.token_env,
    fields,
  };
}

export function loadManifests(): ServerSpec[] {
  const byKey = new Map<string, ServerSpec>();
  const builtInDir = manifestsDir();
  const common = loadCommonGroups(builtInDir);

  if (existsSync(builtInDir) && statSync(builtInDir).isDirectory()) {
    for (const name of readdirSync(builtInDir).sort()) {
      if (!name.endsWith('.json') || name.startsWith('_')) continue;
      const raw = readJson<RawManifest>(join(builtInDir, name));
      if (raw) byKey.set(raw.key, makeSpec(raw, common));
    }
  }

  const root = app.isPackaged ? null : resolve(app.getAppPath(), '..');
  if (root && existsSync(root)) {
    for (const entry of readdirSync(root)) {
      if (!entry.endsWith('-mcp')) continue;
      const path = join(root, entry, 'MCP-Installer.json');
      if (!existsSync(path)) continue;
      const raw = readJson<RawManifest>(path);
      if (raw) byKey.set(raw.key, makeSpec(raw, common));
    }
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Convenience — validate a field value using the built-in validators. Kept
 * server-side so the renderer never has to duplicate the rules.
 */
export function validateField(field: FieldSpec, value: string): string | null {
  const v = (value ?? '').trim();
  if (field.required && !v) return 'Required.';
  if (!v) return null;
  switch (field.validator) {
    case 'url':
      return v.startsWith('http://') || v.startsWith('https://')
        ? null
        : 'Must start with http:// or https://';
    case 'port': {
      if (!/^\d+$/.test(v)) return 'Port must be a number';
      const n = Number(v);
      return n >= 1 && n <= 65535 ? null : 'Port must be between 1 and 65535';
    }
    case 'pat_shape':
      if (v !== value) return 'Leading/trailing whitespace — did you copy an extra space?';
      if (v.length < 20) return 'Looks unusually short for a PAT — double-check you copied it fully';
      return null;
    default:
      return null;
  }
}

/**
 * Look up a manifest by key. Throws if not found; callers should surface a
 * clean 500-style error to the renderer.
 */
export function getServerOrThrow(specs: ServerSpec[], key: string): ServerSpec {
  const found = specs.find((s) => s.key === key);
  if (!found) {
    throw new Error(`Unknown server key '${key}'. Known: ${specs.map((s) => s.key).join(', ')}`);
  }
  return found;
}

/** Log a friendly summary at boot so packaging issues are obvious. */
export function describeSource(): { dir: string; found: string[] } {
  const dir = manifestsDir();
  const found = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => basename(f))
    : [];
  return { dir, found };
}
