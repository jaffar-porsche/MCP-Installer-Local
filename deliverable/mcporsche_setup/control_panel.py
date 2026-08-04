"""Post-install Control Panel.

The user-facing dashboard for running the MCP servers. One row per server:

    ●  Jira MCP Server         port 8000    RUNNING · signed in as Jane Doe
       [ Start ] [ Stop ] [ Restart ]  |  [ Rotate PAT ]  [ Test ]  [ Logs ]

The panel:
    * Uses `server_controller.Controller` to manage subprocesses.
    * Auto-starts every configured server on launch.
    * Polls health every 3 s and repaints the status dots.
    * Provides quick access to reconfigure, per-server PAT rotation, and logs.
"""

from __future__ import annotations

import logging
import subprocess
import sys
import tkinter as tk
import webbrowser
from tkinter import messagebox, ttk
from typing import Optional

from . import env_manager, paths, schema, selection_store, server_controller, shortcut
from .server_controller import Controller, RunState, RuntimeState


log = logging.getLogger(__name__)


_STATE_COLOUR = {
    RunState.UNCONFIGURED:   "#8A8A8A",
    RunState.STOPPED:        "#8A8A8A",
    RunState.STARTING:       "#F4B400",
    RunState.RUNNING_OK:     "#0F9D58",
    RunState.RUNNING_PAT_BAD: "#D93025",
    RunState.CRASHED:        "#D93025",
    RunState.ERROR:          "#D93025",
}
_STATE_LABEL = {
    RunState.UNCONFIGURED:   "Not configured",
    RunState.STOPPED:        "Stopped",
    RunState.STARTING:       "Starting…",
    RunState.RUNNING_OK:     "Running",
    RunState.RUNNING_PAT_BAD: "PAT expired",
    RunState.CRASHED:        "Crashed",
    RunState.ERROR:          "Error",
}


# --------------------------------------------------------------------------- #
# One row per server
# --------------------------------------------------------------------------- #

class _ServerRow(ttk.Frame):
    """Rendering + button wiring for a single server."""

    def __init__(self, parent, controller: Controller, key: str) -> None:
        super().__init__(parent, padding=(12, 10))
        self._controller = controller
        self._key = key
        self._spec = schema.get_server(key)

        self.configure(relief="groove", borderwidth=1)

        # Title row
        title = ttk.Frame(self)
        title.pack(fill="x")
        self._dot = tk.Canvas(title, width=18, height=18, highlightthickness=0)
        self._dot.pack(side="left", padx=(0, 8))
        self._dot_id = self._dot.create_oval(2, 2, 16, 16, fill="#DDDDDD",
                                             outline="")
        ttk.Label(title, text=self._spec.display_name,
                  font=("Segoe UI", 11, "bold")).pack(side="left")
        self._port_var = tk.StringVar(value=f"port {self._spec.default_port}")
        ttk.Label(title, textvariable=self._port_var,
                  foreground="#666").pack(side="left", padx=(8, 0))
        self._state_var = tk.StringVar(value="…")
        ttk.Label(title, textvariable=self._state_var,
                  foreground="#333").pack(side="right")

        # Detail line
        self._detail_var = tk.StringVar(value="")
        ttk.Label(self, textvariable=self._detail_var,
                  foreground="#555", wraplength=560, justify="left").pack(
            anchor="w", pady=(4, 6))

        # Buttons
        btns = ttk.Frame(self)
        btns.pack(fill="x")
        self._start_btn = ttk.Button(btns, text="Start",
                                     command=lambda: controller.start(key))
        self._start_btn.pack(side="left")
        self._stop_btn = ttk.Button(btns, text="Stop",
                                    command=lambda: controller.stop(key))
        self._stop_btn.pack(side="left", padx=(6, 0))
        self._restart_btn = ttk.Button(btns, text="Restart",
                                       command=lambda: controller.restart(key))
        self._restart_btn.pack(side="left", padx=(6, 0))

        ttk.Separator(btns, orient="vertical").pack(side="left", padx=8, fill="y")

        ttk.Button(btns, text="Rotate PAT",
                   command=self._rotate_pat).pack(side="left")
        ttk.Button(btns, text="Test",
                   command=self._test_now).pack(side="left", padx=(6, 0))
        ttk.Button(btns, text="Logs",
                   command=self._open_logs).pack(side="left", padx=(6, 0))

    def update_from(self, snap: RuntimeState) -> None:
        colour = _STATE_COLOUR[snap.state]
        self._dot.itemconfigure(self._dot_id, fill=colour)
        self._state_var.set(_STATE_LABEL[snap.state])
        self._port_var.set(f"port {snap.port}")
        detail = snap.message
        if snap.display_user:
            detail = f"Signed in as {snap.display_user}. {detail}"
        self._detail_var.set(detail)

        can_start = snap.state in (RunState.STOPPED, RunState.CRASHED,
                                   RunState.ERROR)
        can_stop = snap.state in (RunState.STARTING, RunState.RUNNING_OK,
                                  RunState.RUNNING_PAT_BAD)
        self._start_btn.configure(state=("normal" if can_start else "disabled"))
        self._stop_btn.configure(state=("normal" if can_stop else "disabled"))
        self._restart_btn.configure(state=("normal" if can_stop else "disabled"))

    def _open_logs(self) -> None:
        log_file = paths.LOG_DIR / f"{self._key}.log"
        if not log_file.exists():
            log_file.parent.mkdir(parents=True, exist_ok=True)
            log_file.write_text("(No output yet.)\n")
        subprocess.Popen(["notepad.exe", str(log_file)])

    def _rotate_pat(self) -> None:
        # Open the single-server rotation UI in a separate process so the
        # panel stays responsive.
        subprocess.Popen([sys.executable, "-m", "mcporsche_setup",
                          "rotate", "--server", self._key])

    def _test_now(self) -> None:
        # Force one immediate poll & pop a summary window.
        snap = self._controller.get(self._key).poll()
        messagebox.showinfo(
            self._spec.display_name,
            f"State: {_STATE_LABEL[snap.state]}\n\n{snap.message}",
        )


