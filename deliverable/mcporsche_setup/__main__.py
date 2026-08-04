"""Entry point for `python -m mcporsche_setup <subcommand>`.

Subcommands
-----------
    configure
        Open the multi-step Setup Wizard (Welcome → Servers → Proxy → per-server
        PAT pages → Review → Install). Auto-launches the Control Panel on
        successful install.

    panel
        Open the Control Panel (start/stop/restart servers, view logs,
        rotate PATs). If nothing is configured yet, the wizard is opened first.

    rotate --server {jira|confluence|gitlab}
        Fast path: open the single-server rotation window for one PAT.

    tray
        Run the system-tray icon (requires pystray + Pillow).

    launcher
        Foreground process supervisor (used by scripted rollouts / CI).

    test [--server ...]
        Headless connection test against saved .env files.

    integrate
        Merge MCPorsche endpoints into VS Code / Claude Desktop config files.
"""

from __future__ import annotations

import argparse
import logging
import subprocess
import sys
from typing import Optional

from . import (connection_tester, env_manager, launcher, paths, schema,
               vscode_integrator)


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="mcporsche_setup",
                                description="MCPorsche setup & runtime.")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("configure",
                   help="Open the multi-step Setup Wizard.")

    sub.add_parser("panel",
                   help="Open the Control Panel (start/stop/rotate PATs).")

    r = sub.add_parser("rotate",
                       help="Rotate the PAT for a single server (fast path).")
    r.add_argument("--server", required=True,
                   choices=[s.key for s in schema.ALL_SERVERS])

    sub.add_parser("tray", help="Run the tray icon (needs pystray).")

    lc = sub.add_parser("launcher", help="Run all MCP servers.")
    lc.add_argument("--servers", nargs="+",
                    choices=[s.key for s in schema.ALL_SERVERS],
                    default=[s.key for s in schema.ALL_SERVERS])

    t = sub.add_parser("test", help="Headless connection test.")
    t.add_argument("--server", nargs="+",
                   choices=[s.key for s in schema.ALL_SERVERS], default=None)

    i = sub.add_parser("integrate", help="Register endpoints in VS Code / Claude Desktop.")
    i.add_argument("--servers", nargs="+",
                   choices=[s.key for s in schema.ALL_SERVERS],
                   default=[s.key for s in schema.ALL_SERVERS])

    return p


def _cmd_configure(_args: argparse.Namespace) -> int:
    """Setup Wizard → optionally launch the Control Panel on success.

    The wizard's Done page has an 'Open the Control Panel now' checkbox. We
    honour that here rather than always spawning the panel, otherwise closing
    the wizard would surprise the user with an unrelated window.
    """
    from . import wizard
    state = wizard.launch(on_install=_after_install)
    if state.completed and state.open_panel_now:
        subprocess.Popen([sys.executable, "-m", "mcporsche_setup", "panel"])
    return 0


def _after_install(state) -> None:
    """Called mid-wizard right after .env files are written. Register endpoints."""
    try:
        vscode_integrator.integrate_all(state.selected_servers)
    except Exception:  # pragma: no cover
        logging.exception("VS Code integration failed after install")


def _cmd_panel(_args: argparse.Namespace) -> int:
    from . import control_panel
    # If nothing is configured yet, kick the user into the wizard first.
    configured = [
        s.key for s in schema.ALL_SERVERS
        if env_manager.read_env(paths.env_file_for(s.key))
    ]
    if not configured:
        return _cmd_configure(_args)
    control_panel.launch(autostart=True)
    return 0


def _cmd_rotate(args: argparse.Namespace) -> int:
    """Open the single-tab configurator focused on one server."""
    from . import configurator
    configurator.launch(initial_tab=args.server)
    return 0


def _cmd_tray(_args: argparse.Namespace) -> int:
    from . import tray
    if not tray.is_available():
        print("The tray requires pystray and Pillow. Install:",
              file=sys.stderr)
        print("  pip install pystray Pillow", file=sys.stderr)
        return 2
    tray.run([s.key for s in schema.ALL_SERVERS])
    return 0


def _cmd_launcher(args: argparse.Namespace) -> int:
    launcher.run(args.servers)
    return 0


def _cmd_test(args: argparse.Namespace) -> int:
    keys = args.server or [s.key for s in schema.ALL_SERVERS]
    exit_code = 0
    for k in keys:
        values = env_manager.read_env(paths.env_file_for(k))
        if not values:
            print(f"[{k}] UNCONFIGURED — no .env file at {paths.env_file_for(k)}")
            exit_code = 1
            continue
        result = connection_tester.test_server(k, values)
        line = f"[{k}] {result.status.value}: {result.message}"
        if result.display_name:
            line += f" (user={result.display_name})"
        print(line)
        if not result.is_ok:
            if result.hint:
                print(f"   ↳ {result.hint}")
            exit_code = 1
    return exit_code


def _cmd_integrate(args: argparse.Namespace) -> int:
    touched = vscode_integrator.integrate_all(args.servers)
    if not touched:
        print("No client config files were updated. See the log for details.")
        return 1
    for p in touched:
        print(f"Updated: {p}")
    return 0


_DISPATCH = {
    "configure": _cmd_configure,
    "panel":     _cmd_panel,
    "rotate":    _cmd_rotate,
    "tray":      _cmd_tray,
    "launcher":  _cmd_launcher,
    "test":      _cmd_test,
    "integrate": _cmd_integrate,
}


def main(argv: Optional[list[str]] = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    args = _build_parser().parse_args(argv)
    return _DISPATCH[args.cmd](args)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
