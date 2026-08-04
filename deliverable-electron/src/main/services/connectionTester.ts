/**
 * Classified connection tester. Given form values, hit the upstream
 * `/myself`-style endpoint and return a TestResult the UI can act on.
 *
 * Uses global `fetch` (Node 20+) so no extra dep is needed. When a proxy
 * URL is set we plug in an undici ProxyAgent — undici ships with Node ≥ 18
 * so no additional package is required.
 */
import type {
  ServerSpec,
  TestResult,
} from '@shared/types';

export async function testConnection(
  spec: ServerSpec,
  values: Record<string, string>,
  timeoutMs = 8000,
): Promise<TestResult> {
  const baseUrl = (values[spec.baseUrlEnv] ?? '').trim();
  const token = (values[spec.tokenEnv] ?? '').trim();
  if (!baseUrl) return { status: 'UNKNOWN', message: 'Base URL is empty. Fill it before testing.' };
  if (!token) {
    return {
      status: 'PAT_INVALID',
      message: 'No PAT provided. Paste your token and try again.',
      hint: "Use the 'Get PAT' link next to the field.",
    };
  }
  const url = `${baseUrl.replace(/\/$/, '')}${spec.myselfPath}`;
  const proxyUrl = values.HTTPS_PROXY?.trim() || values.HTTP_PROXY?.trim() || null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const opts: any = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'MCPorsche-Configurator/2.0',
      },
      signal: controller.signal,
    };
    if (proxyUrl) {
      // Node 20 `fetch` uses undici; setting `dispatcher` is the modern way,
      // but for max compat we use the classic proxy-agent shim via undici.
      const undici = await import('undici').catch(() => null);
      if (undici) {
        opts.dispatcher = new undici.ProxyAgent(proxyUrl);
      }
    }
    const resp = await fetch(url, opts);
    return classifyResponse(resp);
  } catch (err: any) {
    return classifyError(err);
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyResponse(resp: Response): Promise<TestResult> {
  const status = resp.status;
  const body = await safeText(resp);
  if (status === 200) {
    const name = extractDisplayName(body);
    return {
      status: 'OK',
      message: 'PAT accepted by the server.',
      displayName: name ?? undefined,
      rawStatus: status,
    };
  }
  if (status === 407) {
    return {
      status: 'PROXY_REQUIRED',
      message: 'Proxy authentication required (HTTP 407).',
      hint: 'Fill HTTP_PROXY / HTTPS_PROXY, or click Auto-detect proxy.',
      rawStatus: status,
    };
  }
  if (status === 401 || status === 403) {
    const expired = /expired/i.test(body) || /token has expired/i.test(body);
    return expired
      ? {
          status: 'PAT_EXPIRED',
          message: 'Your PAT has expired.',
          hint: "Create a new PAT via 'Rotate PAT' and re-test.",
          rawStatus: status,
        }
      : {
          status: 'PAT_INVALID',
          message: `Server rejected the PAT (HTTP ${status}).`,
          hint: 'The token is invalid, revoked or lacks required scopes.',
          rawStatus: status,
        };
  }
  if (status >= 500) {
    return {
      status: 'NETWORK',
      message: `Upstream server error (HTTP ${status}).`,
      hint: 'The Atlassian / GitLab service is unhealthy — retry in a minute.',
      rawStatus: status,
    };
  }
  return {
    status: 'UNKNOWN',
    message: `Unexpected HTTP ${status}. Body preview: ${body.slice(0, 200)}`,
    rawStatus: status,
  };
}

function classifyError(err: unknown): TestResult {
  const msg = err instanceof Error ? err.message : String(err);
  const lowered = msg.toLowerCase();
  if (lowered.includes('abort')) {
    return {
      status: 'NETWORK',
      message: 'Timed out contacting the server.',
      hint: 'Check base URL, VPN and proxy settings.',
    };
  }
  if (lowered.includes('enotfound') || lowered.includes('eai_again') || lowered.includes('getaddrinfo')) {
    return { status: 'NETWORK', message: `DNS lookup failed: ${msg}`, hint: 'Are you on VPN / corporate network?' };
  }
  if (lowered.includes('econnrefused')) {
    return { status: 'NETWORK', message: `Connection refused: ${msg}`, hint: 'Verify base URL, port, proxy.' };
  }
  if (lowered.includes('cert') || lowered.includes('ssl') || lowered.includes('tls')) {
    return {
      status: 'CERT_ERROR',
      message: `TLS / certificate failure: ${msg}`,
      hint: 'Corporate CA may be missing. See the Atlassian README workaround.',
    };
  }
  if (lowered.includes('proxy')) {
    return {
      status: 'PROXY_REQUIRED',
      message: `Proxy problem: ${msg}`,
      hint: 'Fill HTTP_PROXY / HTTPS_PROXY, or click Auto-detect proxy.',
    };
  }
  return { status: 'NETWORK', message: `Network error: ${msg}` };
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}

function extractDisplayName(body: string): string | null {
  try {
    const data = JSON.parse(body);
    for (const key of ['displayName', 'name', 'username', 'email', 'emailAddress']) {
      const v = data?.[key];
      if (typeof v === 'string' && v) return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}
