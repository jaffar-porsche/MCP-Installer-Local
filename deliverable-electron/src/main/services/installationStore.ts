import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { INSTALLATION_STATE_FILE } from './paths';

export interface ServerBootstrapState {
  sourceHash: string;
  bootstrappedAt: number;
  requirementsHash: string;
}

export interface InstallationState {
  appVersion: string;
  firstInstallAt: number;
  lastUpdatedAt: number;
  wizardCompleted: boolean;
  servers: Record<string, ServerBootstrapState>;
}

const empty = (): InstallationState => ({
  appVersion: app.getVersion(),
  firstInstallAt: Date.now(),
  lastUpdatedAt: Date.now(),
  wizardCompleted: false,
  servers: {},
});

export function loadInstallation(): InstallationState {
  try {
    const raw = readFileSync(INSTALLATION_STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as InstallationState;
    if (!parsed.servers) parsed.servers = {};
    return parsed;
  } catch {
    return empty();
  }
}

export function saveInstallation(state: InstallationState): void {
  mkdirSync(dirname(INSTALLATION_STATE_FILE), { recursive: true });
  const tmp = `${INSTALLATION_STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tmp, INSTALLATION_STATE_FILE);
}

export function markWizardCompleted(): void {
  const s = loadInstallation();
  s.wizardCompleted = true;
  s.lastUpdatedAt = Date.now();
  saveInstallation(s);
}

export function markServerBootstrapped(
  key: string,
  patch: Partial<ServerBootstrapState>,
): void {
  const s = loadInstallation();
  s.servers[key] = {
    sourceHash: '',
    bootstrappedAt: Date.now(),
    requirementsHash: '',
    ...(s.servers[key] ?? {}),
    ...patch,
  };
  s.lastUpdatedAt = Date.now();
  saveInstallation(s);
}

export function wizardCompleted(): boolean {
  return existsSync(INSTALLATION_STATE_FILE) && loadInstallation().wizardCompleted;
}
