"""Windows shortcuts (.lnk) for the Control Panel.

Three canonical locations are supported:

    * ``Location.START_MENU`` — appears in Start / search.
    * ``Location.DESKTOP``    — the desktop icon most users expect.
    * ``Location.STARTUP``    — the Windows *Startup* folder so the panel
                                launches automatically at every logon.

Uses the WScript.Shell COM object (via a short PowerShell subprocess) so we
stay pure-stdlib on the Python side. On non-Windows systems all operations
degrade to no-ops with a clear message.
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional


log = logging.getLogger(__name__)


SHORTCUT_NAME = "MCPorsche Control Panel.lnk"


class Location(str, Enum):
    START_MENU = "start_menu"
    DESKTOP = "desktop"
    STARTUP = "startup"


@dataclass(frozen=True)
class ShortcutInfo:
    location: Location
    exists: bool
    path: Path
    target: Optional[str] = None
    arguments: Optional[str] = None


# --------------------------------------------------------------------------- #
# Path resolution
# --------------------------------------------------------------------------- #

def _appdata() -> Path:
    ad = os.environ.get("APPDATA")
    return Path(ad) if ad else Path.home() / ".config"


def _userprofile() -> Path:
    up = os.environ.get("USERPROFILE") or os.environ.get("HOME")
    return Path(up) if up else Path.home()


def path_for(location: Location) -> Path:
    """Return the canonical .lnk path for the requested location."""
    if location is Location.START_MENU:
        return (_appdata() / "Microsoft" / "Windows" / "Start Menu"
                / "Programs" / SHORTCUT_NAME)
    if location is Location.DESKTOP:
        return _userprofile() / "Desktop" / SHORTCUT_NAME
    if location is Location.STARTUP:
        return (_appdata() / "Microsoft" / "Windows" / "Start Menu"
                / "Programs" / "Startup" / SHORTCUT_NAME)
    raise ValueError(f"Unknown shortcut location: {location!r}")


# Back-compat alias — earlier code called this directly.
def start_menu_shortcut_path() -> Path:
    return path_for(Location.START_MENU)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def info(location: Location = Location.START_MENU) -> ShortcutInfo:
    """Return current state of the shortcut at the requested location."""
    path = path_for(location)
    if not path.exists():
        return ShortcutInfo(location=location, exists=False, path=path)
    target, args = _read_lnk(path)
    return ShortcutInfo(location=location, exists=True, path=path,
                        target=target, arguments=args)


def create_or_repair(location: Location = Location.START_MENU) -> ShortcutInfo:
    """(Re)create the shortcut pointing at this Python + the panel command."""
    if sys.platform != "win32":
        raise RuntimeError("Windows shortcuts are a Windows-only feature.")

    path = path_for(location)
    path.parent.mkdir(parents=True, exist_ok=True)

    exe = sys.executable
    args = "-m mcporsche_setup panel"
    workdir = _deliverable_root()

    ps = (
        "$s = New-Object -ComObject WScript.Shell; "
        f"$l = $s.CreateShortcut([string]'{_ps_escape(path)}'); "
        f"$l.TargetPath = [string]'{_ps_escape(exe)}'; "
        f"$l.Arguments = [string]'{_ps_escape(args)}'; "
        f"$l.WorkingDirectory = [string]'{_ps_escape(workdir)}'; "
        f"$l.IconLocation = [string]'{_ps_escape(exe)},0'; "
        "$l.Description = 'MCPorsche — Control Panel'; "
        "$l.Save()"
    )

    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"powershell failed (exit {result.returncode}):\n"
            f"{result.stderr.strip() or result.stdout.strip()}"
        )
    log.info("Created shortcut %s → %s %s", path, exe, args)
    return info(location)


def remove(location: Location) -> bool:
    """Delete a shortcut. Returns True if a file was removed, False if it
    didn't exist. Never raises on missing files."""
    path = path_for(location)
    try:
        path.unlink()
        log.info("Removed shortcut %s", path)
        return True
    except FileNotFoundError:
        return False


def create_many(locations: list[Location]) -> list[ShortcutInfo]:
    """Create/refresh shortcuts at every requested location.

    Failures are logged but do not stop the loop — one location failing
    should not silently prevent the others.
    """
    out: list[ShortcutInfo] = []
    for loc in locations:
        try:
            out.append(create_or_repair(loc))
        except Exception as e:
            log.error("Shortcut at %s failed: %s", loc.value, e)
            out.append(ShortcutInfo(location=loc, exists=False, path=path_for(loc)))
    return out


# --------------------------------------------------------------------------- #
# Internals
# --------------------------------------------------------------------------- #

def _read_lnk(lnk: Path) -> tuple[Optional[str], Optional[str]]:
    if sys.platform != "win32":
        return None, None
    ps = (
        "$s = New-Object -ComObject WScript.Shell; "
        f"$l = $s.CreateShortcut([string]'{_ps_escape(lnk)}'); "
        "Write-Output ($l.TargetPath); "
        "Write-Output ($l.Arguments)"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True, text=True, timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None, None
    if result.returncode != 0:
        return None, None
    lines = result.stdout.strip().splitlines()
    target = lines[0].strip() if len(lines) >= 1 else None
    args = lines[1].strip() if len(lines) >= 2 else None
    return target, args


def _deliverable_root() -> str:
    return str(Path(__file__).resolve().parents[1])


def _ps_escape(value) -> str:
    return str(value).replace("'", "''")
