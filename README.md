# MCP Servers for Porsche

> **Mirror Notice:** This repository is mirrored from the canonical source at [GitLab (cicd.skyway.porsche.com/porsche/mcporsche)](https://cicd.skyway.porsche.com/porsche/mcporsche). All development — issues, merge requests, and code reviews — happens on GitLab. Do not open pull requests on GitHub; they will not be merged. Changes pushed to GitLab main are periodically synced here.

## Vision

We want that everyone at Porsche is enabled by specific MCP servers so that we can develop projects according to Porsche requirements. 

## 🎉 MCP Server for JIRA is Live!

The centrally hosted **Skyway MCP Server for JIRA** is now available! You no longer need to run the JIRA MCP server locally — the enterprise-ready solution is ready to use. 

- 📘 [Using the Skyway MCP Server for Jira](https://skyway.porsche.com/confluence/spaces/CUD/pages/2389416318/Using+the+Skyway+MCP+Server+for+Jira)

*Note: local version offers additional features; if you'd like the best of both worlds, you can run them side-by-side.*

- 🔀 [Side-by-Side MCP Servers — Local & Central JIRA](https://skyway.porsche.com/confluence/spaces/FIT3A/pages/2402848179/Side-by-Side+MCP+Servers+%E2%80%94+Local+Central+JIRA+Example)
- [JIRA MCP Servers — Skyway (Central) & mcporsche (Local)](https://skyway.porsche.com/confluence/spaces/FIT3A/pages/2402848265/JIRA+MCP+Servers+%E2%80%94+Skyway+Central+mcporsche+Local)
- ⚙️ [VS Code Configuration and Integration](https://skyway.porsche.com/confluence/spaces/FIT3A/pages/2402848271/VS+Code+Configuration+and+Integration)

## ⚠️ Important Notice

**Please use your local solution with care (compliant LLM, personal data, load to our on-premises system). We're investing considerable effort to ensure the solution is both high-quality and risk-acceptable.**

**Please follow the JIRA ticket to keep yourself informed about the enterprise-ready solution: https://skyway.porsche.com/jira/browse/DEVX-1057** 

## Servers in this repo

We have the following MCP servers available in this repository:

### 🎫 [JIRA MCP Server](jira-mcp/)
**Purpose:** Complete JIRA integration with issue and attachment management  
**Type:** Local HTTP/stdio MCP server  
**Features:**
- ✅ Create, read, update JIRA issues
- ✅ Upload, list, delete attachments
- ✅ Full CRUD operations with comprehensive field support
- ✅ Windows deployment automation via batch files
- ✅ HTTP and stdio protocol support for AI assistants

**Quick Start:** 
- Windows: `jira-mcp/start-mcp.bat`
- Linux/Mac: `jira-mcp/start-mcp.sh`

**Documentation:** [jira-mcp/README.md](jira-mcp/README.md)

### 📄 [Confluence MCP Server](confluence-mcp/)
**Purpose:** Confluence space and page management integration  
**Type:** Local HTTP MCP server  
**Features:**
- ✅ Create and update Confluence pages
- ✅ Search content across spaces
- ✅ Manage Confluence spaces
- ✅ Authentication via Personal Access Token

**Quick Start:** 
- Linux/Mac: `confluence-mcp/start-mcp.sh`
- Windows: Use equivalent batch script or manual Python execution

**Documentation:** [confluence-mcp/README.md](confluence-mcp/README.md)

### 🦊 [GitLab MCP Server](gitlab-mcp/)
**Purpose:** Complete GitLab integration for project and repository management
**Type:** Local HTTP MCP server
**Features:**
- ✅ Project, issue, and merge request management
- ✅ CI/CD pipeline operations and monitoring
- ✅ Repository file operations and branch management
- ✅ Authentication via Personal Access Token

**Quick Start:**
- Windows: `gitlab-mcp/start-mcp.bat`
- Linux/Mac: `gitlab-mcp/start-mcp.sh`

**Documentation:** [gitlab-mcp/README.md](gitlab-mcp/README.md)

### 🏗️ [Cloud Building Blocks as Code (CBBaC)](cbbac-github/)
**Purpose:** Access to Porsche Cloud Building Blocks via GitHub MCP integration  
**Type:** Uses GitHub's native MCP server (local client)  
**Features:**
- ✅ CBBaC module access through GitHub repositories
- ✅ Architecture guidance and system prompts
- ✅ Integration with Azure architecture components (AaC)
- ✅ Terraform module discovery and usage

**Team:** Mario Schwartz, Matthias Helmenstein  
**Note:** Currently runs locally only - GitHub repos are private  
**Documentation:** [cbbac-github/README.md](cbbac-github/README.md)

### 🚗 [Porsche ITSM MCP Server](porsche-itsm-mcp/)
**Purpose:** IT Service Management system integration  
**Type:** Local MCP server with API bridge  
**Features:**
- ✅ Create and manage incidents in ITSM Hub
- ✅ Retrieve and filter existing incidents
- ✅ Update incident status and properties
- ✅ Entra ID authentication integration
- ✅ Test stage API implementation

**Quick Start:** 
- All platforms: `npm start` (Node.js-based server)

**Documentation:** [porsche-itsm-mcp/README.md](porsche-itsm-mcp/README.md)

### 📚 [Porsche Glossary MCP Server (Carrera Online)](glossary-mcp/)
**Purpose:** Help AI agents understand Porsche "Fachchinesisch" using local copies of the official Carrera Online Glossar
**Type:** Local HTTP MCP server (uses local CSV files, no live SharePoint connection)
**Features:**
- ✅ 4 domain-specific glossaries (General, E/E, E³, Zoll & Steuern)
- ✅ Decode complex Porsche-specific abbreviations and technical terms
- ✅ Fuzzy/case-insensitive term matching with E^3/E³ normalization
- ✅ Full-text search in definitions and batch lookups
- ✅ Enable cross-departmental communication by explaining "Fachchinesisch"
- ⚠️ Manual updates required: CSV files must be re-downloaded when new terms are added to Carrera Online

**Quick Start:**
- All platforms: `python glossary-mcp/main.py`

**Documentation:** [glossary-mcp/README.md](glossary-mcp/README.md)

### ⚡ [MCP at Scale](mcp-at-scale/)
**Purpose:** Tools and SDKs for enterprise MCP server development  
**Type:** Development framework for building local MCP servers  
**Features:**
- ✅ Porsche-specific TypeScript SDK for MCP servers
- ✅ Client consent mechanism for security
- ✅ Role-based access control (RBAC) implementations
- ✅ Enterprise deployment patterns

**Documentation:** [mcp-at-scale/README.md](mcp-at-scale/README.md)

## 🚀 Getting Started

1. **Choose your MCP server** based on your integration needs
2. **Navigate to the specific directory** for detailed setup instructions
3. **Configure authentication** (PAT tokens, Entra ID, etc.)
4. **Start the server** using the provided local scripts or docker-compose
5. **Connect your AI assistant** (Claude Desktop, GitHub Copilot, etc.) to the local endpoint

## Docker

Run all MCP servers together using Docker Compose:

1. **Copy environment configuration**
   ```bash
   cp .env.example .env
   ```

2. **Configure your tokens** in `.env`
    - `JIRA_PAT`: Your Jira Personal Access Token
    - `CONFLUENCE_PAT`: Your Confluence Personal Access Token
    - `CONFLUENCE_VW_PAT`: Your VW Confluence Personal Access Token (optional, for VW DevStack instance)
    - `GITLAB_TOKEN`: Your GitLab Personal Access Token
    - Adjust ports if needed (defaults: Jira=8000, Confluence=8001, Confluence VW=8009, GitLab=8003)

3. **Start all services**
   ```bash
   docker-compose up
   ```

4. **Start specific service(s)**
   ```
   docker-compose up jira-mcp
   docker-compose up jira-mcp confluence-mcp
   ```

5. **Stop all services**
   ```bash
   docker-compose down
   ```

**MCP Endpoints:**
- Jira MCP: `http://localhost:8000/mcp`
- Confluence MCP (Porsche): `http://localhost:8001/mcp`
- Confluence MCP (VW): `http://localhost:8009/mcp`
- GitLab MCP: `http://localhost:8003/mcp`

## 🤖 Claude Code Configuration

To use these MCP servers with [Claude Code](https://claude.ai/code), add them to your `~/.claude.json` configuration:

```json
{
  "mcpServers": {
    "jira-mcp": {
      "type": "http",
      "url": "http://localhost:8000/mcp"
    },
    "confluence-mcp": {
      "type": "http",
      "url": "http://localhost:8001/mcp"
    },
    "confluence-vw-mcp": {
      "type": "http",
      "url": "http://localhost:8009/mcp"
    },
    "gitlab-mcp": {
      "type": "http",
      "url": "http://localhost:8003/mcp"
    }
  }
}
```

### Setup Steps

1. **Start the MCP servers** (via Docker or locally)
   ```bash
   cd mcporsche && docker-compose up -d jira-mcp confluence-mcp
   ```

2. **Add configuration** to `~/.claude.json`

3. **Connect in Claude Code** using the `/mcp` command to authenticate and establish the connection

4. **Verify** by asking Claude to list Jira projects or search Confluence

### Troubleshooting

- **Session drops (`No transport found for sessionId`)**: Ensure servers use `mcp.mount_http()` instead of `mcp.mount()` (see MR !25)
- **Connection refused**: Verify servers are running with `docker-compose ps`
- **Authentication errors**: Check PAT tokens in `.env` file

## 🔧 Common Requirements

Most MCP servers in this repository require:
- **Personal Access Tokens (PAT)** for Porsche systems
- **Python 3.8+** or **Node.js 18+** depending on implementation
- **Environment configuration** via `.env` files
- **Network access** to Porsche internal systems
- **Local execution** - all servers run on your machine for security

## 🤝 Contributing

Each MCP server has its own development workflow. Please refer to the individual README files for contribution guidelines and development setup instructions.