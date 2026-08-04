# GitLab MCP Server

Easily connect to GitLab via MCP using a Personal Access Token (PAT).

## Getting Started

1. [Create a PAT](https://cicd.skyway.porsche.com/-/user_settings/personal_access_tokens) with the scope "api"
2. Copy your PAT to a `.env` file (see `.env.example` for guidance)
3. Configure additional settings if needed:
   - Set `GITLAB_BASE_URL` if using a different GitLab instance (default: https://cicd.skyway.porsche.com)
   - Set proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`) if behind a corporate firewall
   - Set `MCP_PORT` to configure the server port (default is 8003)
   - Set `MCP_TRANSPORT` to `http` (default) or `stdio` to select the MCP transport protocol

### Option 1: Docker

Run the GitLab MCP server using Docker:

```
# From the gitlab-mcp directory
docker-compose up -d

# Or from the parent mcporsche directory to run all MCP servers
cd ..
docker-compose up -d gitlab-mcp
```

The server will be available at:
```
http://localhost:8003/mcp/
```

To stop the server:
```bash
docker-compose down
```

### Option 2: Local Installation

Start the server:
```
# Linux/Mac
./start-mcp.sh

# Windows
start-mcp.bat
```

Configure your MCP Client to use the server URL:
```
http://localhost:<MCP_PORT>/mcp/
```
i.e.
```
http://localhost:8003/mcp/
```

## Available Operations

The MCP server provides comprehensive GitLab integration with **23 tools** across 5 main categories:

### 🚀 Project Management
- List, create, update, and manage GitLab projects
- Search projects by name, description, or visibility
- Manage project members and access levels
- Fork, star, and archive projects

### 🐛 Issue Tracking
- Create, update, close, and reopen issues
- Add comments and manage discussions
- Assign users and manage labels/milestones
- Search issues across projects

### 🔀 Merge Request Workflow
- Create and manage merge requests
- Review, approve, and merge changes
- View diffs and commit history
- Manage merge request discussions

### 🔄 CI/CD Pipeline Management
- List, create, and trigger pipelines
- Monitor job status and retrieve logs
- Manage pipeline schedules
- Download job artifacts

### 📁 Repository Operations
- Browse repository files and directories
- Create, update, and delete files
- Manage branches and tags
- View commit history and diffs
- Compare branches and get blame information

## Environment Variables

Create a `.env` file with the following variables:

### Required
```
GITLAB_TOKEN=your_gitlab_personal_access_token_here
```

### Optional
```
# GitLab base URL (default: https://cicd.skyway.porsche.com)
GITLAB_BASE_URL=https://cicd.skyway.porsche.com

# Proxy settings (only if needed)
HTTP_PROXY=http://http-proxy.porsche.org:3128
HTTPS_PROXY=http://http-proxy.porsche.org:3133

# Server port (default: 8003)
MCP_PORT=8003

# MCP transport mode: http (default) or stdio
MCP_TRANSPORT=http
```

### Example .env file
```
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_BASE_URL=https://cicd.skyway.porsche.com
HTTP_PROXY=http://http-proxy.porsche.org:3128
HTTPS_PROXY=http://http-proxy.porsche.org:3133
MCP_PORT=8003
MCP_TRANSPORT=http
```

**Note:** The proxy settings are only required if you're behind a corporate firewall. If no proxy environment variables are set, the server will connect directly to GitLab.

## Usage Examples

### Creating a New Project
```
Create a new GitLab project called "my-awesome-app" with description "A modern web application" and public visibility.
```

### Managing Issues
```
Create an issue titled "Fix login bug" in project "group/my-app" with description "Users can't login with special characters in password" and assign it to user ID 123.
```

### Working with Merge Requests
```
Create a merge request from branch "feature/new-ui" to "main" in project "group/my-app" with title "Add new user interface".
```

### CI/CD Pipeline Operations
```
Trigger a new pipeline for the "main" branch in project "group/my-app" and then check its status.
```

### Repository File Operations
```
Get the content of the README.md file in project "group/my-app" and then create a new file called "CHANGELOG.md" with initial content.
```

## Limitations
- Functionality unknown with GlobalProtect activated

> Feel free to provide feedback if you encounter any issues!