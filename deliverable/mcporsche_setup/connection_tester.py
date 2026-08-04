"""Classified connection tester.

Given a server key + the current form values, hit the upstream `/myself`
endpoint and return a classified `TestResult`. This lets the UI show *why*
something failed, not just "it failed", so a non-technical user can act
without opening a ticket.

Failure categories (tagged union):

    OK              — auth works, upstream reachable
    PAT_INVALID     — 401/403 with a specific "invalid credentials" body
    PAT_EXPIRED     — 401 with an expiry hint (server plugin-specific)
    NETWORK         — DNS failure / connection refused / TLS trust failure
    PROXY_REQUIRED  — 407 or the classic "no route to host" from bare connect
    CERT_ERROR      — mTLS handshake failed
    UNKNOWN         — everything else, includes raw body for support tickets

Uses only the Python stdlib (`urllib.request`) so the tester runs before any
requirements have been installed.
"""

from __future__ import annotations

import json
import logging
import socket
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from enum import Enum
from typing import Optional

from . import schema


log = logging.getLogger(__name__)


class Status(str, Enum):
    OK = "OK"
    PAT_INVALID = "PAT_INVALID"
    PAT_EXPIRED = "PAT_EXPIRED"
    NETWORK = "NETWORK"
    PROXY_REQUIRED = "PROXY_REQUIRED"
    CERT_ERROR = "CERT_ERROR"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class TestResult:
    status: Status
    message: str
    display_name: Optional[str] = None   # e.g. authenticated user's name
    hint: Optional[str] = None           # actionable next-step for the user
    raw_status: Optional[int] = None     # HTTP status code, if any

    @property
    def is_ok(self) -> bool:
        return self.status is Status.OK


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def test_server(server_key: str, values: dict[str, str], *, timeout: float = 8.0) -> TestResult:
    """Run a live connection test for the given server against the given values.

    Fully data-driven: the base-URL and token env vars are read from the
    manifest, so brand-new MCP servers work with no change to this file.
    """
    spec = schema.get_server(server_key)

    base_url = _first(values, spec.base_url_env)
    token = _first(values, spec.token_env)
    if not base_url:
        return TestResult(Status.UNKNOWN, "Base URL is empty. Fill it before testing.")
    if not token:
        return TestResult(Status.PAT_INVALID, "No PAT provided. Paste your token and try again.",
                          hint="Use the 'Get PAT' link next to the field.")

    url = base_url.rstrip("/") + spec.myself_path
    proxies = _build_proxies(values)

    return _http_get_json(url, token, proxies, timeout=timeout)


# --------------------------------------------------------------------------- #
# Internals
# --------------------------------------------------------------------------- #

def _first(values: dict[str, str], key: str) -> str:
    return (values.get(key) or "").strip()


def _build_proxies(values: dict[str, str]) -> dict[str, str]:
    proxies: dict[str, str] = {}
    for scheme, key in (("http", "HTTP_PROXY"), ("https", "HTTPS_PROXY")):
        v = _first(values, key)
        if v:
            proxies[scheme] = v
    return proxies


