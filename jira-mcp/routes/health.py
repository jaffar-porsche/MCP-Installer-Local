"""Health and PAT-status endpoints for the Jira MCP server.

- ``GET /health``       — cheap liveness probe. Never touches Jira.
- ``GET /health/pat``   — returns the current PAT status, actively probing
                          Jira's ``/rest/api/2/myself`` when the cached state
                          is UNKNOWN. Returns HTTP 401 (with a JSON body) when
                          the PAT is invalid — this is what the MCPorsche
                          tray icon polls to turn red.

Keeping this in its own module avoids polluting other route files and makes
the pattern trivial to mirror in confluence-mcp / gitlab-mcp.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from config import JIRA_BASE_URL
import pat_status


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness probe", operation_id="health_liveness")
async def health() -> dict[str, Any]:
    """Cheap liveness probe. Always returns 200 when the process is up."""
    return {"status": "ok", "service": "jira-mcp"}


@router.get(
    "/health/pat",
    summary="PAT status for MCPorsche tray & clients",
    operation_id="health_pat",
)
async def health_pat() -> JSONResponse:
    """Return current PAT status. If UNKNOWN, actively probe Jira once."""
    status = pat_status.get()

    if status.state is pat_status.PATState.UNKNOWN:
        _probe_myself()
        status = pat_status.get()

    payload = {
        "server": "jira-mcp",
        "base_url": JIRA_BASE_URL,
        "pat": status.as_dict(),
    }
    if status.state is pat_status.PATState.INVALID:
        payload["hint"] = (
            "Your Jira PAT is invalid or expired. In the MCPorsche tray icon, "
            "choose 'Rotate PAT' → 'Jira'. Paste the new token, click 'Test', "
            "then 'Save'."
        )
        return JSONResponse(status_code=401, content=payload)
    return JSONResponse(status_code=200, content=payload)


def _probe_myself() -> None:
    """Best-effort authenticated GET; records result in pat_status."""
    try:
        # Import lazily so a missing http_session cannot break /health liveness.
        from client import http_session
        resp = http_session.get(f"{JIRA_BASE_URL}/rest/api/2/myself", timeout=6)
        if resp.status_code == 200:
            pat_status.record_success(resp.status_code)
        elif resp.status_code in (401, 403):
            pat_status.record_unauthorized(resp.status_code, resp.text or "")
        else:
            logger.info("PAT probe unexpected status %s", resp.status_code)
    except Exception as e:  # pragma: no cover — probe must never crash /health
        logger.warning("PAT probe failed: %s", e)
