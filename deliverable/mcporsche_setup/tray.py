"""Optional system-tray front-end.

Uses `pystray` + `Pillow` if available. If either is missing, we silently
degrade — the launcher will just log health status to the console/log file.

Green / amber / red icon reflects the *worst* status across all servers. The
right-click menu offers actions the user asked for: rotate PAT, test now,
restart servers, view logs, quit.
"""

from __future__ import annotations

import logging
import subprocess
import sys
import threading
from typing import Optional

from . import health_monitor, paths


log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Optional imports
# --------------------------------------------------------------------------- #

try:
    import pystray                      # type: ignore
    from PIL import Image, ImageDraw    # type: ignore
    _TRAY_AVAILABLE = True
except Exception:                       # pragma: no cover
    _TRAY_AVAILABLE = False


def is_available() -> bool:
    return _TRAY_AVAILABLE


# --------------------------------------------------------------------------- #
# Icon rendering
# --------------------------------------------------------------------------- #

_COLOURS = {
    "green":  (0x0F, 0x9D, 0x58),
    "amber":  (0xF4, 0xB4, 0x00),
    "red":    (0xD9, 0x30, 0x25),
    "grey":   (0x8A, 0x8A, 0x8A),
}


def _render_icon(colour: str) -> "Image.Image":  # type: ignore[name-defined]
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((4, 4, size - 4, size - 4), fill=_COLOURS[colour])
    d.text((22, 18), "P", fill=(255, 255, 255))
    return img


def _colour_for(state: dict) -> str:
    """Reduce the per-server statuses to one traffic-light colour."""
    servers = state.get("servers") or {}
    if not servers:
        return "grey"
    statuses = [s.get("status") for s in servers.values()]
    if any(s in ("PAT_INVALID", "PAT_EXPIRED") for s in statuses):
        return "red"
    if any(s in ("NETWORK", "PROXY_REQUIRED", "CERT_ERROR", "UNKNOWN", "UNCONFIGURED")
           for s in statuses):
        return "amber"
    if all(s == "OK" for s in statuses):
        return "green"
    return "grey"


# --------------------------------------------------------------------------- #
# Menu actions
# --------------------------------------------------------------------------- #

def _run_python_module(module: str, *args: str) -> None:
    """Fire-and-forget child process; keeps the tray responsive."""
    subprocess.Popen([sys.executable, "-m", module, *args], close_fds=True)


def _open_configurator(server_key: Optional[str] = None) -> None:
    if server_key:
        _run_python_module("mcporsche_setup", "rotate", "--server", server_key)
    else:
        _run_python_module("mcporsche_setup", "panel")


def _view_logs() -> None:
    subprocess.Popen(["explorer", str(paths.LOG_DIR)])


def _test_now(icon: "pystray.Icon", monitor: health_monitor.HealthMonitor) -> None:  # type: ignore[name-defined]
    threading.Thread(target=monitor._check_once, daemon=True).start()


# --------------------------------------------------------------------------- #
# Public runner
# --------------------------------------------------------------------------- #

def run(server_keys: list[str]) -> None:
    """Blocking: run the tray icon until the user quits."""
    if not _TRAY_AVAILABLE:
        raise RuntimeError(
            "Tray requires the optional 'pystray' and 'Pillow' packages. "
            "Install with: pip install -r mcporsche_setup/requirements.txt",
        )

    icon: pystray.Icon = None  # forward ref for closure

    def on_change(state: dict) -> None:
        colour = _colour_for(state)
        icon.icon = _render_icon(colour)
        icon.title = _tooltip(state)

    monitor = health_monitor.HealthMonitor(server_keys, on_change=on_change)

    menu = pystray.Menu(
        pystray.MenuItem("Open Control Panel", lambda: _open_configurator()),
        pystray.MenuItem(
            "Rotate PAT",
            pystray.Menu(
                pystray.MenuItem("Jira",       lambda: _open_configurator("jira")),
                pystray.MenuItem("Confluence", lambda: _open_configurator("confluence")),
                pystray.MenuItem("GitLab",     lambda: _open_configurator("gitlab")),
            ),
        ),
        pystray.MenuItem("Test connection now", lambda: _test_now(icon, monitor)),
        pystray.MenuItem("View logs", _view_logs),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", lambda: (monitor.stop(), icon.stop())),
    )

    icon = pystray.Icon("MCPorsche", _render_icon("grey"), "MCPorsche — starting…", menu)
    monitor.start()
    icon.run()


def _tooltip(state: dict) -> str:
    servers = state.get("servers") or {}
    if not servers:
        return "MCPorsche — no health data yet"
    lines = ["MCPorsche health:"]
    for k, s in servers.items():
        who = f" ({s.get('display_name')})" if s.get("display_name") else ""
        lines.append(f"  {k}: {s.get('status')}{who}")
    return "\n".join(lines)[:127]   # Windows tray tooltip cap
