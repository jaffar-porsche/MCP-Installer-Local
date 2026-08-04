"""Manage MCP server subprocesses from the Control Panel.

One `ServerRuntime` per server, all owned by the control-panel process. Unlike
the standalone `launcher.py` (which is a foreground supervisor), this module
lets a GUI start/stop each server independently and observe live status.

Design
------
    * Subprocesses are spawned **fully detached** on Windows
      (``DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP``) so they keep running
      after the Control Panel window is closed.
    * Each server's PID is written to ``%APPDATA%\\MCPorsche\\state\\<key>.pid``
      when spawned and cleared when stopped. A re-opened Control Panel
      reads that file and *attaches* to the still-running server instead of
      launching a duplicate.
    * Health is derived from two signals:
        - process liveness (OS-level PID check)
        - a periodic HTTP GET on /health/pat
    * Everything is thread-safe: the poller runs on a daemon thread and
      publishes state through a `RuntimeState` snapshot.
    * No external dependencies (uses stdlib urllib).
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional

from . import env_manager, paths, schema


log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Public status enum
# --------------------------------------------------------------------------- #

class RunState(str, Enum):
    UNCONFIGURED = "UNCONFIGURED"   # no .env yet
    STOPPED = "STOPPED"             # configured but process not running
    STARTING = "STARTING"           # process spawned, /health not yet responsive
    RUNNING_OK = "RUNNING_OK"       # /health/pat returned 200
    RUNNING_PAT_BAD = "RUNNING_PAT_BAD"   # /health/pat returned 401
    CRASHED = "CRASHED"             # process died unexpectedly
    ERROR = "ERROR"                 # persistent error, see message


@dataclass(frozen=True)
class RuntimeState:
    key: str
    display_name: str
    port: int
    state: RunState
    message: str = ""
    pid: Optional[int] = None
    display_user: Optional[str] = None
    updated_at: float = field(default_factory=time.time)


# --------------------------------------------------------------------------- #
# Per-server runtime
# --------------------------------------------------------------------------- #

class ServerRuntime:
    """Owns one MCP server subprocess plus its health-polling state."""

    def __init__(self, spec: schema.ServerSpec) -> None:
        self.spec = spec
        self._proc: Optional[subprocess.Popen] = None
        self._pid: Optional[int] = None
        self._lock = threading.Lock()
        self._state = RunState.STOPPED
        self._message = ""
        self._display_user: Optional[str] = None

        # Attach to an already-running server left over from a previous
        # Control Panel session, if the PID file points at a live process.
        saved = _load_pid_file(self.spec.key)
        if saved and _is_pid_alive(saved):
            self._pid = saved
            self._state = RunState.STARTING
            self._message = "Attached to existing server from previous session."

    # ---- subprocess control ------------------------------------------------ #

    def is_configured(self) -> bool:
        return bool(env_manager.read_env(paths.env_file(self.spec.server_dir_name)))

    def port(self) -> int:
        values = env_manager.read_env(paths.env_file(self.spec.server_dir_name))
        raw = (values.get("MCP_PORT") or "").strip()
        if raw.isdigit():
            return int(raw)
        return self.spec.default_port

    def start(self) -> None:
        if self.is_alive():
            log.info("%s already running (pid=%s)", self.spec.display_name, self._pid)
            return
        if not self.is_configured():
            self._set(RunState.UNCONFIGURED, "No .env file yet — run the Setup Wizard.")
            return
        cwd = paths.server_dir(self.spec.server_dir_name)
        # Prefer the windowless pythonw.exe on Windows so no CMD flash appears.
        venv_py = paths.venv_python(self.spec.server_dir_name, prefer_windowless=True)
        if not venv_py.exists():
            self._set(RunState.ERROR,
                      f"Virtual environment missing.\nRun install.ps1 first.\nExpected: {venv_py}")
            return

        log_file = paths.log_file_for(self.spec.key)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        cmd = [str(venv_py), "-m", "uvicorn", self.spec.app_module,
               "--host", "127.0.0.1", "--port", str(self.port())]

        log.info("Starting %s: %s", self.spec.display_name, " ".join(cmd))
        try:
            self._proc = subprocess.Popen(
                cmd, cwd=str(cwd),
                stdin=subprocess.DEVNULL,
                stdout=open(log_file, "ab"),
                stderr=subprocess.STDOUT,
                creationflags=_detached_flags(),
                close_fds=True,
            )
        except OSError as e:
            self._set(RunState.ERROR, f"Failed to spawn uvicorn: {e}")
            return
        self._pid = self._proc.pid
        _save_pid_file(self.spec.key, self._proc.pid)
        self._set(RunState.STARTING, "Waiting for health probe…")

    def stop(self) -> None:
        with self._lock:
            proc = self._proc
            pid = self._pid

        if proc is not None and proc.poll() is None:
            log.info("Stopping %s (pid=%s)", self.spec.display_name, proc.pid)
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        elif pid is not None and _is_pid_alive(pid):
            log.info("Killing detached %s (pid=%s) via taskkill",
                     self.spec.display_name, pid)
            try:
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/T", "/F"],
                    capture_output=True, timeout=5,
                )
            except Exception:  # pragma: no cover — defensive
                log.exception("taskkill failed for %s pid=%s", self.spec.key, pid)

        self._proc = None
        self._pid = None
        _clear_pid_file(self.spec.key)
        self._set(RunState.STOPPED, "Stopped.")

    def restart(self) -> None:
        self.stop()
        time.sleep(0.6)   # let the port free up
        self.start()

    def is_alive(self) -> bool:
        if self._proc is not None and self._proc.poll() is None:
            return True
        if self._pid is not None and _is_pid_alive(self._pid):
            return True
        return False

    # ---- polling ----------------------------------------------------------- #

    def poll(self) -> RuntimeState:
        """One tick of the health poller. Returns a fresh snapshot."""
        if not self.is_configured():
            self._set(RunState.UNCONFIGURED, "No .env yet.")
            return self.snapshot()

        if self._proc is None and self._pid is None:
            self._set(RunState.STOPPED, "Not running.")
            return self.snapshot()

        if not self.is_alive() and self._state not in (RunState.STOPPED,):
            code = self._proc.returncode if self._proc else "unknown"
            self._set(RunState.CRASHED,
                      f"Server exited (code {code}). See {paths.log_file_for(self.spec.key)}")
            self._proc = None
            self._pid = None
            _clear_pid_file(self.spec.key)
            return self.snapshot()

        # Process alive → probe /health/pat.
        url = f"http://127.0.0.1:{self.port()}{self.spec.health_path}"
        status, body = _http_probe(url, timeout=2.0)

        if status == 200:
            user = _extract_display_user(body)
            self._display_user = user
            self._set(RunState.RUNNING_OK,
                      f"Running on port {self.port()}." + (f" User: {user}" if user else ""))
        elif status == 401:
            self._set(RunState.RUNNING_PAT_BAD,
                      "Server is running but the PAT is invalid or expired.")
        elif status is None:
            if self._state == RunState.STARTING:
                self._set(RunState.STARTING, "Waiting for health probe…")
            else:
                self._set(RunState.STARTING, "Health probe not responding yet.")
        else:
            self._set(RunState.RUNNING_OK if 200 <= status < 300 else RunState.ERROR,
                      f"HTTP {status} from /health/pat")
        return self.snapshot()

    def snapshot(self) -> RuntimeState:
        pid = self._proc.pid if self._proc else self._pid
        return RuntimeState(
            key=self.spec.key,
            display_name=self.spec.display_name,
            port=self.port(),
            state=self._state,
            message=self._message,
            pid=pid,
            display_user=self._display_user,
        )

    def _set(self, state: RunState, message: str) -> None:
        with self._lock:
            self._state = state
            self._message = message


# --------------------------------------------------------------------------- #
# Registry + poller thread
# --------------------------------------------------------------------------- #

class Controller:
    """Facade the Control Panel talks to."""

    def __init__(self, server_keys: list[str]) -> None:
        self._runtimes: dict[str, ServerRuntime] = {
            k: ServerRuntime(schema.get_server(k)) for k in server_keys
        }
        self._on_change: Optional[Callable[[list[RuntimeState]], None]] = None
        self._poller: Optional[threading.Thread] = None
        self._stop = threading.Event()

    def set_listener(self, cb: Callable[[list[RuntimeState]], None]) -> None:
        self._on_change = cb

    def keys(self) -> list[str]:
        return list(self._runtimes)

    def get(self, key: str) -> ServerRuntime:
        return self._runtimes[key]

    def snapshot_all(self) -> list[RuntimeState]:
        return [rt.snapshot() for rt in self._runtimes.values()]

    def start(self, key: str) -> None:
        self._runtimes[key].start()
        self._notify()

    def stop(self, key: str) -> None:
        self._runtimes[key].stop()
        self._notify()

    def restart(self, key: str) -> None:
        self._runtimes[key].restart()
        self._notify()

    def start_all(self) -> None:
        for k in self._runtimes:
            self._runtimes[k].start()
        self._notify()

    def stop_all(self) -> None:
        for k in self._runtimes:
            self._runtimes[k].stop()
        self._notify()

    def start_poller(self, interval_s: float = 3.0) -> None:
        if self._poller and self._poller.is_alive():
            return
        self._poller = threading.Thread(
            target=self._run, args=(interval_s,),
            name="MCPorschePoller", daemon=True,
        )
        self._poller.start()

    def stop_poller(self) -> None:
        self._stop.set()
        if self._poller:
            self._poller.join(timeout=2)

    def _run(self, interval_s: float) -> None:
        while not self._stop.wait(interval_s):
            for rt in self._runtimes.values():
                rt.poll()
            self._notify()

    def _notify(self) -> None:
        if self._on_change is None:
            return
        try:
            self._on_change(self.snapshot_all())
        except Exception:  # pragma: no cover
            log.exception("Control-panel listener raised")


# --------------------------------------------------------------------------- #
# PID file helpers
# --------------------------------------------------------------------------- #

def _save_pid_file(key: str, pid: int) -> None:
    paths.ensure()
    try:
        paths.pid_file_for(key).write_text(str(pid), encoding="utf-8")
    except OSError:  # pragma: no cover
        log.exception("Could not write PID file for %s", key)


def _load_pid_file(key: str) -> Optional[int]:
    try:
        raw = paths.pid_file_for(key).read_text(encoding="utf-8").strip()
    except (FileNotFoundError, OSError):
        return None
    try:
        return int(raw) if raw else None
    except ValueError:
        return None


def _clear_pid_file(key: str) -> None:
    try:
        paths.pid_file_for(key).unlink()
    except FileNotFoundError:
        pass
    except OSError:  # pragma: no cover
        log.debug("Failed to unlink PID file for %s", key, exc_info=True)


def _is_pid_alive(pid: int) -> bool:
    """Return True if a process with the given PID exists.

    On POSIX this uses ``os.kill(pid, 0)`` — a well-known safe probe.

    On Windows we must NOT use ``os.kill(pid, 0)``: Python's implementation
    doesn't treat signal 0 as a no-op and may end up delivering ``CTRL_C_EVENT``
    to our own process group, killing the Control Panel. Instead we call
    ``OpenProcess`` + ``GetExitCodeProcess`` via ctypes; if the exit code is
    ``STILL_ACTIVE`` (259) the process is running.
    """
    if not pid or pid <= 0:
        return False
    if sys.platform == "win32":
        return _win32_pid_alive(pid)
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _win32_pid_alive(pid: int) -> bool:  # pragma: no cover — only exercised on Windows
    import ctypes

    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    STILL_ACTIVE = 259

    kernel32 = ctypes.windll.kernel32
    kernel32.OpenProcess.restype = ctypes.c_void_p
    kernel32.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
    kernel32.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
    kernel32.GetExitCodeProcess.restype = ctypes.c_int
    kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
    kernel32.CloseHandle.restype = ctypes.c_int

    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return False
    exit_code = ctypes.c_ulong()
    ok = kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
    kernel32.CloseHandle(handle)
    if not ok:
        return False
    return exit_code.value == STILL_ACTIVE


# --------------------------------------------------------------------------- #
# Subprocess helpers
# --------------------------------------------------------------------------- #

def _detached_flags() -> int:
    """Flags that fully detach the child from the parent process.

    On Windows this ensures the MCP server keeps running after the Control
    Panel window is closed. DETACHED_PROCESS drops the parent's console;
    CREATE_NEW_PROCESS_GROUP prevents Ctrl-C on the parent from cascading.
    """
    if sys.platform == "win32":
        return subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    # POSIX: caller may pass start_new_session=True; nothing needed via flags.
    return 0


def _http_probe(url: str, *, timeout: float) -> tuple[Optional[int], bytes]:
    """Return (status_code, body_bytes). status None on connection failure."""
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(req, timeout=timeout) as resp:
            return resp.getcode(), resp.read(4096)
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read(4096)
        except Exception:
            return e.code, b""
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
        return None, b""


def _extract_display_user(body: bytes) -> Optional[str]:
    try:
        data = json.loads(body.decode("utf-8", errors="replace"))
    except Exception:
        return None
    pat = (data.get("pat") or {}) if isinstance(data, dict) else {}
    for k in ("display_name", "displayName", "name", "username"):
        v = pat.get(k) if isinstance(pat, dict) else None
        if isinstance(v, str) and v:
            return v
        v2 = data.get(k) if isinstance(data, dict) else None
        if isinstance(v2, str) and v2:
            return v2
    return None
