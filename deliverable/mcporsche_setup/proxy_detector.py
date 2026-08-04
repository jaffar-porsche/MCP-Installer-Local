"""Detect corporate proxy settings from Windows.

On Porsche corporate machines the proxy is typically configured system-wide.
Rather than asking a non-technical user to hunt for it, we read the Windows
Internet Settings registry key and normalise the result.

Falls back to environment variables (`HTTP_PROXY`, `HTTPS_PROXY`) and, on
non-Windows dev machines, returns whatever env vars are set.
"""

from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass
from typing import Optional


log = logging.getLogger(__name__)


@dataclass(frozen=True)
class DetectedProxy:
    http: Optional[str]
    https: Optional[str]
    source: str  # 'registry' | 'env' | 'none'

    @property
    def is_set(self) -> bool:
        return bool(self.http or self.https)


def detect() -> DetectedProxy:
    """Best-effort detection. Never raises."""
    # Priority 1: current env vars (user overrode them explicitly).
    env_http = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    env_https = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if env_http or env_https:
        log.info("Proxy detected from environment variables")
        return DetectedProxy(env_http, env_https, "env")

    # Priority 2: Windows registry (IE / system proxy).
    if sys.platform == "win32":
        try:
            proxy = _read_windows_proxy()
            if proxy.is_set:
                log.info("Proxy detected from Windows registry: %s", proxy)
                return proxy
        except Exception:  # pragma: no cover — defensive
            log.debug("Failed to read Windows registry proxy", exc_info=True)

    return DetectedProxy(None, None, "none")


def _read_windows_proxy() -> DetectedProxy:
    import winreg  # type: ignore[import-not-found]

    key_path = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path) as k:
        try:
            enabled, _ = winreg.QueryValueEx(k, "ProxyEnable")
        except FileNotFoundError:
            enabled = 0
        if not enabled:
            return DetectedProxy(None, None, "registry")
        try:
            server, _ = winreg.QueryValueEx(k, "ProxyServer")
        except FileNotFoundError:
            return DetectedProxy(None, None, "registry")

    return _parse_proxy_server_value(str(server))


def _parse_proxy_server_value(raw: str) -> DetectedProxy:
    """Windows stores proxies either as 'host:port' or 'http=host:port;https=host:port'."""
    raw = raw.strip()
    if not raw:
        return DetectedProxy(None, None, "registry")

    if "=" not in raw:
        # single-proxy form
        url = _normalise(raw)
        return DetectedProxy(url, url, "registry")

    http: Optional[str] = None
    https: Optional[str] = None
    for chunk in raw.split(";"):
        if "=" not in chunk:
            continue
        scheme, value = chunk.split("=", 1)
        url = _normalise(value)
        s = scheme.strip().lower()
        if s == "http":
            http = url
        elif s == "https":
            https = url
    # If only one was set, mirror it — most corporate proxies handle both.
    return DetectedProxy(http or https, https or http, "registry")


def _normalise(host_port: str) -> str:
    v = host_port.strip()
    if v.startswith("http://") or v.startswith("https://"):
        return v
    return f"http://{v}"
