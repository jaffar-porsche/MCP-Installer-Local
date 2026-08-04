"""Thread-safe PAT status tracker for GitLab MCP.

See jira-mcp/pat_status.py for the design rationale.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class PATState(str, Enum):
    UNKNOWN = "UNKNOWN"
    OK = "OK"
    INVALID = "INVALID"


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
