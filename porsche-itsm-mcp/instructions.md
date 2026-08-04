As a software engineer, your task is to create a fully functional and extendable **MCP Server** in **TypeScript**, using the **official Model Context Protocol SDK**: https://github.com/modelcontextprotocol/typescript-sdk (latest version). The server should expose **Porsche Developer Hub** APIs in an MCP-compatible format.

🧩 Architectural Requirements:

1. **Project Structure**
    - Follow a modular and scalable folder structure:
        ```
        ├── src/
        │   ├── server.ts                     # Entry point to start MCP server (stdio)
        │   ├── config/
        │   │   ├── env.ts                    # Loads environment variables from .env
        │   │   └── config.ts                 # Parses env + sets tenant ID and scope
        │   ├── clients/
        │   │   └── DeveloperHubClient.ts     # Auth/token handling via EntraID for Porsche Dev Hub
        │   ├── api/
        │   │   └── incident/
        │   │       ├── incident.service.ts   # Calls DeveloperHubClient to implement incident API
        │   │       ├── incident.tools.ts     # Wraps incident service as MCP tool(s)
        │   │       └── incident.types.ts     # Incident-related types (from Porsche API spec)
        │   └── tools/
        │       └── index.ts                  # Collects all tool wrappers for server use
        ├── test/
        │   ├── incident.test.ts              # Jest tests for incident service + tools
        │   ├── auth.test.ts                  # Jest tests for EntraID auth
        │   └── test.env                      # Sample environment variables for testing
        ├── .env                              # Main environment variables
        ├── Dockerfile.stdio                  # Docker config for stdio transport
        └── README.md                         # Documentation (see below)
        ```

2. **Environment Variables (.env)**
    Define the following:
    ```
    ENTRA_CLIENT_ID=
    ENTRA_CLIENT_SECRET=
    API_BASE_URL=
    ```

3. **Config Logic (config.ts)**
    - Hardcode the **Porsche tenant UUID** (e.g., `"123e4567-e89b-12d3-a456-426614174000"`)
    - Calculate the **scope** dynamically using:
        ```
        scope = `api://${ENTRA_CLIENT_ID}/.default`
        ```

4. **DeveloperHubClient.ts**
    - Handles Entra ID token exchange using client credentials
    - Uses `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, and calculated `scope`
    - Adds token to headers for outbound API calls

5. **Incident API Integration**
    - Implement API endpoints devlivered by API specification
    - Use `incident.service.ts` to call Developer Hub via `DeveloperHubClient`
    - Wrap in MCP tools using `incident.tools.ts`
    - Types should be defined LLM friendly

6. **MCP Server (server.ts)**
    - Load and register tools
    - Support stdio transport

7. **Docker Support**
    - `Dockerfile`: Run MCP server with stdio transport

8. **Testing with Jest**
    - Add test config in `test/test.env`. Values should be added later manually
    - Test:
        - Entra auth
        - Incident service and tool behavior
    - Use `jest --watch` or similar setup for continuous feedback

9. **Documentation (README.md)**
    Must include:
    - 💡 Overview of the MCP Server
    - ⚙️ Environment Setup with Explanation of Each Variable
    - 🛠️ Usage:
        - Start with `npm run start:stdio`
    - 🔌 Integration with Cline and Claude
    - 🧩 Tools and Capabilities (e.g., incident management)
    - 🧱 Project Structure
    - 🧪 Testing Guide
    - 🐳 Docker Instructions

🎯 Final Deliverable:
- A runnable, environment-driven **MCP Server**
- Exposes Porsche Developer Hub APIs
- Usable directly in **Cline and Claude Desktop**
- Extensible with new APIs and tools
