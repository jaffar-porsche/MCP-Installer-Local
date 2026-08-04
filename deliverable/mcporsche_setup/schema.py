"""Server registry — a plugin-style architecture.

Manifests (JSON) are the single source of truth for every user-configurable
MCP server. Consumers (wizard, control panel, connection tester, tray)
receive the same public API regardless of whether a server ships built-in or
was added by a third party dropping a `mcporsche.json` next to their code.

    * Field descriptors carry all UI/validation metadata.
    * Server specs carry connection endpoints + subprocess launch info.
    * Manifests are discovered from two places:
        1. `mcporsche_setup/manifests/*.json`   — shipped with the deliverable.
        2. `<repo-root>/*-mcp/mcporsche.json`   — repo-local override / addition.
      Repo-local wins if the same `key` appears twice.

See `manifests/README.md` for the manifest schema and how to add a new server.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from . import paths


log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Data types
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Field:
    """One configurable environment variable in a manifest."""

    key: str
    label: str
    category: str
    default: Optional[str] = None
    secret: bool = False
    required: bool = False
    help_text: str = ""
    help_url: Optional[str] = None
    placeholder: Optional[str] = None
    validator: Optional[str] = None   # name of a callable in `_VALIDATORS`

    def validate(self, value: str) -> Optional[str]:
        """Return an error message, or None if the value is acceptable."""
        if self.validator is None:
            return None
        fn = _VALIDATORS.get(self.validator)
        if fn is None:
            log.warning("Unknown validator '%s' on field %s", self.validator, self.key)
            return None
        return fn(value)


@dataclass(frozen=True)
class ServerSpec:
    """Everything the deliverable needs to render, configure and run one MCP server."""

    key: str
    display_name: str
    server_dir_name: str
    default_port: int
    app_module: str
    health_path: str
    myself_path: str
    base_url_env: str
    token_env: str
    fields: list[Field] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# Built-in validators (referenced by name from manifests)
# --------------------------------------------------------------------------- #

def _looks_like_url(value: str) -> Optional[str]:
    v = value.strip()
    if not v:
        return None
    if not (v.startswith("http://") or v.startswith("https://")):
        return "Must start with http:// or https://"
    return None


def _looks_like_port(value: str) -> Optional[str]:
    v = value.strip()
    if not v:
        return None
    if not v.isdigit():
        return "Port must be a number"
    n = int(v)
    if not (1 <= n <= 65535):
        return "Port must be between 1 and 65535"
    return None


def _pat_shape(value: str) -> Optional[str]:
    v = value.strip()
    if not v:
        return None
    if v != value:
        return "Leading/trailing whitespace — did you copy an extra space?"
    if len(v) < 20:
        return "Looks unusually short for a PAT — double-check you copied it fully"
    return None


_VALIDATORS: dict[str, Callable[[str], Optional[str]]] = {
    "url":       _looks_like_url,
    "port":      _looks_like_port,
    "pat_shape": _pat_shape,
}


# --------------------------------------------------------------------------- #
# Manifest loading
# --------------------------------------------------------------------------- #

_MANIFEST_DIR = Path(__file__).resolve().parent / "manifests"
_COMMON_FILE = _MANIFEST_DIR / "_common.json"


def _load_common_groups() -> dict[str, list[dict]]:
    """Read the shared field groups (proxy, transport, …). Missing → empty."""
    if not _COMMON_FILE.exists():
        return {}
    try:
        data = json.loads(_COMMON_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        log.error("%s is malformed: %s", _COMMON_FILE, e)
        return {}
    return {
        k: v for k, v in data.items()
        if isinstance(v, list) and not k.startswith("_") and not k.startswith("$")
    }


def _make_field(raw: dict) -> Field:
    """Coerce one dict from a manifest into a Field."""
    return Field(
        key=raw["key"],
        label=raw.get("label", raw["key"]),
        category=raw.get("category", "Advanced"),
        default=raw.get("default"),
        secret=bool(raw.get("secret", False)),
        required=bool(raw.get("required", False)),
        help_text=raw.get("help_text", ""),
        help_url=raw.get("help_url"),
        placeholder=raw.get("placeholder"),
        validator=raw.get("validator"),
    )


def _make_spec(raw: dict, source: Path, common: dict[str, list[dict]]) -> ServerSpec:
    """Coerce a manifest dict into a ServerSpec. Raises ValueError on bad shape."""
    for req in ("key", "display_name", "server_dir_name", "default_port",
                "app_module", "health_path", "myself_path",
                "base_url_env", "token_env", "fields"):
        if req not in raw:
            raise ValueError(f"{source}: missing required key '{req}'")

    fields_list = [_make_field(f) for f in raw["fields"]]
    for group_name in raw.get("include_common", []) or []:
        group = common.get(group_name)
        if group is None:
            log.warning("%s: include_common references unknown group '%s'",
                        source, group_name)
            continue
        fields_list.extend(_make_field(f) for f in group)

    return ServerSpec(
        key=raw["key"],
        display_name=raw["display_name"],
        server_dir_name=raw["server_dir_name"],
        default_port=int(raw["default_port"]),
        app_module=raw["app_module"],
        health_path=raw["health_path"],
        myself_path=raw["myself_path"],
        base_url_env=raw["base_url_env"],
        token_env=raw["token_env"],
        fields=fields_list,
    )


def _load_manifest_file(path: Path, common: dict[str, list[dict]]) -> Optional[ServerSpec]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        log.error("Cannot read manifest %s: %s", path, e)
        return None
    try:
        return _make_spec(raw, path, common)
    except (ValueError, KeyError, TypeError) as e:
        log.error("Invalid manifest %s: %s", path, e)
        return None


def load_specs() -> list[ServerSpec]:
    """Discover every manifest. Repo-local wins over built-in on key clash."""
    common = _load_common_groups()
    by_key: dict[str, ServerSpec] = {}

    # 1. Built-in manifests.
    for path in sorted(_MANIFEST_DIR.glob("*.json")):
        if path.name.startswith("_"):
            continue
        spec = _load_manifest_file(path, common)
        if spec is not None:
            by_key[spec.key] = spec

    # 2. Repo-local manifests — override built-ins on key clash.
    try:
        repo_root = paths.REPO_ROOT
    except AttributeError:
        repo_root = None
    if repo_root and repo_root.exists():
        for candidate in sorted(repo_root.glob("*-mcp/mcporsche.json")):
            spec = _load_manifest_file(candidate, common)
            if spec is not None:
                if spec.key in by_key:
                    log.info("Repo manifest %s overrides built-in for key '%s'",
                             candidate, spec.key)
                by_key[spec.key] = spec

    return sorted(by_key.values(), key=lambda s: s.key)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

# Loaded once at import — cheap enough (small JSON files) and lets consumers
# write `for spec in ALL_SERVERS:` idiomatically.
ALL_SERVERS: list[ServerSpec] = load_specs()


def get_server(key: str) -> ServerSpec:
    for spec in ALL_SERVERS:
        if spec.key == key:
            return spec
    raise KeyError(f"Unknown server '{key}'. Known: {[s.key for s in ALL_SERVERS]}")


def categories_of(spec: ServerSpec) -> list[str]:
    """Return categories in a stable, meaningful order for the UI."""
    order = ["Connection", "Auth", "Proxy", "Advanced"]
    present = {f.category for f in spec.fields}
    return [c for c in order if c in present]


def reload() -> list[ServerSpec]:
    """Re-scan the filesystem — useful in tests after adding a manifest."""
    global ALL_SERVERS
    ALL_SERVERS = load_specs()
    return ALL_SERVERS
