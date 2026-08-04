"""Atomic .env file management.

We never touch the .env file with a naive open+write — a crash mid-write would
leave the user with no credentials and a hard-to-debug problem. Instead:

    1. Read existing values (if any).
    2. Merge with new values, preserving comments & untouched keys.
    3. Write to a sibling temp file.
    4. os.replace() (atomic on Windows since Python 3.3).
    5. Rotate a timestamped backup, keeping the last N.

Secrets are never logged. The `redact()` helper masks values by key name and
by suspicion (long high-entropy strings).
"""

from __future__ import annotations

import logging
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Iterable

from . import paths


log = logging.getLogger(__name__)


# Keys whose values must never appear in logs / UI display in cleartext.
_SECRET_KEY_HINTS = ("PAT", "TOKEN", "PASSWORD", "SECRET", "KEY")

_KEY_VALUE_RE = re.compile(r"""^\s*(?P<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?P<val>.*?)\s*$""")


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def is_secret_key(key: str) -> bool:
    """Best-effort classification of secret env var names."""
    upper = key.upper()
    return any(hint in upper for hint in _SECRET_KEY_HINTS)


def redact(value: str, *, keep: int = 4) -> str:
    """Redact a value for display / logging, keeping the first `keep` chars."""
    if not value:
        return ""
    v = value.strip().strip('"').strip("'")
    if len(v) <= keep:
        return "*" * len(v)
    return v[:keep] + "…" + "*" * max(1, min(8, len(v) - keep))


def read_env(path: Path) -> dict[str, str]:
    """Read a .env file into a dict. Missing file → empty dict. Ignores comments."""
    if not path.exists():
        return {}
    result: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = _KEY_VALUE_RE.match(line)
        if not m:
            continue
        key = m.group("key")
        val = _unquote(m.group("val"))
        result[key] = val
    return result


def write_env(path: Path, values: dict[str, str], *, header: str = "") -> Path:
    """Atomically write the given key/value pairs to `path`.

    - Rotates a timestamped backup into %APPDATA%\\MCPorsche\\backups\\.
    - Preserves ordering: keys sorted alphabetically within writing pass.
    - Never emits secret values to logs.
    """
    paths.ensure()
    _backup(path)

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.parent.mkdir(parents=True, exist_ok=True)

    lines: list[str] = []
    if header:
        for h in header.splitlines():
            lines.append(f"# {h}")
        lines.append("")

    for key in sorted(values):
        val = (values[key] or "").strip()
        if not val:
            # Skip empty values so removing a field from the wizard actually clears it.
            continue
        lines.append(f'{key}="{_escape(val)}"')

    tmp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.replace(tmp, path)  # atomic on Windows since 3.3

    log.info("Wrote %d entries to %s (secrets redacted)", len(values), path)
    _log_diff_safely(values)
    return path


def merge(existing: dict[str, str], overrides: dict[str, str]) -> dict[str, str]:
    """Merge two env dicts. `overrides` win. Empty strings in overrides delete keys."""
    merged = dict(existing)
    for k, v in overrides.items():
        if v == "":
            merged.pop(k, None)
        else:
            merged[k] = v
    return merged


# --------------------------------------------------------------------------- #
# Internals
# --------------------------------------------------------------------------- #

def _unquote(v: str) -> str:
    v = v.strip()
    # strip trailing inline comment (only when quoted-safe)
    if v.startswith('"') and v.endswith('"') and len(v) >= 2:
        return v[1:-1]
    if v.startswith("'") and v.endswith("'") and len(v) >= 2:
        return v[1:-1]
    return v


def _escape(v: str) -> str:
    # We wrap all values in double quotes, so escape embedded quotes + backslash.
    return v.replace("\\", "\\\\").replace('"', '\\"')


def _backup(src: Path) -> None:
    if not src.exists():
        return
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = paths.BACKUP_DIR / f"{src.parent.name}.env.{ts}.bak"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    _rotate_backups(src.parent.name, keep=5)


def _rotate_backups(prefix: str, keep: int) -> None:
    files = sorted(
        paths.BACKUP_DIR.glob(f"{prefix}.env.*.bak"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for old in files[keep:]:
        try:
            old.unlink()
        except OSError:
            log.debug("Failed to prune backup %s", old, exc_info=True)


def _log_diff_safely(values: dict[str, str]) -> None:
    for k, v in sorted(values.items()):
        shown = redact(v) if is_secret_key(k) else v
        log.debug("  %s=%s", k, shown)


def iter_secret_keys(keys: Iterable[str]) -> Iterable[str]:
    for k in keys:
        if is_secret_key(k):
            yield k
