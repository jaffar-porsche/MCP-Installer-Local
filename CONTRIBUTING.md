# Contributing to mcporsche

## Repository structure

This is a monorepo with multiple independent MCP servers in different stacks:

| Directory | Stack | Description |
|---|---|---|
| `jira-mcp/` | Python (FastAPI) | Jira REST + Service Desk API |
| `confluence-mcp/` | Python (FastAPI) | Confluence REST API |
| `gitlab-mcp/` | Python (FastAPI) | GitLab REST API |
| `glossary-mcp/` | Python (FastAPI) | Carrera Online Glossar (CSV-based) |
| `porsche-design-system/` | Python (FastAPI) | Porsche Design System |
| `porsche-itsm-mcp/` | TypeScript (Node.js) | ITSM Hub — Incidents, Changes, Attachments |
| `mcp-at-scale/` | TypeScript | SDK + client-consent tooling |
| `atlassian/` | Docker / Shell | Atlassian proxy configuration |
| `cbbac-github/` | — | System prompts + test outputs |

## Clone & setup

```bash
git clone git@cicd.skyway.porsche.com:porsche/mcporsche.git ~/workspace/mcporsche
cd ~/workspace/mcporsche
cp .env.example .env
# Fill in JIRA_PAT, CONFLUENCE_PAT, GITLAB_TOKEN etc. in .env
```

## Development workflow

- All development happens on **GitLab** (cicd.skyway.porsche.com/porsche/mcporsche)
- Create a feature branch (`feat/your-feature`), open MR on GitLab
- GitLab CI runs tests automatically — tests must pass before merge
- Commit conventions: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Check existing MRs for the contribution pattern

## Python servers

Applies to: `jira-mcp/`, `confluence-mcp/`, `gitlab-mcp/`, `glossary-mcp/`, `porsche-design-system/`

Each is a standalone FastAPI app using `fastapi-mcp` to expose MCP endpoints.

```bash
cd jira-mcp                    # or any other Python server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
```

Same pattern for all Python servers — each has its own `requirements.txt` and test suite.

## TypeScript servers

Applies to: `porsche-itsm-mcp/`

Uses Node.js 18+, TypeScript, and Jest for testing.

```bash
cd porsche-itsm-mcp
npm install
npm run build                  # compile TypeScript
npm test                       # run Jest tests
npm run dev                    # dev mode with auto-reload (tsx)
```

The ITSM server uses Entra ID authentication (not PAT-based) — see `porsche-itsm-mcp/README.md` for required environment variables.

## Run locally (Docker)

```bash
docker compose up -d jira-mcp confluence-mcp gitlab-mcp glossary-mcp
```

Not all servers are in docker-compose — check individual READMEs for Docker instructions (e.g. `porsche-itsm-mcp` has its own Dockerfile).

## Good to know

- Python servers use `fastapi-mcp` (0.4.0) to expose MCP endpoints
- TypeScript servers use `@modelcontextprotocol/sdk`
- Bridge solution — enterprise Skyway MCP Server is being built ([DEVX-1057](https://skyway.porsche.com/jira/browse/DEVX-1057)), so focus on practical improvements, don't over-architect