# --------------------------------------------------------------------------- #
# Main window
# --------------------------------------------------------------------------- #

class ControlPanel(tk.Tk):
    def __init__(self, autostart: bool = False) -> None:
        """Open the Control Panel.

        `autostart` is deliberately False by default. Users prefer to open the
        panel, see the status of each server, and click Start when they're
        ready — so we never spawn subprocesses behind their back.
        """
        super().__init__()
        self.title("MCPorsche Control Panel")
        self.geometry("720x620")
        self.minsize(660, 560)
        self._install_style()

        keys = self._configured_keys()
        if not keys:
            # Fall back to all so the panel still renders even before install.
            keys = [s.key for s in schema.ALL_SERVERS]
        self._controller = Controller(keys)
        self._controller.set_listener(self._on_update)

        self._build()
        self._controller.start_poller(interval_s=3.0)
        if autostart:
            self.after(300, self._controller.start_all)

        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _configured_keys(self) -> list[str]:
        """Return the servers the panel should show.

        Preference order:
            1. Explicit selection saved by the Setup Wizard (users see exactly
               what they picked, even when stale .env files exist for others).
            2. Fallback: any server whose .env file exists (legacy behaviour
               for installs that predate the selection store).
        """
        selected = selection_store.load()
        if selected is not None:
            # Intersect with servers that actually have an .env so we never
            # try to start something the user never configured.
            configured = {
                s.key for s in schema.ALL_SERVERS
                if env_manager.read_env(paths.env_file_for(s.key))
            }
            filtered = [k for k in selected if k in configured]
            if filtered:
                return filtered
        return [s.key for s in schema.ALL_SERVERS
                if env_manager.read_env(paths.env_file_for(s.key))]

    # ---- layout --------------------------------------------------------- #

    def _install_style(self) -> None:
        from . import theme
        theme.install(self)

    def _build(self) -> None:
        from . import theme

        # Porsche Engineering brand bar at the very top.
        theme.add_brand_bar(self, subtitle="CONTROL PANEL")

        # ── Header (Servers title + Start/Stop all) ────────────────────
        header = ttk.Frame(self, padding=(24, 16))
        header.pack(side="top", fill="x")
        ttk.Label(header, text="Servers", style="PAG.Title.TLabel").pack(side="left")
        ttk.Button(
            header, text="Start all", style="PAG.Primary.TButton",
            command=self._controller.start_all,
        ).pack(side="right", padx=(6, 0))
        ttk.Button(
            header, text="Stop all", style="PAG.Secondary.TButton",
            command=self._controller.stop_all,
        ).pack(side="right", padx=(6, 0))

        ttk.Label(
            self,
            text="Servers are not running yet. Click Start on the row you need, "
                 "or Start all to launch them. Closing this window keeps servers "
                 "running in the background.",
            style="PAG.Small.TLabel",
            padding=(24, 0, 24, 8),
            wraplength=680,
            justify="left",
        ).pack(fill="x")

        ttk.Separator(self, orient="horizontal").pack(fill="x", padx=24)

        # PEG-IT footer (pinned bottom first).
        theme.add_footer(self)

        # ── Footer action bar (Reconfigure / Logs / VS Code / Quit) ────
        actions = ttk.Frame(self, padding=(24, 12))
        actions.pack(side="bottom", fill="x")
        ttk.Button(
            actions, text="Reconfigure",
            style="PAG.Secondary.TButton",
            command=self._open_wizard,
        ).pack(side="left")
        ttk.Button(
            actions, text="Open logs folder",
            style="PAG.Secondary.TButton",
            command=self._open_logs_folder,
        ).pack(side="left", padx=(6, 0))
        ttk.Button(
            actions, text="VS Code integration",
            style="PAG.Secondary.TButton",
            command=self._reintegrate,
        ).pack(side="left", padx=(6, 0))
        ttk.Button(
            actions, text="Shortcut…",
            style="PAG.Secondary.TButton",
            command=self._manage_shortcut,
        ).pack(side="left", padx=(6, 0))
        ttk.Button(
            actions, text="Quit", style="PAG.Ghost.TButton",
            command=self._on_close,
        ).pack(side="right")

        # ── Scrollable body of server rows ─────────────────────────────
        body = ttk.Frame(self, padding=(16, 6, 16, 6))
        body.pack(fill="both", expand=True)
        canvas = tk.Canvas(body, highlightthickness=0, borderwidth=0,
                           background=theme.PAG_BG)
        vsb = ttk.Scrollbar(body, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vsb.set)
        canvas.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        inner = ttk.Frame(canvas)
        win = canvas.create_window((0, 0), window=inner, anchor="nw")
        inner.bind("<Configure>", lambda _e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda e: canvas.itemconfigure(win, width=e.width))
        inner.bind("<Enter>", lambda _e: canvas.bind_all(
            "<MouseWheel>",
            lambda ev: canvas.yview_scroll(int(-ev.delta / 120), "units")))
        inner.bind("<Leave>", lambda _e: canvas.unbind_all("<MouseWheel>"))

        self._rows: dict[str, _ServerRow] = {}
        for k in self._controller.keys():
            row = _ServerRow(inner, self._controller, k)
            row.pack(fill="x", padx=12, pady=6)
            self._rows[k] = row

    # ---- callbacks ------------------------------------------------------ #

    def _on_update(self, snaps: list[RuntimeState]) -> None:
        # Called from the poller thread → marshal to the Tk main loop.
        self.after(0, lambda: self._apply(snaps))

    def _apply(self, snaps: list[RuntimeState]) -> None:
        for s in snaps:
            row = self._rows.get(s.key)
            if row is not None:
                row.update_from(s)

    def _open_wizard(self) -> None:
        subprocess.Popen([sys.executable, "-m", "mcporsche_setup", "configure"])

    def _open_logs_folder(self) -> None:
        paths.ensure()
        subprocess.Popen(["explorer", str(paths.LOG_DIR)])

    def _reintegrate(self) -> None:
        from . import vscode_integrator
        touched = vscode_integrator.integrate_all(self._controller.keys())
        if touched:
            messagebox.showinfo(
                "VS Code integration",
                "Updated:\n\n" + "\n".join(str(p) for p in touched)
                + "\n\nRestart VS Code to see the servers.",
            )
        else:
            messagebox.showwarning(
                "VS Code integration",
                "No client config files could be written. See the log for details.",
            )

    def _manage_shortcut(self) -> None:
        """Open a small dialog letting the user toggle each shortcut location."""
        _ShortcutDialog(self)

    def _on_close(self) -> None:
        """Ask whether to keep the servers running in the background.

        Behaviour matches a typical desktop app: closing the window does NOT
        stop background services. The user has to explicitly choose "Stop
        all and quit" if they want everything killed.

        Yes    → close panel, servers stay running (attach next time).
        No     → stop all servers, then close panel.
        Cancel → do nothing.
        """
        answer = messagebox.askyesnocancel(
            "Close Control Panel",
            "Keep the MCP servers running in the background?\n\n"
            "Yes  — close this window, servers stay up (recommended).\n"
            "No   — stop every MCP server, then close.\n"
            "Cancel — keep the panel open.",
            default=messagebox.YES,
        )
        if answer is None:
            return   # cancel
        if not answer:
            self._controller.stop_all()
        # In both keep/stop cases we stop the poller and close the window.
        self._controller.stop_poller()
        self.destroy()


