"""MCP server launcher.

Runs `uvicorn` per enabled server as a subprocess, restarts on crash, and
writes a small PID map for the tray/CLI to inspect. This lets a non-technical
user run three MCP servers with one command instead of three consoles.

The launcher is **process-supervisor lite**: no full-blown service manager,
just enough to keep servers up and to shut them down cleanly when the user
closes the tray.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from typing import Optional

from . import paths, schema


log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Supervisor
# --------------------------------------------------------------------------- #

class ServerProcess:
    """One managed uvicorn process."""

    def __init__(self, spec: schema.ServerSpec, port: int) -> None:
        self.spec = spec
        self.port = port
        self._proc: Optional[subprocess.Popen] = None
        self._stop = False

    def start(self) -> None:
        cwd = paths.server_dir(self.spec.server_dir_name)
        # Prefer pythonw.exe so no console window flashes during startup.
        venv_python = paths.venv_python(self.spec.server_dir_name,
                                        prefer_windowless=True)
        if not venv_python.exists():
            raise FileNotFoundError(
                f"Virtual environment missing for {self.spec.key}. "
                f"Run install.ps1 first. Expected: {venv_python}",
            )
        cmd = [
            str(venv_python), "-m", "uvicorn",
            self.spec.app_module,
            "--host", "127.0.0.1",
            "--port", str(self.port),
        ]
        log_file = paths.log_file_for(self.spec.key)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        log.info("Starting %s on port %d (logs: %s)",
                 self.spec.display_name, self.port, log_file)
        self._proc = subprocess.Popen(
            cmd, cwd=str(cwd),
            stdout=open(log_file, "ab"), stderr=subprocess.STDOUT,
            creationflags=_no_window_flags(),
        )

    def stop(self) -> None:
        self._stop = True
        if self._proc and self._proc.poll() is None:
            log.info("Stopping %s (pid=%s)", self.spec.display_name, self._proc.pid)
            try:
                self._proc.terminate()
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()

    def is_alive(self) -> bool:
        return bool(self._proc and self._proc.poll() is None)

    def pid(self) -> Optional[int]:
        return self._proc.pid if self._proc else None


def run(server_keys: list[str], *, restart_backoff_s: int = 5) -> None:
    """Blocking supervisor loop. Ctrl-C to stop everything cleanly."""
    paths.ensure()
    procs: dict[str, ServerProcess] = {}
    for key in server_keys:
        spec = schema.get_server(key)
        proc = ServerProcess(spec, spec.default_port)
        proc.start()
        procs[key] = proc

    _write_pid_file(procs)
    log.info("Launcher up. Managing %s. Ctrl-C to stop.", ", ".join(server_keys))

    stop_evt = threading.Event()

    def _shutdown(*_):
        log.info("Shutdown signal received.")
        stop_evt.set()

    signal.signal(signal.SIGINT, _shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _shutdown)

    try:
        while not stop_evt.is_set():
            for key, proc in procs.items():
                if not proc.is_alive() and not proc._stop:
                    log.warning("%s exited — restarting in %ds",
                                proc.spec.display_name, restart_backoff_s)
                    time.sleep(restart_backoff_s)
                    proc.start()
                    _write_pid_file(procs)
            stop_evt.wait(2)
    finally:
        for proc in procs.values():
            proc.stop()
        _clear_pid_file()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _no_window_flags() -> int:
    if sys.platform == "win32":
        return subprocess.CREATE_NO_WINDOW  # keep the console clean for tray users
    return 0


def _write_pid_file(procs: dict[str, ServerProcess]) -> None:
    data = {k: {"pid": p.pid(), "port": p.port, "alive": p.is_alive()} for k, p in procs.items()}
    tmp = paths.LAUNCHER_PID_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, paths.LAUNCHER_PID_FILE)


def _clear_pid_file() -> None:
    try:
        paths.LAUNCHER_PID_FILE.unlink()
    except FileNotFoundError:
        pass
