/**
 * Detect Windows corporate proxy settings via PowerShell + registry.
 *
 * We call PowerShell instead of adding a native `winreg` dep so builds stay
 * pure JavaScript. Same pattern as Python's `proxy_detector`.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { DetectedProxy } from '@shared/types';

const pExecFile = promisify(execFile);

export async function detectProxy(): Promise<DetectedProxy> {
  // 1. Env vars win (explicit user override in the shell that launched us).
  const envHttp = process.env.HTTP_PROXY ?? process.env.http_proxy ?? null;
  const envHttps = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? null;
  if (envHttp || envHttps) {
    return { http: envHttp, https: envHttps, source: 'env' };
  }
  if (process.platform !== 'win32') {
    return { http: null, https: null, source: 'none' };
  }
  try {
    return await readWindowsRegistryProxy();
  } catch {
    return { http: null, https: null, source: 'none' };
  }
}

async function readWindowsRegistryProxy(): Promise<DetectedProxy> {
  const script =
    "$ies = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; " +
    'try {' +
    '  $enable = (Get-ItemProperty -Path $ies -Name ProxyEnable -ErrorAction Stop).ProxyEnable;' +
    '  $server = (Get-ItemProperty -Path $ies -Name ProxyServer -ErrorAction Stop).ProxyServer;' +
    '  Write-Output ("enable=" + $enable);' +
    '  Write-Output ("server=" + $server)' +
    '} catch { Write-Output "enable=0"; Write-Output "server=" }';
  const { stdout } = await pExecFile('powershell', ['-NoProfile', '-Command', script], {
    windowsHide: true,
    timeout: 8000,
  });
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const enable = lines.find((l) => l.startsWith('enable='))?.slice(7).trim() ?? '0';
  const server = lines.find((l) => l.startsWith('server='))?.slice(7).trim() ?? '';
  if (enable === '0' || !server) {
    return { http: null, https: null, source: 'registry' };
  }
  return parseProxyServer(server);
}

function parseProxyServer(raw: string): DetectedProxy {
  const value = raw.trim();
  if (!value) return { http: null, https: null, source: 'registry' };
  if (!value.includes('=')) {
    const url = normalize(value);
    return { http: url, https: url, source: 'registry' };
  }
  let http: string | null = null;
  let https: string | null = null;
  for (const chunk of value.split(';')) {
    const idx = chunk.indexOf('=');
    if (idx < 0) continue;
    const scheme = chunk.slice(0, idx).trim().toLowerCase();
    const url = normalize(chunk.slice(idx + 1));
    if (scheme === 'http') http = url;
    else if (scheme === 'https') https = url;
  }
  return { http: http ?? https, https: https ?? http, source: 'registry' };
}

function normalize(hostPort: string): string {
  const v = hostPort.trim();
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return `http://${v}`;
}
