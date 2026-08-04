"""Thread-safe PAT status tracker for Confluence MCP.

Every outbound HTTP call from the client goes through the shared session.
When we observe a 401 / 403, this module records the failure so:

    * The ``/health/pat`` endpoint returns HTTP 401 — the MCPorsche tray
      icon / Control Panel poll this and turn red.
    * Every subsequent MCP tool call raises a friendly error instead of a
      cryptic 500, so the AI assistant tells the user to rotate the PAT.

The API mirrors ``jira-mcp/pat_status.py`` so both servers can be swept by
the same monitoring code.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class PATState(str, Enum):
    UNKNOWN = "UNKNOWN"       # no call made yet
    OK = "OK"                 # last observed call was 2xx
    INVALID = "INVALID"       # last observed call was 401 / 403


@dataclass
class PATStatus:
    state: PATState = PATState.UNKNOWN
    since: float = field(default_factory=time.time)
    last_status_code: Optional[int] = None
    last_error: Optional[str] = None

    def as_dict(self) -> dict:
        return {
            "state": self.state.value,
            "since_epoch": self.since,
            "last_status_code": self.last_status_code,
            "last_error": self.last_error,
        }


_lock = threading.Lock()
_status = PATStatus()


def get() -> PATStatus:
    """Return a snapshot copy of the current PAT status."""
    with _lock:
        return PATStatus(
            state=_status.state,
            since=_status.since,
            last_status_code=_status.last_status_code,
            last_error=_status.last_error,
        )


def record_success(status_code: int) -> None:
    with _lock:
        if _status.state != PATState.OK:
            _status.since = time.time()
        _status.state = PATState.OK
        _status.last_status_code = status_code
        _status.last_error = None


def record_unauthorized(status_code: int, body_snippet: str = "") -> None:
    with _lock:
        if _status.state != PATState.INVALID:
            _status.since = time.time()
        _status.state = PATState.INVALID
        _status.last_status_code = status_code
        _status.last_error = body_snippet[:200] if body_snippet else None
