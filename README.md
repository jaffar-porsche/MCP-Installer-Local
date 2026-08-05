# MCP-Installer Repository

This repository contains Porsche-focused Model Context Protocol services,
supporting tooling, and the Windows desktop installer used to configure and run
local MCP integrations.

The GitHub repository is a mirror of the canonical GitLab source. Day-to-day
development, issue tracking, and code review continue to happen in GitLab.

## Repository Scope

The repository currently contains:

- Local MCP servers for Jira, Confluence, and GitLab.
- A Windows desktop application that installs and manages bundled MCP servers.
- Shared tooling and infrastructure for packaging, integration, and enterprise
  rollout.
- Supporting assets for Docker-based local execution and internal platform work.

## Primary Components

### Jira MCP Server

Location: [jira-mcp](c:\Users\WEN8J0B\Desktop\MCP-Installer\jira-mcp)

The Jira server provides local MCP access for issue management, attachments,
comments, projects, sprints, and related workflows.

### Confluence MCP Server

Location: [confluence-mcp](c:\Users\WEN8J0B\Desktop\MCP-Installer\confluence-mcp)

The Confluence server provides local MCP access for page management, comments,
hierarchy traversal, search, and user lookup.

### GitLab MCP Server

Location: [gitlab-mcp](c:\Users\WEN8J0B\Desktop\MCP-Installer\gitlab-mcp)

The GitLab server provides local MCP access for GitLab-based repository and
delivery workflows.

### Electron Desktop Installer

Location: [deliverable-electron](c:\Users\WEN8J0B\Desktop\MCP-Installer\deliverable-electron)

The Electron application packages a Windows installer for MCP-Installer and
provides a desktop user interface for setup, health monitoring, configuration,
and local integration tasks.

### Shared and Supporting Directories

- [atlassian](c:\Users\WEN8J0B\Desktop\MCP-Installer\atlassian): supporting Atlassian-related build and container assets.
- [docker](c:\Users\WEN8J0B\Desktop\MCP-Installer\docker): shared startup scripts for container-based workflows.
- [mcp-at-scale](c:\Users\WEN8J0B\Desktop\MCP-Installer\mcp-at-scale): shared enterprise MCP tooling and SDK work.
- [porsche-design-system](c:\Users\WEN8J0B\Desktop\MCP-Installer\porsche-design-system): design-system related application assets.

## Jira Availability Note

The centrally hosted Skyway Jira MCP service is available for teams that prefer
an enterprise-hosted option. The local Jira MCP server in this repository
remains relevant where additional features or local-side customization are
required.

Reference material:

- [Using the Skyway MCP Server for Jira](https://skyway.porsche.com/confluence/spaces/CUD/pages/2389416318/Using+the+Skyway+MCP+Server+for+Jira)
- [Side-by-Side MCP Servers — Local and Central Jira](https://skyway.porsche.com/confluence/spaces/FIT3A/pages/2402848179/Side-by-Side+MCP+Servers+%E2%80%94+Local+Central+JIRA+Example)
- [Jira MCP Servers — Skyway and Local Comparison](https://skyway.porsche.com/confluence/spaces/FIT3A/pages/2402848265/JIRA+MCP+Servers+%E2%80%94+Skyway+Central+mcporsche+Local)
- [VS Code Configuration and Integration](https://skyway.porsche.com/confluence/spaces/FIT3A/pages/2402848271/VS+Code+Configuration+and+Integration)

## Important Usage Notice

Use local MCP connections with appropriate care for compliance, personal-data
handling, and load on internal systems. Follow the internal Jira work item for
updates on the enterprise-ready rollout:

- https://skyway.porsche.com/jira/browse/DEVX-1057

## Getting Started

1. Choose the component relevant to your workflow.
2. Open the component-specific README for setup and runtime details.
3. Configure required credentials such as Personal Access Tokens.
4. Run the server or desktop application locally.
5. Connect your MCP-capable client such as VS Code or Claude Desktop.

## Docker Usage

Use Docker Compose when you want to run the containerized services locally.

1. Prepare environment configuration.
2. Populate required tokens.
3. Start the desired services.

Typical commands:

```powershell
docker-compose up
docker-compose up jira-mcp
docker-compose up jira-mcp confluence-mcp
docker-compose down
```

Default local endpoints:

- Jira MCP: `http://localhost:8000/mcp`
- Confluence MCP (Porsche): `http://localhost:8001/mcp`
- Confluence MCP (VW): `http://localhost:8009/mcp`
- GitLab MCP: `http://localhost:8003/mcp`

## Common Requirements

Most components in this repository require:

- Valid Personal Access Tokens or equivalent credentials.
- Access to Porsche internal systems and network routes.
- Local runtime dependencies such as Python or Node.js, depending on the
  component.
- Local environment configuration through `.env` or equivalent settings.

## Documentation Map

- [deliverable-electron/README.md](c:\Users\WEN8J0B\Desktop\MCP-Installer\deliverable-electron\README.md)
- [jira-mcp/README.md](c:\Users\WEN8J0B\Desktop\MCP-Installer\jira-mcp\README.md)
- [confluence-mcp/README.md](c:\Users\WEN8J0B\Desktop\MCP-Installer\confluence-mcp\README.md)
- [gitlab-mcp/README.md](c:\Users\WEN8J0B\Desktop\MCP-Installer\gitlab-mcp\README.md)
- [CONTRIBUTING.md](c:\Users\WEN8J0B\Desktop\MCP-Installer\CONTRIBUTING.md)