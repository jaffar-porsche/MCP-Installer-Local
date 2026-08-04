/**
 * Persist the set of MCP servers the user chose in the Setup Wizard.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { ensureDataDirs, SELECTED_SERVERS_FILE } from './paths';

export async function loadSelection(): Promise<string[] | null> {
  try {
    const raw = await readFile(SELECTED_SERVERS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data.filter((k): k is string => typeof k === 'string');
    return null;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    return null;
  }
}

export async function saveSelection(keys: string[]): Promise<void> {
  ensureDataDirs();
  const tmp = `${SELECTED_SERVERS_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(keys), 'utf-8');
  const { rename } = await import('node:fs/promises');
  await rename(tmp, SELECTED_SERVERS_FILE);
}
