"""Persist the set of MCP servers the user chose in the Setup Wizard.

The wizard writes ``paths.SELECTED_SERVERS_FILE`` after a successful install.
The Control Panel & tray read it to filter what they show, so unselecting a
server in the wizard actually removes it from the UI, even when a stale
`.env` file from a previous install still exists on disk.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Iterable

from . import paths, schema


log = logging.getLogger(__name__)


_ALL_KEYS = [s.key for s in schema.ALL_SERVERS]


def save(server_keys: Iterable[str]) -> None:
    """Persist the current selection. Unknown keys are silently dropped."""
    paths.ensure()
    valid = [k for k in server_keys if k in _ALL_KEYS]
    tmp = paths.SELECTED_SERVERS_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(valid), encoding="utf-8")
    os.replace(tmp, paths.SELECTED_SERVERS_FILE)
    log.info("Saved selected servers: %s", valid)


def load() -> list[str] | None:
    """Return the persisted selection, or None if it has never been saved.

    Callers should treat None as "fall back to legacy detection based on .env
    files" so users who installed a previous version continue to work.
    """
    try:
        raw = paths.SELECTED_SERVERS_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("Malformed %s — ignoring", paths.SELECTED_SERVERS_FILE)
        return None
    if not isinstance(data, list):
        return None
    return [k for k in data if k in _ALL_KEYS]
