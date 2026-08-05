/**
 * Register MCP-Installer endpoints in VS Code / Claude Desktop config files.
 *
 * We *merge* — never replace — the existing config so any other MCP servers
 * the user has stay intact.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { ServerSpec, VsCodeIntegrationResult } from '@shared/types';

const APPDATA = process.env.APPDATA ?? '';

const VSCODE_MCP_JSON = join(APPDATA, 'Code', 'User', 'mcp.json');
const CLAUDE_JSON = join(APPDATA, 'Claude', 'claude_desktop_config.json');

export function integrateAll(specs: ServerSpec[]): VsCodeIntegrationResult {
  const entries: Record<string, { type: 'http'; url: string }> = {};
  for (const spec of specs) {
    entries[`${spec.key}-mcp`] = {
      type: 'http',
      url: `http://localhost:${spec.defaultPort}/mcp/`,
    };
  }

  const updated: string[] = [];
  const errors: string[] = [];

  for (const [path, layout] of [
    [VSCODE_MCP_JSON, 'vscode'] as const,
    [CLAUDE_JSON, 'claude'] as const,
  ]) {
    try {
      updateOne(path, entries, layout);
      updated.push(path);
    } catch (err) {
      errors.push(`${path}: ${(err as Error).message}`);
    }
  }
  return { updated, errors };
}

function updateOne(
  path: string,
  entries: Record<string, unknown>,
  layout: 'vscode' | 'claude',
): void {
  mkdirSync(dirname(path), { recursive: true });
  let existing: any = {};
  if (existsSync(path)) {
    try {
      existing = JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      throw new Error('existing config is not valid JSON — refusing to overwrite');
    }
  }
  const merged = merge(existing, entries, layout);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf-8');
  renameSync(tmp, path);
}

function merge(existing: any, entries: Record<string, unknown>, layout: 'vscode' | 'claude'): any {
  if (layout === 'vscode') {
    return { ...existing, servers: { ...(existing.servers ?? {}), ...entries } };
  }
  return { ...existing, mcpServers: { ...(existing.mcpServers ?? {}), ...entries } };
}
