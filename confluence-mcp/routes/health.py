"""Health check and connection test endpoints."""
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from client import confluence
from config import CONFLUENCE_BASE_URL
import pat_status

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


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
    """Best-effort authenticated call; records result in pat_status."""
    try:
        user_info = confluence.get_current_user()
        # atlassian-python-api raises on 4xx, so reaching here == 200-ish.
        pat_status.record_success(200)
        _ = user_info  # noqa: F841 — kept for future logging
    except Exception as e:
        text = str(e)
        code = 401 if ("401" in text or "unauthorized" in text.lower()) else 500
        if code == 401:
            pat_status.record_unauthorized(code, text)
        else:
            logger.info("Confluence PAT probe unexpected error: %s", text)


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
            msg = str(e)
            if "401" in msg or "unauthorized" in msg.lower():
                pat_status.record_unauthorized(401, msg)
            return {
                "status": "failed",
                "error": msg,
                "fallback_error": str(fallback_error),
                "base_url": CONFLUENCE_BASE_URL,
                "message": "Authentication or connectivity failed"
            }
