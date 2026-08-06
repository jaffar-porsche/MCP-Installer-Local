# MCP-Installer 1.0.0

## Summary

MCP-Installer 1.0.0 is the first Windows desktop release of the Porsche MCP
Installer. It provides a packaged Electron application for installing,
configuring, and operating local MCP servers through a single desktop
experience.

## Highlights

- Windows installer for the MCP-Installer desktop application.
- Guided setup flow for Jira, Confluence, and GitLab MCP servers.
- Built-in bootstrap process for Python virtual environments and required
  server dependencies.
- Centralized configuration management for server credentials and connection
  settings.
- Control panel for starting, stopping, and monitoring local MCP services.
- Proxy-aware connectivity checks and PAT validation during setup.
- Local integration support for developer tooling such as VS Code and Claude.

## Release Notes

- This release establishes the first supported desktop distribution for local
  MCP server management on Windows.
- Updates are currently delivered through manual installer distribution.
- Existing application state is designed to be reused during normal in-place
  upgrades.

## Requirements

- Windows 10 or Windows 11, x64.
- Python 3.10 or later available on `PATH`.
- Network access to required Porsche internal systems.

## Installation

1. Download the `MCP-Installer Setup 1.0.0.exe` package.
2. Run the installer.
3. Complete the setup wizard and provide the required credentials.
4. Start the selected MCP services from the control panel.