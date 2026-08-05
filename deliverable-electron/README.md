# MCP-Installer

MCP-Installer is the Windows desktop distribution for the Porsche MCP server
tooling. It installs, configures, and monitors the bundled Jira, Confluence,
and GitLab MCP servers through a native Electron user interface.

## Overview

The application provides:

- A Windows installer for the desktop application.
- A React and TypeScript user interface for first-run setup and daily
  operations.
- Bundled Python-based MCP server sources for Jira, Confluence, and GitLab.
- Health checks and status monitoring for managed servers.
- Integration helpers for local VS Code and Claude configuration.

## Release Model

The project uses a manual release process for Windows installers.

1. Build the installer locally.
2. Upload the generated `.exe` to the GitHub release in the web UI.
3. Optionally send a Teams notification with the release link.

There is no GitHub Actions-based installer publishing step and no in-app
automatic update check.

## Maintainer Release Procedure

1. Update the version in [package.json](package.json).
2. Commit and push the version change.
3. Build the installer locally:

```powershell
cd deliverable-electron
npm install
npm run typecheck
npm run build:win:safe
```

4. Create or edit the GitHub release and upload the generated installer from
   `dist\MCP-Installer-Setup-<version>.exe`.
5. Share the release URL with users.
6. Optionally send a Teams notification:

```powershell
$env:TEAMS_WEBHOOK_URL = 'https://outlook.office.com/webhook/...'
npm run notify:teams
```

The Teams notification script reads the application version from
[package.json](package.json) and posts the latest release URL by default. To
target a specific release page, set `MCP_INSTALLER_RELEASE_URL` or pass
`-ReleaseUrl` to the script.

## Installation and Updates

End users install the application by downloading the latest Windows installer
from GitHub Releases and running it locally.

- First install: the setup wizard collects credentials and prepares the local
  MCP server environment.
- Upgrades: users install the newer `.exe` over the existing installation.
- Automatic background updates are not enabled.

Application state is designed to survive upgrades. Installer refreshes replace
the packaged application files while preserving user-specific state under
`%APPDATA%\MCP-Installer`. Existing MCP server configuration and environments
are intended to be reused during a normal in-place upgrade. A full uninstall is
the destructive case, because it can remove application data depending on the
uninstall path the user takes.

## Prerequisites

- Windows 10 or Windows 11, x64.
- Python 3.10 or later on `PATH`.
- Network access to the required Porsche internal systems.
- Corporate proxy access where applicable.

## Local Development

```powershell
cd deliverable-electron
npm install
npm run dev
npm run typecheck
npm run build
npm run build:win
npm run notify:teams
```

## Architecture

The application is split into three layers:

- Renderer: React-based wizard and control panel user interfaces.
- Preload: context bridge and IPC exposure.
- Main process: manifest loading, environment management, proxy detection,
  bootstrap operations, process control, and desktop integration.

Bundled MCP servers are copied into `mcp-servers/` next to the installed
application. User-writable state such as logs, selection state, and backups is
stored under `%APPDATA%\MCP-Installer`.

## Extension Model

New MCP servers can be added by supplying a new server directory and a matching
`MCP-Installer.json` manifest. At startup, the desktop application scans the
available manifests and exposes those servers in the setup and control flows.

## Migration Notes

The Electron distribution is designed to coexist with the earlier Python-based
installer approach. Existing state can be reused, including server selection
state and backup files. Users migrating from the previous installer should not
need to reconfigure the application when performing a normal upgrade path.
