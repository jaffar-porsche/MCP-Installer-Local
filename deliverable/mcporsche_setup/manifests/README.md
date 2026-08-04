# MCPorsche server manifests

Each MCP server this deliverable manages is described by a single JSON manifest.
Adding a new MCP server is as simple as **dropping a manifest file** — no
Python code changes required.

## Where manifests live

| Location | Purpose |
|---|---|
| `deliverable/mcporsche_setup/manifests/*.json` | Built-in servers shipped with the deliverable. |
| `<repo-root>/<name>-mcp/mcporsche.json` | Repo-local override / addition. If both a built-in and a repo-local manifest have the same `key`, the repo-local one wins. |

The special file `_common.json` (leading underscore) is not a server manifest —
it defines reusable field groups (proxy, transport, …) that manifests can
include with `"include_common": [...]`.

## Manifest schema (v1)

```json
{
  "$schema": "manifest-v1",
  "key": "myserver",                             // required, unique identifier
  "display_name": "My MCP Server",               // required, shown in the UI
  "server_dir_name": "myserver-mcp",             // required, folder in repo root
  "default_port": 8010,                          // required
  "app_module": "mcp_server:app",                // required, ASGI app for uvicorn
  "health_path": "/health/pat",                  // required, PAT-status endpoint
  "myself_path": "/api/whoami",                  // required, upstream "me" endpoint
  "base_url_env": "MYSERVER_BASE_URL",           // required, env var carrying base URL
  "token_env": "MYSERVER_PAT",                   // required, env var carrying PAT
  "fields": [ … ],                               // required, at least one field
  "include_common": ["proxy", "advanced_transport"]  // optional
}
```

### Field schema

```json
{
  "key": "MYSERVER_PAT",         // env var name
  "label": "My PAT",             // shown next to the input
  "category": "Auth",            // Connection | Auth | Proxy | Advanced
  "default": null,               // optional string default written to .env
  "secret": true,                // optional, password-masked in the UI
  "required": true,              // optional, blocks Save when empty
  "help_text": "…",              // optional caption under the input
  "help_url": "https://…",       // optional, opens a "?"/"Get PAT" button
  "placeholder": "http://…",     // optional grey-text placeholder
  "validator": "url"             // optional; one of: url, port, pat_shape
}
```

`category` drives which UI section the field appears in. Order in the UI:
Connection → Auth → Proxy → Advanced.

### Built-in validators

| Name          | Purpose                                             |
|---------------|-----------------------------------------------------|
| `url`         | Must start with `http://` or `https://`.            |
| `port`        | Must be a number in `1..65535`.                     |
| `pat_shape`   | Basic sanity: no whitespace, minimum length.        |

Custom validators require a Python change (register in `schema._VALIDATORS`).
For most cases the three above are enough.

## Adding a new MCP server — checklist

1. Create the server folder next to the existing ones, e.g. `myserver-mcp/`.
2. Add its own `.env.example`, `requirements.txt`, `mcp_server.py`, etc.
3. Add a health route at `/health/pat` (copy the pattern from
   `jira-mcp/routes/health.py`) — this makes the traffic-light and
   PAT-expiry detection work automatically.
4. Add a `mcporsche.json` **either** inside the server folder or inside this
   manifests folder. Fill in the schema above.
5. Re-run `python -m mcporsche_setup configure` — the wizard picks it up
   with no code change.

## Overriding a built-in

Ship a `mcporsche.json` in the server folder with the same `key` as a built-in
manifest. The repo-local version wins. Handy for internal customisations
without forking the deliverable.
