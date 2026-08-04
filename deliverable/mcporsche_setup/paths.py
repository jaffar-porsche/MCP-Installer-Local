"""Filesystem locations used by the deliverable.

Everything the user-facing tools write goes under %APPDATA%\\MCPorsche\\ so we
never touch the read-only install directory. This keeps installs upgradable
and lets non-admin users run everything without UAC prompts.

This module deliberately knows *nothing* about specific MCP servers — the
per-server directory & venv are derived from a `ServerSpec.server_dir_name`
at the call site. That keeps the deliverable plug-and-play.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _appdata() -> Path:
    """Return %APPDATA%, falling back to ~/.config on non-Windows dev machines."""
    appdata = os.environ.get("APPDATA")
    if appdata:
        return Path(appdata)
    return Path.home() / ".config"


# Root data directory
DATA_ROOT: Path = _appdata() / "MCPorsche"

# Per-purpose subfolders (created lazily on first access via ensure())
STATE_DIR: Path = DATA_ROOT / "state"
LOG_DIR: Path = DATA_ROOT / "logs"
BACKUP_DIR: Path = DATA_ROOT / "backups"

# Repo root (set at import time relative to this file). The deliverable ships
# alongside the MCP server source; we discover them by walking up 2 dirs
# (paths.py → mcporsche_setup → deliverable → repo-root).
_HERE = Path(__file__).resolve()
REPO_ROOT: Path = _HERE.parents[2]

# State files
HEALTH_STATE_FILE: Path = STATE_DIR / "health.json"
LAUNCHER_PID_FILE: Path = STATE_DIR / "launcher.pids.json"
SELECTED_SERVERS_FILE: Path = STATE_DIR / "enabled_servers.json"


def ensure() -> None:
    """Create all directories if missing. Safe to call repeatedly."""
    for d in (DATA_ROOT, STATE_DIR, LOG_DIR, BACKUP_DIR):
        d.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------------------------------- #
# Per-server path helpers (data-driven — take a directory name, not a key)
# --------------------------------------------------------------------------- #

def server_dir(dir_name: str) -> Path:
    """Return the on-disk directory for a server given its manifest folder name."""
    return REPO_ROOT / dir_name


def env_file(dir_name: str) -> Path:
    """Return the .env file for a server."""
    return REPO_ROOT / dir_name / ".env"


def venv_python(dir_name: str, *, prefer_windowless: bool = False) -> Path:
    """Return the venv's Python interpreter for a server.

    When ``prefer_windowless`` is True and pythonw.exe exists (Windows only),
    it is preferred over python.exe so subprocesses don't flash a console
    window. Falls back to python.exe if pythonw.exe is missing.
    """
    if sys.platform == "win32":
        scripts = REPO_ROOT / dir_name / "venv" / "Scripts"
        if prefer_windowless:
            pyw = scripts / "pythonw.exe"
            if pyw.exists():
                return pyw
        return scripts / "python.exe"
    return REPO_ROOT / dir_name / "venv" / "bin" / "python"


def pid_file_for(server_key: str) -> Path:
    """Per-server PID file used by the Control Panel to reattach to a running
    MCP server after the panel has been closed & reopened."""
    return STATE_DIR / f"{server_key}.pid"


def log_file_for(server_key: str) -> Path:
    """Per-server log file (uvicorn stdout+stderr)."""
    return LOG_DIR / f"{server_key}.log"


# --------------------------------------------------------------------------- #
# Backward-compat shim — keep old call sites working during the refactor.
# --------------------------------------------------------------------------- #

def env_file_for(server_key: str) -> Path:
    """Deprecated — prefer ``env_file(spec.server_dir_name)`` at the call site.

    Kept because many call sites still pass a server *key* like 'jira' rather
    than a directory name. Delegates through the schema registry.
    """
    from . import schema
    spec = schema.get_server(server_key)
    return env_file(spec.server_dir_name)
