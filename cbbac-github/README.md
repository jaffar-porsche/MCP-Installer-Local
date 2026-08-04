# Cloud Building Block as Code access via GitHub MCP Server

This project uses the [github](https://github.com/github/github-mcp-server) integration to provide an MCP server for GitHub.

## People 

- Mario Schwartz
- Matthias Helmenstein

## Approach
We wanted to make the CBBaC modules and CBBaD available and chose the native github mcp server. 
Therefore we mirrored some CBBaC repos, a few AaC repos and one Repo for CBBaD with Markdown files to GitHub.

Since the github MCP server only provides general endpoint descriptions we have to explain our structure and things like "how to find the correct module" in a systemprompt. 

We developed (by letting the LLM explore the github repo structure by itself and reflecting on it) two large system prompts.
1. [Just CBBaC context](./system_prompts/cbbac-architecture-workflow.md) -> putting differen CBBaC together into one architecture
2. [CBBaC + AaC context](./system_prompts/aac-architecture-workflow.md) -> adding guidance how to access AaC repository + general concept to support the development of full AaCs.

## Known Problems

Only running locally at the moment. CBBaC Repositories on GitHub set to Private -> not available for others at porsche currently.

## 🛠️ Configuration Example

Currently the GitHub repositories for the CBBaC are Private. That means that you are not able to create an access token by yourself to access them.
However, this is how the configuration for the MCP server looks like (we also added the awslabs.terraform-mcp-server for more context):

```json
"mcp": {
        "servers": {
            "github": {
                "command": "docker",
                "args": [
                    "run",
                    "-i",
                    "--rm",
                    "-e",
                    "GITHUB_PERSONAL_ACCESS_TOKEN",
                    "ghcr.io/github/github-mcp-server"
                ],
                "env": {
                    "GITHUB_PERSONAL_ACCESS_TOKEN": "${gitHub_access_token}"
                }
            },
            "awslabs.terraform-mcp-server": {
                "command": "uvx",
                "args": [
                    "awslabs.terraform-mcp-server@latest"
                ],
                "env": {
                    "FASTMCP_LOG_LEVEL": "ERROR"
                },
            }
        },
        "inputs": [
            {
                "id": "github_token",
                "type": "promptString",
                "description": "GitHub Personal Access Token",
                "password": true
            }
        ]
    }
```