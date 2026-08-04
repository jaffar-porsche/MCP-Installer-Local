# MCP Gateway

Production-oriented gateway starter for Jira, Confluence, and GitLab MCP access.

This project is designed for a model where users authenticate through SSO/OIDC once, then the gateway forwards requests to backend MCP services or upstream APIs with the right identity or fallback service token.

## Stack

- Node.js 20+
- TypeScript
- Fastify
- OIDC / SSO with PKCE
- HTTP reverse proxy per service
- Zod-based configuration validation
- Pino logging

## What it does

- Exposes login, callback, logout, health, and service routes
- Stores per-user sessions server-side
- Forwards `/jira`, `/confluence`, and `/gitlab` to configured upstream services
- Injects a per-user access token when available
- Falls back to a service token per upstream if configured

## Local setup

1. Copy `.env.example` to `.env`
2. Fill in the OIDC values and upstream URLs
3. Install dependencies
4. Start in dev mode:

```bash
npm install
npm run dev
```

## Production deployment

```bash
npm run build
npm start
```

Or build a container:

```bash
docker build -f mcp-gateway/Dockerfile -t mcp-gateway:latest .
```

## Environment variables

Required for SSO mode:

- `SESSION_SECRET`
- `OIDC_ISSUER_URL`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_REDIRECT_URI`

Required for proxying services:

- `JIRA_UPSTREAM_URL`
- `CONFLUENCE_UPSTREAM_URL`
- `GITLAB_UPSTREAM_URL`

Optional fallback tokens:

- `JIRA_SERVICE_TOKEN`
- `CONFLUENCE_SERVICE_TOKEN`
- `GITLAB_SERVICE_TOKEN`

## Notes

- This is a starter project, not a full replacement for the existing MCP servers.
- If you want true per-user permissions, the upstream services must accept delegated OAuth tokens.
- If the upstreams still require PATs, the gateway can still centralize access, but it will not preserve user-level permissions end to end.