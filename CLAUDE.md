# MCPorsche - Claude Code Instructions

## Minimum Quality Standards for Feature Branches

Every feature branch must meet the following before being considered merge-ready:

1. **Test cases** - All new endpoints/functionality must have corresponding unit tests. Tests must pass (`pytest`).
2. **Updated README** - The relevant sub-project README must document new endpoints with examples.
3. **Updated API contracts** - `API_CONTRACTS.md` must include the new endpoints in both the summary table and detailed sections.
4. **Local run verified** - The server must start and respond locally before pushing.
5. **Linted** - Code must be linted (install `ruff` or `flake8` if not present). No lint errors allowed.

## Project Structure

- Monorepo with multiple MCP servers: `jira-mcp/`, `confluence-mcp/`, `gitlab-mcp/`, `glossary-mcp/`, `porsche-itsm-mcp/`
- Shared infra: `mcp-at-scale/`, `docker/`, `docker-compose.yml`
- Each sub-project has its own `README.md`, `routes/`, `tests/`

## Conventions

- Python MCP servers use FastAPI with route modules under `routes/`
- Tests use pytest with `unittest.mock` for mocking HTTP calls
- Route files follow the pattern: Pydantic models at top, logger + router, then endpoint functions
- Error handling: catch `HTTPException` and re-raise, catch generic `Exception` and wrap in 500
- Use `http_session` from `client.py` for raw Jira REST API calls
