/**
 * Server subprocess supervisor.
 *
 *  * Spawns each MCP server *detached* via `pythonw.exe` — no console flash.
 *  * Persists PIDs so a re-launched app attaches to still-running servers
 *    rather than starting duplicates.
 *  * Polls `/health/pat` every 3 s and emits status snapshots.
 *
 * The Controller exposes an EventEmitter so `main/index.ts` can rebroadcast
 * status snapshots to the renderer over IPC.
 */
import { spawn, execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { RunState, RuntimeSnapshot, ServerSpec } from '@shared/types';

import {
  envFile,
  ensureDataDirs,
  logFileFor,
  pidFileFor,
  serverDir,
  venvPython,
} from './paths';
import { readEnv } from './envManager';

import { exec } from 'node:child_process';

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
      if (err || !stdout) return resolve(false);

      // if ANY LISTENING entry exists → port is busy
      const lines = stdout.split('\n');
      const inUse = lines.some((l) => l.includes('LISTENING'));
      resolve(inUse);
    });
  });
}
const HEALTH_INTERVAL_MS = 3000;

interface ManagedProc {
  spec: ServerSpec;
  child: ReturnType<typeof spawn> | null;
  pid: number | null;
  state: RunState;
  message: string;
  displayUser: string | null;
}

export class ServerController extends EventEmitter {
  private procs = new Map<string, ManagedProc>();
  private poller: NodeJS.Timeout | null = null;

  constructor(private readonly specs: ServerSpec[]) {
    super();
    for (const spec of specs) {
      const pid = readPidFile(spec.key);
      this.procs.set(spec.key, {
        spec,
        child: null,
        pid: pid && isPidAlive(pid) ? pid : null,
        state: 'STOPPED',
        message: '',
        displayUser: null,
      });

      if (pid && !isPidAlive(pid)) clearPidFile(spec.key);
    }
  }

  keys(): string[] {
    return [...this.procs.keys()];
  }

  snapshotAll(): RuntimeSnapshot[] {
    return [...this.procs.values()].map((p) => this.snapshot(p));
  }

  async start(key: string): Promise<RuntimeSnapshot> {
    
    const proc = this.mustGet(key);
    
    if (this.isAlive(proc)) return this.snapshot(proc);

    const values = await readEnv(envFile(proc.spec.serverDirName));
    if (Object.keys(values).length === 0) {
      this.set(proc, 'UNCONFIGURED', 'No .env file yet — run the Setup Wizard.');
      return this.snapshot(proc);
    }
    const py = venvPython(proc.spec.serverDirName, 'windowless');
    if (!existsSync(py)) {
      this.set(
        proc,
        'ERROR',
        `Virtual environment missing.\nRun install first.\nExpected: ${py}`,
      );
      return this.snapshot(proc);
    }

    ensureDataDirs();
    const logPath = logFileFor(proc.spec.key);
    if (!existsSync(dirname(logPath))) mkdirSync(dirname(logPath), { recursive: true });
    const out = openSync(logPath, 'a');

    const port = this.portOf(proc, values);

// 🚨 PRODUCTION-SAFE PORT CHECK (ADD HERE)
if (await isPortInUse(port)) {
  this.set(
    proc,
    'ERROR',
    `Port ${port} is already in use.\nPlease close the conflicting app or change MCP_PORT in .env.`
  );

  this.emitChange();
  return this.snapshot(proc);
}

const args = [
      '-m',
      'uvicorn',
      proc.spec.appModule,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
    ];

    const child = spawn(py, args, {
      cwd: serverDir(proc.spec.serverDirName),
      // stdin ignored, stdout+stderr → log file
      stdio: ['ignore', out, out],
      // The two combined lines below hide the child's console AND let it
      // outlive us. Node docs: `detached: true` on Windows lets the child
      // continue after parent exit; `windowsHide: true` prevents the
      // otherwise-required console window from appearing.
      detached: false,
      windowsHide: true,
    });
    

    proc.child = child;
    proc.pid = child.pid ?? null;
    if (proc.pid) writePidFile(proc.spec.key, proc.pid);
    this.set(proc, 'STARTING', 'Waiting for health probe…');

    child.on('exit', (code) => {
      if (proc.state === 'STOPPED') return; // user-initiated
      this.set(proc, 'CRASHED', `Server exited (code ${code ?? 'unknown'}). See ${logPath}`);
      proc.child = null;
      proc.pid = null;
      clearPidFile(proc.spec.key);
      this.emitChange();
    });

    this.emitChange();
    return this.snapshot(proc);
  }

