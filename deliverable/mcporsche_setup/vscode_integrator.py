"""Register the MCP endpoints with VS Code and Claude Desktop.

For VS Code the canonical file is `%APPDATA%\\Code\\User\\mcp.json` (created if
missing). We *merge* — never replace — so any other MCP servers the user has
configured are left intact.

For Claude Desktop the file is `%APPDATA%\\Claude\\claude_desktop_config.json`.
Same merge behaviour.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from . import paths, schema


log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Config file locations
# --------------------------------------------------------------------------- #

def _appdata() -> Path:
    ad = os.environ.get("APPDATA")
    return Path(ad) if ad else Path.home() / ".config"


VSCODE_MCP_JSON: Path = _appdata() / "Code" / "User" / "mcp.json"
CLAUDE_JSON: Path = _appdata() / "Claude" / "claude_desktop_config.json"


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def integrate_all(server_keys: list[str]) -> list[Path]:
    """Merge MCPorsche endpoints into every client config file we recognise."""
    touched: list[Path] = []
    entries = _mcp_entries_for(server_keys)

    if _try_update(VSCODE_MCP_JSON, entries, layout="vscode"):
        touched.append(VSCODE_MCP_JSON)
    if _try_update(CLAUDE_JSON, entries, layout="claude"):
        touched.append(CLAUDE_JSON)

    return touched


# --------------------------------------------------------------------------- #
# Internals
# --------------------------------------------------------------------------- #

def _mcp_entries_for(server_keys: list[str]) -> dict[str, dict]:
    entries: dict[str, dict] = {}
    for key in server_keys:
        spec = schema.get_server(key)
        entries[f"{key}-mcp"] = {
            "type": "http",
            "url": f"http://localhost:{spec.default_port}/mcp/",
        }
    return entries


def _try_update(path: Path, entries: dict[str, dict], *, layout: str) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        existing = _read_json(path)
        merged = _merge(existing, entries, layout=layout)
        _write_json_atomic(path, merged)
        log.info("Updated %s with %d MCPorsche entries", path, len(entries))
        return True
    except Exception:
        log.exception("Failed to update %s", path)
        return False


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Don't wipe a corrupted file — bail out; user can inspect the backup.
        raise


def _merge(existing: dict[str, Any], entries: dict[str, dict], *, layout: str) -> dict[str, Any]:
    if layout == "vscode":
        # VS Code shape: { "servers": { "<name>": { ... } } }
        servers = dict(existing.get("servers") or {})
        servers.update(entries)
        out = dict(existing)
        out["servers"] = servers
        return out
    if layout == "claude":
        # Claude Desktop shape: { "mcpServers": { "<name>": { ... } } }
        servers = dict(existing.get("mcpServers") or {})
        servers.update(entries)
        out = dict(existing)
        out["mcpServers"] = servers
        return out
    raise ValueError(f"Unknown layout '{layout}'")


def _write_json_atomic(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, path)