# --------------------------------------------------------------------------- #
# Shortcut management dialog
# --------------------------------------------------------------------------- #

class _ShortcutDialog(tk.Toplevel):
    """Small modal that lets the user (re)create or remove shortcuts.

    One row per location: Start Menu, Desktop, Startup folder. Each row shows
    whether a shortcut already exists at that path plus a check box to
    request creation (checked) or removal (unchecked) on Apply.
    """

    _LOCATIONS: list[tuple[shortcut.Location, str, str]] = [
        (shortcut.Location.START_MENU, "Start Menu shortcut",
         "Appears in Start / search."),
        (shortcut.Location.DESKTOP, "Desktop shortcut",
         "The icon most users double-click."),
        (shortcut.Location.STARTUP, "Auto-start on login",
         "Launch the Control Panel every time you log in to Windows."),
    ]

    def __init__(self, master: tk.Misc) -> None:
        super().__init__(master)
        self.title("Manage shortcuts")
        self.transient(master)
        self.resizable(False, False)
        self.grab_set()

        ttk.Label(
            self,
            text="Choose where the Control Panel shortcut should live:",
            padding=(16, 12, 16, 6),
        ).pack(anchor="w")

        self._vars: dict[shortcut.Location, tk.BooleanVar] = {}
        for loc, title, desc in self._LOCATIONS:
            info = shortcut.info(loc)
            var = tk.BooleanVar(value=info.exists)
            self._vars[loc] = var
            box = ttk.Frame(self, padding=(16, 4))
            box.pack(fill="x")
            cb = ttk.Checkbutton(box, text=title, variable=var)
            cb.pack(anchor="w")
            status = "already installed" if info.exists else "not installed"
            ttk.Label(box, text=f"    {desc}    ({status})",
                      foreground="#666").pack(anchor="w")
            ttk.Label(box, text=f"    {info.path}",
                      foreground="#888", font=("Segoe UI", 8)).pack(anchor="w")

        actions = ttk.Frame(self, padding=(16, 12))
        actions.pack(fill="x")
        ttk.Button(actions, text="Cancel", command=self.destroy).pack(side="right")
        ttk.Button(actions, text="Apply",
                   command=self._apply).pack(side="right", padx=(0, 6))

    def _apply(self) -> None:
        created: list[str] = []
        removed: list[str] = []
        failed: list[str] = []
        for loc, var in self._vars.items():
            want = var.get()
            path = shortcut.path_for(loc)
            exists = path.exists()
            try:
                if want and not exists:
                    shortcut.create_or_repair(loc)
                    created.append(str(path))
                elif want and exists:
                    # Repair in-place — refreshes target/args if Python moved.
                    shortcut.create_or_repair(loc)
                elif not want and exists:
                    if shortcut.remove(loc):
                        removed.append(str(path))
            except Exception as e:
                failed.append(f"{loc.value}: {e}")

        parts: list[str] = []
        if created:
            parts.append("Created:\n  " + "\n  ".join(created))
        if removed:
            parts.append("Removed:\n  " + "\n  ".join(removed))
        if failed:
            parts.append("Failed:\n  " + "\n  ".join(failed))
        if not parts:
            parts.append("Nothing to do.")

        (messagebox.showerror if failed else messagebox.showinfo)(
            "Shortcuts", "\n\n".join(parts),
        )
        self.destroy()


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #

def launch(autostart: bool = False) -> None:
    paths.ensure()
    app = ControlPanel(autostart=autostart)
    app.mainloop()


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    launch()
