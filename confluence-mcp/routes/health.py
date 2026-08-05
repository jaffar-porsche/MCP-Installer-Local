"""Health check and connection test endpoints."""
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
import requests

from client import confluence
from config import CONFLUENCE_BASE_URL, CONFLUENCE_PAT, PROXIES
import pat_status

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


def _auth_error_status(exc: Exception) -> int | None:
    """Extract 401/403 auth failures from Atlassian client exceptions."""
    response = getattr(exc, "response", None)
    status_code = getattr(response, "status_code", None)
    if status_code in (401, 403):
        return int(status_code)

    text = str(exc)
    lowered = text.lower()
    if "403" in text or "forbidden" in lowered:
        return 403
    if "401" in text or "unauthorized" in lowered:
        return 401
    return None


@router.get("/health", summary="Health check endpoint", operation_id="health_check")
async def health_check():
    """
    Simple health check to verify server is running.
    """
    return {
        "status": "healthy",
        "service": "Confluence MCP Server",
        "version": "2.0.0"
    }


@router.get(
    "/health/pat",
    summary="PAT status for MCPorsche tray & clients",
    operation_id="health_pat",
)
async def health_pat() -> JSONResponse:
    """Return current PAT status. If UNKNOWN, actively probe Confluence once."""
    status = pat_status.get()

    if status.state is pat_status.PATState.UNKNOWN:
        _probe_myself()
        status = pat_status.get()

    payload = {
        "server": "confluence-mcp",
        "base_url": CONFLUENCE_BASE_URL,
        "pat": status.as_dict(),
    }
    if status.state is pat_status.PATState.INVALID:
        payload["hint"] = (
            "Your Confluence PAT is invalid or expired. In the MCPorsche "
            "Control Panel choose 'Rotate PAT' → 'Confluence'."
        )
        return JSONResponse(status_code=401, content=payload)
    return JSONResponse(status_code=200, content=payload)


def _probe_myself() -> None:
    """Best-effort PAT-only call; records bearer-token validity in pat_status."""
    try:
        response = requests.get(
            f"{CONFLUENCE_BASE_URL}/rest/api/user/current",
            headers={
                "Authorization": f"Bearer {CONFLUENCE_PAT}",
                "Accept": "application/json",
                "User-Agent": "confluence-mcp/2.0",
            },
            proxies=PROXIES,
            timeout=6,
        )
        if response.status_code == 200:
            pat_status.record_success(200)
        elif response.status_code in (401, 403):
            pat_status.record_unauthorized(response.status_code, response.text or "")
        else:
            logger.info("Confluence PAT probe unexpected status: %s", response.status_code)
    except Exception as e:
        logger.info("Confluence PAT probe unexpected error: %s", e)


@router.get("/test_connection", summary="Test Confluence connection and authentication", operation_id="test_connection")
async def test_connection():
    """
    Test the Confluence connection and authentication.
    """
    try:
        user_info = confluence.get_current_user()
        pat_status.record_success(200)
        return {
            "status": "connected",
            "user": user_info.get("displayName", user_info.get("username", "Unknown")),
            "base_url": CONFLUENCE_BASE_URL,
            "message": "Authentication successful"
        }
    except Exception as e:
        msg = str(e)
        code = _auth_error_status(e)
        if code is not None:
            pat_status.record_unauthorized(code, msg)
            return {
                "status": "failed",
                "error": msg,
                "base_url": CONFLUENCE_BASE_URL,
                "message": "Authentication or connectivity failed"
            }

        try:
            spaces = confluence.get_all_spaces(start=0, limit=1)
            pat_status.record_success(200)
            return {
                "status": "connected",
                "user": "API User",
                "base_url": CONFLUENCE_BASE_URL,
                "message": "Authentication successful (verified via spaces API)",
                "spaces_available": len(spaces.get("results", []))
            }
        except Exception as fallback_error:
            fallback_msg = str(fallback_error)
            fallback_code = _auth_error_status(fallback_error)
            if fallback_code is not None:
                pat_status.record_unauthorized(fallback_code, fallback_msg)
            return {
                "status": "failed",
                "error": msg,
                "fallback_error": fallback_msg,
                "base_url": CONFLUENCE_BASE_URL,
                "message": "Authentication or connectivity failed"
            }
