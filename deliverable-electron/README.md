# MCP-Installer — Electron edition

**Powered by PEG-IT (Porsche Engineering)**

A modern, native desktop app that installs, configures, and monitors the
Porsche MCP servers (Jira, Confluence, GitLab and any future ones via
the plugin manifest system).

Same UX guarantees as the Python edition, now with:

- Native Electron chrome (Windows-installable, single-instance).
- Modern React + TypeScript UI with a Porsche Engineering visual identity.
- Fully-typed IPC contract (`src/shared/types.ts`) — no `any` in the wire.
- No CMD flashes — MCP servers spawn under `pythonw.exe`, detached and
  process-grouped, so closing the app keeps them running.
- Live health status via `/health/pat` polled every 3 s.
- Plug-and-play server registry: drop a `MCP-Installer.json` in any
  `<name>-mcp/` folder or in `resources/manifests/` — no code changes.

## Distribution — how end users get the `.exe`

Users never see Node.js, npm or TypeScript. The flow is exactly the same as
VS Code / Slack / Teams:

```
Maintainer                       End user
──────────                       ────────
git tag v2.0.0                   Open GitHub Releases page for this repo
git push --tags                  Click the "MCP-Installer-Setup-2.0.0.exe" asset
   │                             Double-click the download
   ▼                             NSIS installer runs (Next → Install → Done)
GitHub Actions builds            App auto-updates from every future release.
   │
   ▼
Release page publishes the .exe
```

### For maintainers — cutting a release

1. Bump the version in [package.json](package.json):
   ```json
   { "version": "2.0.0" }
   ```
2. Commit and tag:
   ```powershell
   git commit -am "chore: v2.0.0"
   git tag v2.0.0
   git push --tags
   ```
3. The [release workflow](../.github/workflows/release.yml) runs on the tag:
   - Sets up Node 20 on `windows-latest`.
   - `npm ci`, `npm run typecheck`, `npm run build:win -- --publish always`.
   - `electron-builder` uploads `dist\MCP-Installer-Setup-2.0.0.exe` and a
     matching `latest.yml` (the auto-update manifest) to the GitHub Release.
4. Send users this one link:
   `https://github.com/<org>/MCP-Installer/releases/latest`

### For end users — installing

1. Download **MCP-Installer-Setup-<version>.exe** from the link above.
2. Double-click it. If Windows shows a SmartScreen warning
   ("Unknown publisher"), click **More info → Run anyway** — this happens
   because the `.exe` isn't code-signed by default (see next section).
3. Choose an install location, click **Install**.
4. On first launch the Setup Wizard appears — paste your PATs, click Test,
   click Install. Done.
5. Every future release auto-updates silently. Users see a small
   "Restart now / Later" prompt only when a new version is downloaded.

### Prerequisites the user still needs

- **Windows 10 or 11 (x64)** — the release build targets `--win --x64`.
- **Python 3.10+** on PATH — MCP-Installer launches the Python-based MCP
  servers under `pythonw.exe`. Install once from
  [python.org](https://www.python.org/downloads/) or the Microsoft Store.
- **Corporate proxy access** to `skyway.porsche.com` (or DevX CLI proxy).

### Code signing (recommended for wide rollout)

Un-signed `.exe`s trigger the "Unknown publisher" SmartScreen warning until
enough users have run them. For internal Porsche rollout, request a
code-signing certificate and add two secrets to the GitHub repo:

| Secret | Value |
|---|---|
| `CSC_LINK` | Base64-encoded `.pfx` file |
| `CSC_KEY_PASSWORD` | Password for the `.pfx` |

The release workflow picks them up automatically — no code changes required.

---

## For developers — local setup

## For developers — local setup

```powershell
cd deliverable-electron
npm install
npm run dev           # HMR dev with electron-vite
npm run build         # Type-check and bundle to out/
npm run build:win     # Full installer at dist\MCP-Installer-Setup-<version>.exe
```

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Renderer (React 18 + Tailwind CSS)                             │
│  ├─ pages/wizard/     — Setup Wizard (Welcome → … → Done)     │
│  └─ pages/panel/      — Control Panel (Start/Stop/Rotate…)    │
├──────────── contextBridge (preload, contextIsolation=on) ─────┤
│ Main (Node.js)                                                 │
│  ├─ services/                                                  │
│  │   ├─ manifestLoader   plugin discovery (JSON)              │
│  │   ├─ envManager       atomic .env + rotating backups       │
│  │   ├─ selectionStore   user's chosen servers                │
│  │   ├─ proxyDetector    Windows registry via PowerShell      │
│  │   ├─ connectionTester classified PAT diagnostics           │
│  │   ├─ serverController detached child_process supervisor    │
│  │   ├─ shortcutManager  .lnk builder                         │
│  │   └─ vscodeIntegrator merges VS Code / Claude mcp.json     │
│  └─ index.ts             creates windows + wires IPC          │
└────────────────────────────────────────────────────────────────┘
```

### Trade-offs (deliberate)

| Concern | Choice | Trade-off |
|---|---|---|
| Framework | Electron | Bigger installer (~120 MB) but native, self-updating, familiar to VS Code / Slack / Teams users. |
| Styling | Tailwind CSS + Radix-free primitives | Fastest iteration, tiny component library owned in-house. |
| State | Zustand | No boilerplate; scales fine for one to two windows. |
| Native calls | PowerShell subprocess | Zero native modules → clean cross-arch builds. |
| Server processes | `pythonw.exe` + `DETACHED_PROCESS` | No CMD flash; servers survive the app closing. |

### Plugin architecture

Adding a new MCP server:

1. Create `foo-mcp/` next to the others with its own venv and `mcp_server.py`.
2. Copy the `/health/pat` pattern from `jira-mcp/routes/health.py`.
3. Drop `foo-mcp/MCP-Installer.json` — a copy of one of the built-ins with your keys.
4. Restart MCP-Installer. Your server appears in the wizard and the panel.

See `resources/manifests/` for shipped examples and the schema.

### Brand system

`tailwind.config.ts` exposes the whole design token palette under
`pag-*` (Porsche Engineering Group):

- `pag-red` — CTAs and highlights only.
- `pag-ink`, `pag-bg`, `pag-border`, `pag-text-*` — neutrals.
- `pag-success` / `pag-warning` / `pag-error` — traffic-light dots.

Header, red brand bar, wordmark, and "Powered by PEG-IT" footer are all in
`components/BrandFrame.tsx` — the single place to adjust the visual identity.

## Migrating from the Python edition

Both editions share the same on-disk state:

- `.env` files under each `<name>-mcp/`.
- `%APPDATA%\MCP-Installer\state\enabled_servers.json`.
- `%APPDATA%\MCP-Installer\backups\*.env.*.bak`.

Users who already installed the Python edition can uninstall the Python
Start Menu entries and install this Electron edition — nothing else needs
to be reconfigured.