def _http_get_json(url: str, token: str, proxies: dict[str, str],
                   *, timeout: float) -> TestResult:
    handlers: list = []
    if proxies:
        handlers.append(urllib.request.ProxyHandler(proxies))
    else:
        # Ensure we don't accidentally inherit env proxies from a shell that had them.
        handlers.append(urllib.request.ProxyHandler({}))

    # Best-effort TLS: use default CA bundle (Windows corporate trust store is
    # honoured by Python 3.11+). The context must be attached via HTTPSHandler
    # because urllib's OpenerDirector.open() does not accept a `context=` kwarg.
    context = ssl.create_default_context()
    handlers.append(urllib.request.HTTPSHandler(context=context))

    opener = urllib.request.build_opener(*handlers)
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "MCPorsche-Configurator/1.0",
    })

    try:
        with opener.open(req, timeout=timeout) as resp:
            status = resp.getcode()
            body = resp.read(4096)
    except urllib.error.HTTPError as e:
        return _classify_http_error(e)
    except urllib.error.URLError as e:
        return _classify_url_error(e)
    except (socket.timeout, TimeoutError):
        return TestResult(
            Status.NETWORK,
            f"Timed out after {timeout:.0f}s connecting to {url}.",
            hint="Check the base URL, VPN/GlobalProtect and proxy settings.",
        )
    except ssl.SSLError as e:
        return TestResult(
            Status.CERT_ERROR,
            f"TLS handshake failed: {e}",
            hint="If you use certificate-based auth, verify CERT_PATH and CERT_PASSWORD.",
        )
    except Exception as e:  # pragma: no cover — safety net
        return TestResult(Status.UNKNOWN, f"Unexpected error: {e}")

    display_name = _extract_display_name(body)
    return TestResult(
        Status.OK,
        "PAT accepted by the server.",
        display_name=display_name,
        raw_status=status,
    )


def _classify_http_error(e: urllib.error.HTTPError) -> TestResult:
    body = ""
    try:
        body = e.read(2048).decode("utf-8", errors="replace")
    except Exception:  # pragma: no cover
        pass

    code = e.code
    if code == 407:
        return TestResult(
            Status.PROXY_REQUIRED, "Proxy authentication required (HTTP 407).",
            hint="Fill in HTTP_PROXY / HTTPS_PROXY, or click Auto-detect proxy.",
            raw_status=code,
        )
    if code in (401, 403):
        expired = "expired" in body.lower() or "token has expired" in body.lower()
        if expired:
            return TestResult(
                Status.PAT_EXPIRED, "Your PAT has expired.",
                hint="Create a new PAT via the 'Rotate PAT' link, paste it and re-test.",
                raw_status=code,
            )
        return TestResult(
            Status.PAT_INVALID, f"Server rejected the PAT (HTTP {code}).",
            hint="The token is invalid, revoked or lacks required scopes.",
            raw_status=code,
        )
    if code >= 500:
        return TestResult(
            Status.NETWORK, f"Upstream server error (HTTP {code}).",
            hint="The Atlassian/GitLab service is unhealthy — retry in a minute.",
            raw_status=code,
        )
    return TestResult(
        Status.UNKNOWN, f"Unexpected HTTP {code}. Body preview: {body[:200]}",
        raw_status=code,
    )


def _classify_url_error(e: urllib.error.URLError) -> TestResult:
    reason = str(getattr(e, "reason", e))
    lowered = reason.lower()
    if any(s in lowered for s in ("name or service not known", "getaddrinfo failed",
                                  "nodename nor servname")):
        return TestResult(
            Status.NETWORK, f"DNS lookup failed: {reason}",
            hint="Are you on VPN / connected to the corporate network?",
        )
    if any(s in lowered for s in ("connection refused", "actively refused")):
        return TestResult(
            Status.NETWORK, f"Connection refused: {reason}",
            hint="Check the base URL and port. Verify proxy settings.",
        )
    if "certificate" in lowered or "ssl" in lowered:
        return TestResult(
            Status.CERT_ERROR, f"TLS/cert failure: {reason}",
            hint="Corporate CA may be missing. See the Atlassian README for DevX CLI workaround.",
        )
    if "proxy" in lowered:
        return TestResult(
            Status.PROXY_REQUIRED, f"Proxy problem: {reason}",
            hint="Fill HTTP_PROXY / HTTPS_PROXY, or click Auto-detect proxy.",
        )
    return TestResult(Status.NETWORK, f"Network error: {reason}")


def _extract_display_name(body: bytes) -> Optional[str]:
    """Pull a friendly identifier out of the /myself / /user JSON response."""
    try:
        data = json.loads(body.decode("utf-8", errors="replace"))
    except Exception:
        return None
    for k in ("displayName", "name", "username", "email", "emailAddress"):
        v = data.get(k) if isinstance(data, dict) else None
        if isinstance(v, str) and v:
            return v
    return None
