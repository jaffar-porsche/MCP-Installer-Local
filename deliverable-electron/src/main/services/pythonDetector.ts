import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pExecFile = promisify(execFile);

export interface PythonInfo {
  found: boolean;
  executable?: string;
  version?: string;
  minSupported: string;
}

const MIN_MAJOR = 3;
const MIN_MINOR = 10;
const MIN_SUPPORTED = `${MIN_MAJOR}.${MIN_MINOR}`;

const CANDIDATES = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python'];

export async function detectPython(): Promise<PythonInfo> {
  for (const cmd of CANDIDATES) {
    try {
      const { stdout, stderr } = await pExecFile(cmd, ['--version'], {
        timeout: 5000, windowsHide: true,
      });
      const combined = `${stdout}${stderr}`;
      const m = /Python (\d+)\.(\d+)(?:\.(\d+))?/.exec(combined);
      if (!m) continue;
      const major = Number(m[1]);
      const minor = Number(m[2]);
      if (major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR)) {
        return {
          found: true,
          executable: cmd,
          version: `${major}.${minor}${m[3] ? `.${m[3]}` : ''}`,
          minSupported: MIN_SUPPORTED,
        };
      }
    } catch {
      // try next candidate
    }
  }
  return { found: false, minSupported: MIN_SUPPORTED };
}
