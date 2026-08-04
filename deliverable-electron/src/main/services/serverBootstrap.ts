import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ServerSpec } from '@shared/types';

import {
  BOOTSTRAP_LOG,
  ensureDataDirs,
  envFile,
  requirementsFile,
  serverDir,
  venvDir,
  venvPython,
} from './paths';
import { markServerBootstrapped } from './installationStore';
import { writeEnv } from './envManager';

export type BootstrapPhase =
  | 'venv'
  | 'pip-upgrade'
  | 'requirements'
  | 'env'
  | 'done';

export interface BulkProgress {
  phase: BootstrapPhase;
  message: string;
  percent: number;
  currentServer?: string;
}

export interface BulkBootstrapOptions {
  specs: ServerSpec[];
  pythonExecutable: string;
  envValuesByServer: Record<string, Record<string, string>>;
  proxy?: string | null;
  force?: boolean;
  onProgress?: (evt: BulkProgress) => void;
}

const PHASE_LABEL: Record<BootstrapPhase, string> = {
  'venv': 'Creating Python virtual environment',
  'pip-upgrade': 'Upgrading pip',
  'requirements': 'Installing Python dependencies',
  'env': 'Writing configuration',
  'done': 'Setup complete',
};

/**
 * Bootstrap every selected server sequentially. Sequential is more reliable
 * than parallel behind corporate proxies (concurrent pip installs contend
 * for the same TLS pool and often hang).
 */
export async function bulkBootstrap(opts: BulkBootstrapOptions): Promise<void> {
  const { specs, pythonExecutable, envValuesByServer, proxy, onProgress } = opts;
  ensureDataDirs();
  await appendLog(`\n=== Bulk bootstrap ${new Date().toISOString()} — ${specs.length} servers ===\n`);

  if (specs.length === 0) throw new Error('No servers to bootstrap.');

  for (const spec of specs) {
    if (!existsSync(serverDir(spec.serverDirName))) {
      throw new Error(`Missing sources: ${serverDir(spec.serverDirName)}. Reinstall MCPorsche.`);
    }
  }

  // Each server contributes 4 phases; +1 sentinel for "done".
  const totalTicks = specs.length * 4 + 1;
  let tick = 0;
  const emit = (phase: BootstrapPhase, spec?: ServerSpec) => {
    tick += 1;
    const percent = Math.min(100, Math.round((tick / totalTicks) * 100));
    const message = spec
      ? `${PHASE_LABEL[phase]} — ${spec.displayName}`
      : PHASE_LABEL[phase];
    onProgress?.({ phase, message, percent, currentServer: spec?.key });
  };

  for (const spec of specs) {
    emit('venv', spec);
    await ensureVenv(spec, pythonExecutable);

    emit('pip-upgrade', spec);
    await pipRun(spec, ['install', '--upgrade', 'pip'], proxy);

    emit('requirements', spec);
    await pipRun(spec, ['install', '-r', requirementsFile(spec.serverDirName)], proxy);

    emit('env', spec);
    const values = envValuesByServer[spec.key] ?? {};
    await writeEnv(
      envFile(spec.serverDirName),
      values,
      'MCPorsche — configured by the Setup Wizard.',
    );
    markServerBootstrapped(spec.key, { requirementsHash: '', sourceHash: '' });
    await appendLog(`[${spec.key}] bootstrap complete\n`);
  }

  emit('done');
  await appendLog('=== Bulk bootstrap: DONE ===\n');
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

async function ensureVenv(spec: ServerSpec, pythonExecutable: string): Promise<void> {
  const venvPy = venvPython(spec.serverDirName, 'default');
  if (existsSync(venvPy)) {
    await appendLog(`[${spec.key}] venv exists, reusing\n`);
    return;
  }
  await run(pythonExecutable, ['-m', 'venv', venvDir(spec.serverDirName)], spec.key);
}

async function pipRun(spec: ServerSpec, args: string[], proxy?: string | null): Promise<void> {
  const py = venvPython(spec.serverDirName, 'default');
  const proxyArgs = proxy ? ['--proxy', proxy] : [];
  const full = ['-m', 'pip', '--disable-pip-version-check', '--quiet', ...args, ...proxyArgs];
  await run(py, full, spec.key);
}

async function run(cmd: string, args: string[], key: string): Promise<void> {
  await appendLog(`[${key}] $ ${cmd} ${args.join(' ')}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.stderr.on('data', (c: Buffer) => chunks.push(c));
    child.on('error', reject);
    child.on('exit', async (code) => {
      const output = Buffer.concat(chunks).toString('utf-8');
      await appendLog(`[${key}] ${output}\n[${key}] exit=${code}\n`);
      if (code === 0) resolve();
      else reject(new Error(`${key}: ${cmd} exited ${code} — ${output.slice(-300)}`));
    });
  });
}

async function appendLog(line: string): Promise<void> {
  try {
    await mkdir(dirname(BOOTSTRAP_LOG), { recursive: true });
    await appendFile(BOOTSTRAP_LOG, line);
  } catch {
    /* ignore */
  }
}
