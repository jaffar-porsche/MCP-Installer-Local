"""Periodic PAT-health monitor.

Runs in the launcher process (or the tray) and writes a single JSON file that
the tray icon watches for colour changes. Keeping the state on disk means the
tray, the launcher, and any CLI tool see the same picture without an IPC layer.

State file schema (%APPDATA%\\MCPorsche\\state\\health.json):

    {
        "updated_at": "2026-07-30T12:34:56Z",
        "servers": {
            "jira":       {"status": "OK", "message": "...", "checked_at": "..."},
            "confluence": {"status": "PAT_EXPIRED", "message": "...", ...},
            "gitlab":     {"status": "NETWORK", "message": "...", ...}
        }
    }
"""

from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Callable, Iterable, Optional

from . import connection_tester, env_manager, paths, schema


log = logging.getLogger(__name__)

DEFAULT_INTERVAL_SECONDS = 15 * 60   # 15 minutes


class HealthMonitor:
    """Thread-based poller. Cheap, cancellable, per-process."""

    def __init__(
        self,
        server_keys: Iterable[str],
        interval_s: int = DEFAULT_INTERVAL_SECONDS,
        on_change: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self._keys = list(server_keys)
        self._interval_s = max(60, int(interval_s))
        self._on_change = on_change
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._last_status: dict[str, str] = {}

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(
            target=self._run, name="MCPorscheHealth", daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _run(self) -> None:
        # First check immediately, then loop.
        self._check_once()
        while not self._stop.wait(self._interval_s):
            self._check_once()

    def _check_once(self) -> None:
        paths.ensure()
        results: dict[str, dict] = {}
        changed = False
        for key in self._keys:
            env_path = paths.env_file_for(key)
            values = env_manager.read_env(env_path)
            if not values:
                results[key] = {
                    "status": "UNCONFIGURED",
                    "message": "No .env file yet — run the Configurator.",
                    "checked_at": _now_iso(),
                }
            else:
                result = connection_tester.test_server(key, values, timeout=6.0)
                results[key] = {
                    "status": result.status.value,
                    "message": result.message,
                    "hint": result.hint,
                    "display_name": result.display_name,
                    "raw_status": result.raw_status,
                    "checked_at": _now_iso(),
                }
            if self._last_status.get(key) != results[key]["status"]:
                changed = True
                self._last_status[key] = results[key]["status"]

        state = {"updated_at": _now_iso(), "servers": results}
        _write_state_atomic(state)

        if changed and self._on_change is not None:
            try:
                self._on_change(state)
            except Exception:  # pragma: no cover — never let the callback kill the monitor
                log.exception("on_change callback raised")


def load_state() -> dict:
    """Read the current state file. Returns {} when unavailable."""
    try:
        return json.loads(paths.HEALTH_STATE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_state_atomic(state: dict) -> None:
    paths.ensure()
    tmp = paths.HEALTH_STATE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    import os
    os.replace(tmp, paths.HEALTH_STATE_FILE)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
