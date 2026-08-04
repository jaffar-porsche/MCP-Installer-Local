"""Porsche-branded graphical installer for the Python deliverable.

Runs under ``pythonw.exe`` so no console window flashes.  Streams pip/venv
progress into a nice Tkinter window with a progress bar, current-step label
and a collapsible detail log — the same "professional installer" experience
as WinRAR, PyCharm, VS Code.

Usage
-----
This module is normally launched by ``MCPorsche-Setup.bat`` once it has
verified that Python 3.10+ is available. It can also be run directly:

    pythonw.exe -m mcporsche_setup.install_gui [--servers jira confluence gitlab]

Everything the installer does is idempotent and safe to re-run.
"""

from __future__ import annotations

import argparse
import logging
import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from dataclasses import dataclass
from pathlib import Path
from tkinter import ttk
from typing import Callable, Optional

from . import paths, schema


log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Brand palette — same tokens as the Electron edition
# --------------------------------------------------------------------------- #

PAG_RED = "#D5001C"
PAG_RED_HOVER = "#EE0024"
PAG_INK = "#0A0A0A"
PAG_BG = "#FAFAFA"
PAG_SURFACE = "#FFFFFF"
PAG_TEXT = "#18181B"
PAG_TEXT_MUTED = "#71717A"
PAG_TEXT_FAINT = "#A1A1AA"
PAG_BORDER = "#E4E4E7"
PAG_SUCCESS = "#00A85A"
PAG_ERROR = "#E60024"

FONT_TITLE = ("Segoe UI", 14, "bold")
FONT_H1 = ("Segoe UI", 12, "bold")
FONT_BODY = ("Segoe UI", 10)
FONT_MONO = ("Consolas", 9)
FONT_SMALL = ("Segoe UI", 9)


# --------------------------------------------------------------------------- #
# Install-step model
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Step:
    name: str                                     # user-facing label
    action: Callable[["_ProgressReporter"], None] # runs on worker thread


class _ProgressReporter:
    """Callback surface the worker thread uses to update the GUI safely."""

    def __init__(self, put: Callable[[dict], None]) -> None:
        self._put = put

    def status(self, message: str) -> None:
        self._put({"type": "status", "message": message})

    def detail(self, line: str) -> None:
        self._put({"type": "detail", "message": line})

    def progress(self, current: int, total: int) -> None:
        self._put({"type": "progress", "current": current, "total": total})

    def failure(self, message: str) -> None:
        self._put({"type": "failure", "message": message})

    def success(self, message: str) -> None:
        self._put({"type": "success", "message": message})


# --------------------------------------------------------------------------- #
# GUI window
# --------------------------------------------------------------------------- #