  async stop(key: string): Promise<RuntimeSnapshot> {
    const proc = this.mustGet(key);
    const child = proc.child;
    const pid = proc.pid;
    if (child && child.exitCode === null) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    } else if (pid && isPidAlive(pid)) {
      try {
        await taskkill(pid);
      } catch {
        /* ignore */
      }
    }
    proc.child = null;
    proc.pid = null;
    clearPidFile(proc.spec.key);
    this.set(proc, 'STOPPED', 'Stopped.');
    this.emitChange();
    return this.snapshot(proc);
  }

  async restart(key: string): Promise<RuntimeSnapshot> {
    await this.stop(key);
    await sleep(700);
    return this.start(key);
  }

  async startAll(): Promise<RuntimeSnapshot[]> {
    for (const key of this.procs.keys()) await this.start(key);
    return this.snapshotAll();
  }

  async stopAll(): Promise<RuntimeSnapshot[]> {
    for (const key of this.procs.keys()) await this.stop(key);
    return this.snapshotAll();
  }

  startPoller(): void {
    if (this.poller) return;
    this.poller = setInterval(() => void this.pollOnce(), HEALTH_INTERVAL_MS);
    void this.pollOnce();
  }

  stopPoller(): void {
    if (this.poller) clearInterval(this.poller);
    this.poller = null;
  }

  logPath(key: string): string {
    return logFileFor(key);
  }

  // ---- internals -------------------------------------------------------- //

  async pollOnce(): Promise<void> {
    let changed = false;
    for (const proc of this.procs.values()) {
      const before = proc.state;
      await this.probe(proc);
      if (proc.state !== before) changed = true;
    }
    if (changed) this.emitChange();
  }

  private async probe(proc: ManagedProc): Promise<void> {
    const values = await readEnv(envFile(proc.spec.serverDirName));
    if (Object.keys(values).length === 0) {
      this.set(proc, 'UNCONFIGURED', 'No .env yet — run the Setup Wizard.');
      return;
    }
    if (!proc.child && !proc.pid) {
      this.set(proc, 'STOPPED', 'Not running.');
      return;
    }
    if (!this.isAlive(proc) && proc.state !== 'STOPPED') {
      this.set(proc, 'CRASHED', 'Server exited unexpectedly. See logs.');
      proc.child = null;
      proc.pid = null;
      clearPidFile(proc.spec.key);
      return;
    }
    const port = this.portOf(proc, values);
    const url = `http://127.0.0.1:${port}${proc.spec.healthPath}`;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (resp.status === 200) {
        const body = await resp.text();
        const patState = extractPatState(body);
        proc.displayUser = extractUser(body);
        if (patState === 'UNKNOWN') {
          this.set(proc, 'STARTING', `Server responding on port ${port}. Verifying PAT…`);
        } else if (patState === 'INVALID') {
          this.set(proc, 'RUNNING_PAT_BAD', 'PAT is invalid or expired.');
        } else {
          this.set(
            proc,
            'RUNNING_OK',
            `Running on port ${port}.${proc.displayUser ? ` User: ${proc.displayUser}` : ''}`,
          );
        }
      } else if (resp.status === 401) {
        this.set(proc, 'RUNNING_PAT_BAD', 'PAT is invalid or expired.');
      } else {
        this.set(proc, 'ERROR', `HTTP ${resp.status} from /health/pat`);
      }
    } catch {
      // Probe failed → still starting.
      this.set(proc, 'STARTING', 'Health probe not responding yet.');
    }
  }

  private portOf(proc: ManagedProc, values: Record<string, string>): number {
    const raw = (values.MCP_PORT ?? '').trim();
    if (/^\d+$/.test(raw)) return Number(raw);
    return proc.spec.defaultPort;
  }

  private isAlive(proc: ManagedProc): boolean {
    if (proc.child && proc.child.exitCode === null) return true;
    if (proc.pid && isPidAlive(proc.pid)) return true;
    return false;
  }

  private set(proc: ManagedProc, state: RunState, message: string): void {
    proc.state = state;
    proc.message = message;
  }

  private snapshot(proc: ManagedProc): RuntimeSnapshot {
    return {
      key: proc.spec.key,
      displayName: proc.spec.displayName,
      port: proc.spec.defaultPort,
      state: proc.state,
      message: proc.message,
      pid: proc.child?.pid ?? proc.pid ?? null,
      displayUser: proc.displayUser,
      updatedAt: Date.now(),
    };
  }

  private mustGet(key: string): ManagedProc {
    const p = this.procs.get(key);
    if (!p) throw new Error(`Unknown server '${key}'`);
    return p;
  }

  private emitChange(): void {
    this.emit('change', this.snapshotAll());
  }
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

function readPidFile(key: string): number | null {
  try {
    const raw = readFileSync(pidFileFor(key), 'utf-8').trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writePidFile(key: string, pid: number): void {
  try {
    ensureDataDirs();
    writeFileSync(pidFileFor(key), String(pid), 'utf-8');
  } catch {
    /* ignore */
  }
}

function clearPidFile(key: string): void {
  try {
    unlinkSync(pidFileFor(key));
  } catch {
    /* ignore */
  }
}

/**
 * PID existence probe. On POSIX we use `process.kill(pid, 0)`. On Windows
 * that signal can be delivered instead of probed, so we spawn a short
 * `tasklist` and look for the PID column.
 */
function isPidAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  if (process.platform !== 'win32') {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
    const out = execFileSync(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { encoding: 'utf-8', windowsHide: true, timeout: 4000 },
    );
    return out.includes(`"${pid}"`);
  } catch {
    return false;
  }
}

async function taskkill(pid: number): Promise<void> {
  if (process.platform !== 'win32') {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* ignore */
    }
    return;
  }
  return new Promise((resolve) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractUser(body: string): string | null {
  try {
    const data = JSON.parse(body);
    const pat = data?.pat ?? {};
    for (const k of ['display_name', 'displayName', 'name', 'username']) {
      const v = pat?.[k] ?? data?.[k];
      if (typeof v === 'string' && v) return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function extractPatState(body: string): string | null {
  try {
    const data = JSON.parse(body);
    const state = data?.pat?.state;
    return typeof state === 'string' ? state : null;
  } catch {
    return null;
  }
}
