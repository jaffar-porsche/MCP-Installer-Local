# MCPorsche — End-User Deliverable

> **For non-technical users.** Double-click, click through a wizard, done.
> **For engineers.** Plugin architecture — new MCP servers plug in via a JSON manifest, zero code changes.

This deliverable turns the developer-oriented MCP servers in this repo into a
packaged, self-configuring install for coworkers who should not have to touch
Python, virtual environments, `.env` files, or proxies.

## Architecture at a glance

```
                                  ┌───────────────────────────┐
   Setup Wizard ──writes───▶ .env │  jira-mcp/                │
                                  │  confluence-mcp/          │
                                  │  <name>-mcp/  ← plug-in   │
                                  └───────────────────────────┘
        │                                    ▲
        │ writes selection                   │
        ▼                                    │
   %APPDATA%\MCPorsche\state\  ◀── read ── Control Panel
        │                                    │
        │                                    ├─── spawns (detached, pythonw.exe)
        │                                    │       ▶ uvicorn @ 127.0.0.1:<port>
        │                                    │
        │                                    ├─── polls /health/pat
        │                                    │
        │                                    └─── on 401 → PAT expired → red dot
        │                                                                │
        ▼                                                                ▼
   backups/ (rotated)                                            "Rotate PAT" fast path
```

## Plugin architecture — adding a new MCP server

Everything the deliverable does is data-driven from **JSON manifests**. Adding
a new MCP server does **not** require editing any Python.

1. Create your MCP server folder (e.g. `foo-mcp/`) with its own venv,
   `mcp_server.py`, `.env.example`, etc.
2. Copy the health-status pattern from
   [jira-mcp/routes/health.py](../jira-mcp/routes/health.py) so `/health/pat`
   returns 401 when the PAT is bad.
3. Drop a `foo-mcp/mcporsche.json` manifest (see
   [mcporsche_setup/manifests/README.md](mcporsche_setup/manifests/README.md)
   for the schema).
4. Run `python -m mcporsche_setup configure` — the new server appears in the
   wizard and the Control Panel automatically.

Built-in manifests live in [mcporsche_setup/manifests/](mcporsche_setup/manifests/).
Repo-local manifests override built-in ones on `key` collision.

## Industry-standard patterns used

| Concern | Pattern | Why |
|---|---|---|
| Config source | JSON manifests + validators-by-name | Adding servers ≠ writing Python. Testable, diff-friendly. |
| Secret storage | `.env` files under the server folder | Same location the server itself reads. No custom vault to reason about. |
| PAT rotation | Wizard + tray + panel all share `env_manager` | One atomic-write path with rotating backups. |
| Process supervision | Detached subprocess + PID file | Servers survive panel close. Panel *attaches* to running processes on re-open. |
| Console suppression | Uses `pythonw.exe` (Windows-headless Python) | No CMD flashes, standard Windows service pattern for user-mode daemons. |
| PAT-expiry detection | Server-side `/health/pat` returning 401 | Standard health-endpoint pattern; polled by tray/panel with `urllib`. |
| Failure classification | Tagged-union result (`Status.PAT_INVALID` / `.NETWORK` / …) | Actionable errors instead of "it failed". |
| Path handling | `%APPDATA%\MCPorsche\` for user data | Never write into install dir → upgradable, non-admin. |
| Windows shortcuts | WScript.Shell COM via PowerShell | No native COM deps in Python; stdlib only. |

## Running MCP servers as Windows services

The current implementation runs each MCP server as a **detached user-mode
process** launched by the Control Panel. That's the sweet spot for tools that
depend on per-user PATs and per-user proxy settings.

For enterprise deployments that want servers running under `SYSTEM` (survive
logout, restart on crash under the OS supervisor), we recommend
[NSSM](https://nssm.cc/) — the Non-Sucking Service Manager:

```powershell
# One-time (elevated shell):
nssm install MCPorsche-Jira "%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe" ^
    "-m uvicorn mcp_server:app --host 127.0.0.1 --port 8000"
