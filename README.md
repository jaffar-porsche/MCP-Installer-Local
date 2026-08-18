# MCP-Installer (MCP Control Panel)

This repository contains local Model Context Protocol (MCP) servers and the
Electron-based desktop application used to install, run and manage them on
Windows. It is intended for developers and integrators who need local MCP
endpoints for testing, integration, or offline workflows.

Core components
- `jira-mcp` — Local MCP-compatible wrapper for Jira REST APIs. See `jira-mcp/README.md`.
- `confluence-mcp` — Local MCP-compatible wrapper for Confluence REST APIs. See `confluence-mcp/README.md`.
- `gitlab-mcp` — Local MCP-compatible wrapper for GitLab APIs. See `gitlab-mcp/README.md`.
- `deliverable-electron` — Electron desktop app that configures, bootstraps and monitors the above servers.

Supporting directories
- `atlassian` — Build assets, helper scripts and container tools used for Atlassian-related tasks (certs, Dockerfiles, packaging helpers).
- `docker` — Docker Compose and container helper scripts for running services in containers during development or CI.
- `mcp-at-scale` — Shared tooling and SDKs for enterprise / large-scale MCP deployments (integration helpers, templates, infra scripts).
- `porsche-design-system` — Design system components and assets used by the Electron UI and other web UIs in the repo.

Quick start
1. Pick the component you need and read its README (e.g. `deliverable-electron/README.md`).
2. For the desktop app: `cd deliverable-electron && npm run dev` to run in development.
3. Use the app to bootstrap selected servers; default local endpoints are shown in each server README after setup.

Contribution Guidelines

To maintain code quality and stability, follow this process for changes:

1. Create a separate branch (do not commit to the default branch, e.g. `main`). Use descriptive names like `feature/*`, `fix/*`, `chore/*`.
2. Implement and test locally. Keep changes focused and follow existing conventions.
3. Open a Pull Request to the default branch (e.g. `main`) with a clear description of changes and rationale.
4. Require at least one reviewer approval before merging. Address review feedback.
5. Merge only after approval; do not self-merge unless explicitly authorized.

For detailed component setup and advanced topics, consult the per-component README files listed below.

Component README links
- `deliverable-electron/README.md`
- `jira-mcp/README.md`
- `confluence-mcp/README.md`
- `gitlab-mcp/README.md`