class InstallerWindow(tk.Tk):
    def __init__(self, server_keys: list[str], proxy: Optional[str]) -> None:
        super().__init__()
        self._server_keys = server_keys
        self._proxy = proxy
        self._queue: queue.Queue[dict] = queue.Queue()
        self._succeeded = False

        self.title("MCPorsche — Setup")
        self.geometry("620x460")
        self.minsize(560, 420)
        self.configure(background=PAG_BG)
        self._install_style()
        self._build()

        self.protocol("WM_DELETE_WINDOW", self._on_close)
        # Kick off the install on a background thread.
        threading.Thread(target=self._run_worker, daemon=True).start()
        self.after(80, self._pump)

    # ---- style --------------------------------------------------------- #

    def _install_style(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(
            "PAG.Horizontal.TProgressbar",
            troughcolor=PAG_BORDER,
            background=PAG_RED,
            bordercolor=PAG_BORDER,
            lightcolor=PAG_RED,
            darkcolor=PAG_RED,
        )
        style.configure(
            "PAG.TButton",
            background=PAG_RED,
            foreground="white",
            font=FONT_BODY,
            padding=(14, 6),
            borderwidth=0,
        )
        style.map(
            "PAG.TButton",
            background=[("active", PAG_RED_HOVER), ("disabled", PAG_TEXT_FAINT)],
            foreground=[("disabled", "white")],
        )
        style.configure(
            "PAG.Secondary.TButton",
            background=PAG_SURFACE,
            foreground=PAG_TEXT,
            font=FONT_BODY,
            padding=(14, 6),
            borderwidth=1,
            relief="solid",
        )
        style.map(
            "PAG.Secondary.TButton",
            background=[("active", PAG_BG)],
        )

    # ---- layout -------------------------------------------------------- #

    def _build(self) -> None:
        # Top brand strip.
        strip = tk.Frame(self, background=PAG_RED, height=4)
        strip.pack(fill="x")

        header = tk.Frame(self, background=PAG_SURFACE)
        header.pack(fill="x")
        wordmark = tk.Frame(header, background=PAG_SURFACE, padx=20, pady=12)
        wordmark.pack(side="left")
        tk.Label(
            wordmark,
            text="MC",
            fg=PAG_INK,
            bg=PAG_SURFACE,
            font=("Segoe UI", 16, "bold"),
        ).pack(side="left")
        tk.Label(
            wordmark,
            text="Porsche",
            fg=PAG_RED,
            bg=PAG_SURFACE,
            font=("Segoe UI", 16, "bold"),
        ).pack(side="left")
        tk.Label(
            wordmark,
            text="  ·  SETUP",
            fg=PAG_TEXT_FAINT,
            bg=PAG_SURFACE,
            font=("Segoe UI", 9, "bold"),
        ).pack(side="left", padx=(6, 0))
        tk.Label(
            header,
            text="Porsche Engineering · PEG-IT",
            fg=PAG_TEXT_MUTED,
            bg=PAG_SURFACE,
            font=FONT_SMALL,
        ).pack(side="right", padx=20, pady=12)

        divider = tk.Frame(self, background=PAG_BORDER, height=1)
        divider.pack(fill="x")

        body = tk.Frame(self, background=PAG_BG, padx=24, pady=20)
        body.pack(fill="both", expand=True)

        tk.Label(
            body,
            text="Setting up MCPorsche",
            fg=PAG_TEXT,
            bg=PAG_BG,
            font=FONT_TITLE,
        ).pack(anchor="w")
        tk.Label(
            body,
            text="This takes about a minute. Nothing is asked of you — the "
                 "configuration wizard opens automatically when the install is done.",
            fg=PAG_TEXT_MUTED,
            bg=PAG_BG,
            font=FONT_BODY,
            wraplength=560,
            justify="left",
        ).pack(anchor="w", pady=(4, 20))

        self._status_var = tk.StringVar(value="Preparing…")
        tk.Label(
            body,
            textvariable=self._status_var,
            fg=PAG_TEXT,
            bg=PAG_BG,
            font=FONT_H1,
        ).pack(anchor="w")

        self._progress = ttk.Progressbar(
            body,
            style="PAG.Horizontal.TProgressbar",
            length=560,
            mode="determinate",
            maximum=100,
        )
        self._progress.pack(fill="x", pady=(8, 14))

        # Collapsible detail log.
        self._show_details = tk.BooleanVar(value=False)
        toggle = ttk.Checkbutton(
            body,
            text="Show details",
            variable=self._show_details,
            command=self._toggle_details,
        )
        toggle.pack(anchor="w")

        self._detail_frame = tk.Frame(body, background=PAG_BG)
        self._detail = tk.Text(
            self._detail_frame,
            height=8,
            wrap="none",
            font=FONT_MONO,
            background=PAG_SURFACE,
            foreground=PAG_TEXT_MUTED,
            relief="solid",
            borderwidth=1,
            padx=8,
            pady=6,
        )
        vsb = ttk.Scrollbar(self._detail_frame, orient="vertical", command=self._detail.yview)
        self._detail.configure(yscrollcommand=vsb.set, state="disabled")
        self._detail.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        # Bottom action bar (hidden until success/failure).
        self._actions = tk.Frame(self, background=PAG_BG, padx=24, pady=14)
        self._actions.pack(fill="x", side="bottom")
        self._primary_btn = ttk.Button(
            self._actions,
            text="Close",
            style="PAG.TButton",
            command=self._on_close,
        )
        self._primary_btn.pack(side="right")
        self._primary_btn.state(["disabled"])

        # Footer.
        footer = tk.Frame(self, background=PAG_SURFACE, height=28)
        footer.pack(fill="x", side="bottom")
        tk.Label(
            footer,
            text="Powered by PEG-IT",
            fg=PAG_TEXT_FAINT,
            bg=PAG_SURFACE,
            font=("Segoe UI", 8, "bold"),
        ).pack(side="right", padx=20, pady=6)

    def _toggle_details(self) -> None:
        if self._show_details.get():
            self._detail_frame.pack(fill="both", expand=True, pady=(6, 0))
        else:
            self._detail_frame.pack_forget()

    # ---- worker thread ------------------------------------------------- #

    def _run_worker(self) -> None:
        rep = _ProgressReporter(self._queue.put)
        steps = build_steps(self._server_keys, self._proxy)
        try:
            total = len(steps)
            for i, step in enumerate(steps):
                rep.status(step.name)
                rep.progress(i, total)
                step.action(rep)
            rep.progress(total, total)
            rep.success("Setup complete.")
        except Exception as e:  # noqa: BLE001 — top-level worker guard
            log.exception("Installer failed")
            rep.failure(f"Setup failed: {e}")

    # ---- GUI pump ------------------------------------------------------ #

    def _pump(self) -> None:
        try:
            while True:
                msg = self._queue.get_nowait()
                self._handle(msg)
        except queue.Empty:
            pass
        self.after(80, self._pump)

    def _handle(self, msg: dict) -> None:
        kind = msg.get("type")
        if kind == "status":
            self._status_var.set(msg["message"])
        elif kind == "detail":
            self._append_detail(msg["message"])
        elif kind == "progress":
            cur = msg["current"]
            total = max(1, msg["total"])
            self._progress["value"] = cur * 100 / total
        elif kind == "success":
            self._status_var.set("✔ " + msg["message"])
            self._progress["value"] = 100
            self._succeeded = True
            self._primary_btn.configure(text="Open Configurator")
            self._primary_btn.state(["!disabled"])
        elif kind == "failure":
            self._status_var.set("✖ " + msg["message"])
            self._show_details.set(True)
            self._toggle_details()
            self._primary_btn.configure(text="Close")
            self._primary_btn.state(["!disabled"])

    def _append_detail(self, line: str) -> None:
        self._detail.configure(state="normal")
        self._detail.insert("end", line.rstrip() + "\n")
        self._detail.see("end")
        self._detail.configure(state="disabled")

    # ---- close --------------------------------------------------------- #

    def _on_close(self) -> None:
        if self._succeeded:
            # Hand off to the Configurator in a detached process so this
            # window can close cleanly.
            subprocess.Popen(
                [sys.executable, "-m", "mcporsche_setup", "configure"],
                creationflags=_no_window_flags(),
            )
        self.destroy()


# --------------------------------------------------------------------------- #
# Install steps — call out to venv + pip in subprocess
# --------------------------------------------------------------------------- #

def build_steps(server_keys: list[str], proxy: Optional[str]) -> list[Step]:
    steps: list[Step] = []
    for key in server_keys:
        try:
            spec = schema.get_server(key)
        except KeyError:
            continue
        server_dir = paths.server_dir(spec.server_dir_name)
        if not server_dir.exists():
            continue
        steps.append(Step(
            name=f"Preparing {spec.display_name}",
            action=lambda rep, d=server_dir: _prepare_venv(d, rep),
        ))
        steps.append(Step(
            name=f"Installing {spec.display_name} dependencies",
            action=lambda rep, d=server_dir, p=proxy: _install_requirements(d, p, rep),
        ))
    steps.append(Step(
        name="Finishing up",
        action=lambda rep: rep.detail("All servers ready.\n"),
    ))
    return steps


def _prepare_venv(server_dir: Path, rep: _ProgressReporter) -> None:
    venv_dir = server_dir / "venv"
    venv_py = venv_dir / "Scripts" / "python.exe"
    if venv_py.exists():
        rep.detail(f"[skip] venv exists: {venv_py}\n")
        return
    py = _find_python()
    if py is None:
        raise RuntimeError(
            "Python 3.10+ was not found on PATH. Install it from python.org and re-run this setup.",
        )
    _stream(
        [py, "-m", "venv", str(venv_dir)],
        cwd=server_dir,
        rep=rep,
    )


def _install_requirements(server_dir: Path, proxy: Optional[str], rep: _ProgressReporter) -> None:
    venv_py = server_dir / "venv" / "Scripts" / "python.exe"
    req = server_dir / "requirements.txt"
    if not req.exists():
        rep.detail(f"[skip] no requirements.txt in {server_dir}\n")
        return
    pip_common = [str(venv_py), "-m", "pip",
                  "--disable-pip-version-check",  # silences the "run pip install ..." nag
                  "--quiet"]                       # only warnings and errors
    proxy_args = ["--proxy", proxy] if proxy else []

    _stream(pip_common + ["install", "--upgrade", "pip"] + proxy_args,
            cwd=server_dir, rep=rep)
    _stream(pip_common + ["install", "-r", str(req)] + proxy_args,
            cwd=server_dir, rep=rep)


def _stream(cmd: list[str], *, cwd: Path, rep: _ProgressReporter) -> None:
    """Run a subprocess with no console popup and stream stdout to detail log."""
    rep.detail(f"$ {' '.join(cmd)}\n")
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        creationflags=_no_window_flags(),
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        rep.detail(line)
    exit_code = proc.wait()
    if exit_code != 0:
        raise RuntimeError(f"{cmd[0]} failed with exit code {exit_code}")


def _find_python() -> Optional[str]:
    for candidate in ("py", "python", "python3"):
        try:
            out = subprocess.run(
                [candidate, "--version"],
                capture_output=True,
                text=True,
                timeout=5,
                creationflags=_no_window_flags(),
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
        if out.returncode == 0 and "Python 3" in (out.stdout + out.stderr):
            return candidate
    return None


def _no_window_flags() -> int:
    if sys.platform == "win32":
        return subprocess.CREATE_NO_WINDOW
    return 0


# --------------------------------------------------------------------------- #
# CLI entry
# --------------------------------------------------------------------------- #

def main(argv: Optional[list[str]] = None) -> int:
    p = argparse.ArgumentParser(
        prog="mcporsche_setup.install_gui",
        description="Porsche-branded graphical installer for MCPorsche.",
    )
    p.add_argument("--servers", nargs="+",
                   default=[s.key for s in schema.ALL_SERVERS])
    p.add_argument("--proxy", default=os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY"))
    args = p.parse_args(argv)

    win = InstallerWindow(args.servers, args.proxy)
    win.mainloop()
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