nssm set    MCPorsche-Jira AppDirectory "C:\path\to\jira-mcp"
nssm set    MCPorsche-Jira AppStdout    "%APPDATA%\MCPorsche\logs\jira.log"
nssm set    MCPorsche-Jira AppStderr    "%APPDATA%\MCPorsche\logs\jira.log"
nssm start  MCPorsche-Jira
```

Trade-off: per-user PATs are trickier to inject when running under SYSTEM.
Most deployments should stick with the detached user-mode model.

## What the user gets

1. A **one-click installer** (`MCPorsche-Setup.bat`) that:
   - Detects/uses Python (installs via `winget` if allowed).
   - Creates isolated virtual environments per server.
   - Installs dependencies (proxy-aware).
   - Launches the **Setup Wizard**.
   - Registers the MCP endpoints in **VS Code** and **Claude Desktop**.
   - Creates a **Start Menu** shortcut + optional **Desktop** and **Startup** shortcuts.

2. A **Setup Wizard** (Tkinter GUI, no extra deps) that:
   - Runs step-by-step (Welcome → Choose servers → Proxy → per-server PAT pages → Review → Install → Done).
   - Auto-detects corporate proxy from Windows system settings.
   - Password-masks PATs, with show/hide toggle.
   - **Tests the PAT** live and classifies failures
     (invalid, expired, no network, proxy required, cert issue).
   - Saves `.env` files **atomically** with backup rotation.
   - Never logs secrets.

3. A **Control Panel** with:
   - One row per server: coloured status dot, port, Start/Stop/Restart, Rotate PAT, Test, Logs.
   - **No auto-start on open** — you press Start when you want a server up.
   - Polls each server's `/health/pat` every 3 s.
   - Closing the panel keeps the servers running (they're spawned detached).
   - Footer buttons: **Reconfigure**, **Open logs**, **VS Code integration**, **Shortcut…**, **Quit**.

4. **Server-side PAT expiry detection**:
   - `GET /health` and `GET /health/pat` on each MCP server.
   - Every 401 from upstream flips the server's PAT state → tray/panel dot turns red immediately.

## Directory layout

```
deliverable/
├── README.md                     — this file
├── MCPorsche-Setup.bat           — double-clickable entry point
├── install.ps1                   — bootstrap: Python + venv + deps + wizard
├── uninstall.ps1
├── build/
│   └── build_exe.ps1             — PyInstaller build for single-file EXE
└── mcporsche_setup/              — Python package (stdlib only for the wizard)
    ├── __main__.py               — `python -m mcporsche_setup {configure|panel|rotate|tray|test|integrate|launcher}`
    ├── schema.py                 — manifest loader + Field/ServerSpec types
    ├── manifests/                — one JSON per server; drop a file, done
    │   ├── README.md             — manifest schema + add-a-server checklist
    │   ├── _common.json          — shared field groups (proxy, transport)
    │   ├── jira.json
    │   ├── confluence.json
    │   └── gitlab.json
    ├── paths.py                  — data-driven filesystem helpers
    ├── env_manager.py            — atomic .env read/write + backup rotation
    ├── selection_store.py        — persists the user's server selection
    ├── shortcut.py               — Start Menu / Desktop / Startup .lnk builder
    ├── proxy_detector.py         — reads Windows IE proxy from registry
    ├── connection_tester.py      — classified PAT/network diagnostics
    ├── health_monitor.py         — polls /health/pat, writes state JSON
    ├── server_controller.py      — detached subprocess supervisor (pythonw.exe)
    ├── wizard.py                 — Setup Wizard (Welcome → … → Done)
    ├── control_panel.py          — post-install dashboard
    ├── launcher.py               — headless supervisor (for CI/scripted rollouts)
    ├── tray.py                   — optional pystray icon (auto-degrades)
    ├── vscode_integrator.py      — patches VS Code / Claude Desktop configs
    └── configurator.py           — legacy single-window rotator (fast path from tray)
```

## Install (end user's steps)

1. Copy the `mcporsche-deliverable-<version>.zip` to any folder.
2. Right-click `MCPorsche-Setup.bat` → **Run as administrator** (only needed
   if Python is missing and you want winget to install it).
3. Follow the wizard. Paste your PAT(s). Click **Test connection**. Click **Save**.
4. Open the Control Panel from the Start Menu or Desktop, click **Start** on the servers you need.

## When a PAT expires later

The tray icon turns **red** and shows a toast:
> *"Your Jira PAT has expired. Right-click the tray icon → Rotate PAT."*

The user pastes a new PAT, clicks Test → Save, and everything continues.
No terminal. No `.env` editing. No restart of anything else.

## Build a single-file `.exe`

```powershell
cd deliverable
.\build\build_exe.ps1
```

Produces `dist/MCPorsche.exe` with the wizard + launcher + tray, no
Python required on the target machine.
