# 🚗 Porsche ITSM MCP Server

A **Model Context Protocol (MCP) Server** that exposes the Porsche ITSM Hub API through standardized MCP tools, enabling AI assistants to seamlessly interact with Porsche's IT Service Management system.

## 📋 Overview

This MCP server provides a bridge between AI assistants (like Claude Desktop and Cline) and the **Porsche ITSM Hub API** served by the Developer Hub. The server exposes ITSM management capabilities as MCP tools, allowing AI assistants to:

- Create new incidents in the ITSM system
- Retrieve and filter existing incidents
- Get detailed information about specific incidents
- Update incident status and properties
- Create and manage change requests
- Retrieve change tasks and work logs
- Download attachments from incidents, changes, and worklogs

The server handles authentication via Entra ID and manages the communication with the Porsche Developer Hub APIs, abstracting the complexity of direct API integration.

> **⚠️ Important**: This implementation is currently based on the **Test Stage** of the ITSM Hub. API behavior, endpoints, and data structures may differ in other stages like Production.

## 🛠️ Available Tools

The MCP server exposes the following tools for ITSM management:

## Incident Management

### `create_incident`
Creates a new incident in the ITSM system.

**Description**: Submits a new incident with required and optional metadata to the ITSM Hub.

**Example Payload**:
```json
{
    "title": "Test Incident",
    "details": "Test Incident",
    "impactLevel": 4,
    "urgencyLevel": 3,
    "assignedGroup": "NewRelic",
    "assignedSupportCompany": "Porsche",
    "assignedSupportOrganization": "Platform",
    "upn": "your-upn"
}
```

### `get_incidents`
Retrieves a list of incidents with optional filtering.

**Description**: Fetches incidents from the ITSM system, optionally filtered by criteria like assigned group or status.

**Example Payload**:
```json
{
  "assignedGroup": "Platform Team",
  "status": "In Progress"
}
```

### `get_incident`
Retrieves detailed information about a specific incident.

**Description**: Fetches complete details for a single incident using its Request ID or Incident Number.

**Example Payload**:
```json
{
  "id": "INC0012345"
}
```

### `update_incident`
Updates properties of an existing incident.

**Description**: Modifies incident fields such as status, assignment, or other metadata.

**Example Payload**:
```json
{
  "id": "INC0012345",
  "status": "Resolved",
  "details": "Issue resolved by restarting email service"
}
```

## Change Management

### `create_change`
Creates a new change request in the ITSM system.

**Description**: Submits a new change request with all required metadata to the ITSM Hub.

**Example Payload**:
```json
{
  "upn": "your-upn",
  "changeDescription": "This is a description.",
  "changeType": "Change",
  "scheduledTiming": "Normal",
  "impactLevel": 3,
  "urgencyLevel": 4,
  "companyName": "Porsche",
  "locationName": "Porsche",
  "supportGroupName": "NewRelic",
  "supportOrgName": "Platform",
  "templateId": "IDGHEMZZHLT0DASVX8MZSVX8MZU3VD"
}
```

### `get_change`
Retrieves detailed information about a specific change request.

**Description**: Fetches complete details for a single change request using its Infrastructure Change ID.

**Example Payload**:
```json
{
  "id": "CRQ0012345"
}
```

### `get_change_tasks`
Retrieves tasks associated with a change request.

**Description**: Fetches all tasks linked to a specific change request for tracking progress.

**Example Payload**:
```json
{
  "id": "CRQ0012345"
}
```

### `get_change_worklogs`
Retrieves work logs and comments for a change request.

**Description**: Fetches work logs and comments for a change request, with optional filtering by work info type and view access.

**Example Payload**:
```json
{
  "id": "CRQ0012345",
  "workInfoType": "General Information",
  "viewAccess": "Public"
}
```

## Attachment Management

### `get_attachment`
Downloads an attachment from ITSM (BMC Helix or SmartIT) using its URL.

**Description**: Downloads attachment files referenced in incidents, changes, or worklogs and returns them as Base64-encoded strings for easy transmission. Includes metadata like file size, filename, and transaction ID.

**Example Payload**:
```json
{
  "url": "https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/TMS:WorkInfo/000000000001234/attach/report.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "base64": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL...",
    "filename": "report.pdf",
    "size": 245678,
    "sizeFormatted": "239.92 KB",
    "transactionId": "abc123",
    "sourceUrl": "https://helix-preprod-restapi.itsm.porsche.services/..."
  }
}
```

**Common Use Cases**:
- Download incident attachments (screenshots, logs, documents)
- Download change request documentation
- Retrieve worklog attachments
- Access files referenced in ITSM tickets

**Important Notes**:
- Attachment URLs are typically obtained from other ITSM endpoints (incidents, changes, worklogs)
- The tool handles URL encoding automatically
- Files are returned as Base64 for safe JSON transmission
- Maximum file size depends on API limits

### `get_attachment_raw`
Downloads an attachment and returns raw byte array instead of Base64.

**Description**: Alternative to `get_attachment` that returns file contents as an array of integers (0-255) instead of Base64. Useful when you need the raw bytes for processing.

**Example Payload**:
```json
{
  "url": "https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/HPD:IncidentInterface/INC000000012345/attach/screenshot.png"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "bytes": [37, 80, 68, 70, 45, 49, 46, 52, 10, ...],
    "filename": "screenshot.png",
    "size": 152340,
    "sizeFormatted": "148.77 KB",
    "transactionId": "xyz789",
    "sourceUrl": "https://helix-preprod-restapi.itsm.porsche.services/..."
  }
}
```

## 🔧 Environment Variables

The server requires several environment variables for authentication and API access:

### Required Variables

| Variable | Description | How to Obtain |
|----------|-------------|---------------|
| `ENTRA_CLIENT_ID` | Azure AD application client ID | Follow [API Authentication Guide](https://developerhub.porsche.io/docs/guides/consumer/call-the-api) |
| `ENTRA_CLIENT_SECRET` | Azure AD application client secret | Follow [API Authentication Guide](https://developerhub.porsche.io/docs/guides/consumer/call-the-api) |
| `API_BASE_URL` | ITSM Hub API base URL | Found in [ITSM Hub API Product](https://developerhub.porsche.io/products/itsm-hub/1.1.24/api/itsm-hub-incident-api/1.0.17) |
| `ITSM_USER` | ITSM system username | Contact: eric.fritzsche1@porsche.de |
| `ITSM_PASSWORD` | ITSM system password | Contact: eric.fritzsche1@porsche.de |

### Environment File Example

Create a `.env` file in the project root:

```bash
# Entra ID Authentication
ENTRA_CLIENT_ID=your-id-here
ENTRA_CLIENT_SECRET=your-secret-here

# Porsche API Configuration (test stage)
API_BASE_URL=https://eu-1.test.api.porsche.io/porsche-group/test

# ITSM Credentials
ITSM_USER=your-itsm-username
ITSM_PASSWORD=your-itsm-password
```

## 🚀 Starting the MCP Server

### Node.js

#### Prerequisites
- Node.js 18 or higher
- npm or yarn

#### Installation and Startup
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm run start:stdio
```

#### Development Mode
```bash
# Start in development mode with auto-reload
npm run dev
```

### Docker

#### Build the Image
```bash
# Build the Docker image
docker build -t porsche-itsm-mcp .
```

#### Run with Environment File
```bash
# Run with .env file
docker run -i --rm --env-file .env porsche-itsm-mcp
```

#### Run with Inline Variables
```bash
# Run with environment variables
docker run -i --rm \
  -e ENTRA_CLIENT_ID=your-client-id \
  -e ENTRA_CLIENT_SECRET=your-secret \
  -e PAPI_CLIENT_ID=your-papi-id \
  -e API_BASE_URL=https://eu-1.test.api.porsche.io/porsche-group/test \
  -e ITSM_USER=your-username \
  -e ITSM_PASSWORD=your-password \
  porsche-itsm-mcp
```

## 🔌 AI Assistant Integration

### Claude Desktop & Cline

Both Claude Desktop and Cline use the same MCP configuration format. The only difference is that Cline requires the `transport` property to be explicitly set to `"stdio"`.

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "porsche-itsm": {
      "command": "node",
      "args": ["/path/to/porsche-itsm-mcp/dist/server.js"],
      "env": {
        "ENTRA_CLIENT_ID": "your-client-id",
        "ENTRA_CLIENT_SECRET": "your-secret",
        "API_BASE_URL": "https://eu-1.test.api.porsche.io/porsche-group/test",
        "ITSM_USER": "your-username",
        "ITSM_PASSWORD": "your-password"
      }
    }
  }
}
```

```json
{
  "mcpServers": {
    "porsche-itsm-docker": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "ENTRA_CLIENT_ID=your-client-id",
        "-e", "ENTRA_CLIENT_SECRET=your-secret",
        "-e", "API_BASE_URL=https://eu-1.test.api.porsche.io/porsche-group/test",
        "-e", "ITSM_USER=your-username",
        "-e", "ITSM_PASSWORD=your-password",
        "porsche-itsm-mcp"
      ]
    }
  }
}
```

**Cline** (MCP settings):
```json
{
  "mcpServers": {
    "porsche-itsm": {
      "command": "node",
      "args": ["/path/to/porsche-itsm-mcp/dist/server.js"],
      "env": {
        "ENTRA_CLIENT_ID": "your-client-id",
        "ENTRA_CLIENT_SECRET": "your-secret",
        "API_BASE_URL": "https://eu-1.test.api.porsche.io/porsche-group/test",
        "ITSM_USER": "your-username",
        "ITSM_PASSWORD": "your-password"
      },
      "transport": "stdio"
    }
  }
}
```

```json
{
  "mcpServers": {
    "porsche-itsm-docker": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "ENTRA_CLIENT_ID=your-client-id",
        "-e", "ENTRA_CLIENT_SECRET=your-secret",
        "-e", "API_BASE_URL=https://eu-1.test.api.porsche.io/porsche-group/test",
        "-e", "ITSM_USER=your-username",
        "-e", "ITSM_PASSWORD=your-password",
        "porsche-itsm-mcp"
      ],
      "transport": "stdio"
    }
  }
}
```

## 📁 Project Structure

```
porsche-itsm-mcp/
├── src/                              # Source code
│   ├── server.ts                     # MCP server entry point
│   ├── config/                       # Configuration management
│   │   ├── env.ts                    # Environment variable handling
│   │   ├── config.ts                 # Configuration parsing & validation
│   │   └── index.ts                  # Configuration exports
│   ├── clients/                      # API clients
│   │   └── DeveloperHubClient.ts     # Porsche Developer Hub API client
│   ├── api/                          # API implementations
│   │   ├── filter.types.ts           # Filter expression types
│   │   ├── pagination.types.ts       # Pagination utilities
│   │   ├── sort.types.ts             # Sort field definitions
│   │   ├── index.ts                  # Central API exports
│   │   ├── incident/                 # Incident management
│   │   │   ├── incident.service.ts   # ITSM Hub API integration
│   │   │   ├── incident.tools.ts     # MCP tool definitions
│   │   │   ├── incident.types.ts     # TypeScript type definitions
│   │   │   └── incident.test.ts      # Incident functionality tests
│   │   ├── change/                   # Change management
│   │   │   ├── change.service.ts     # Change API integration
│   │   │   ├── change.tools.ts       # MCP tool definitions
│   │   │   ├── change.types.ts       # TypeScript type definitions
│   │   │   └── change.test.ts        # Change functionality tests
│   │   └── attachment/               # Attachment management
│   │       ├── attachment.service.ts # Attachment API integration
│   │       ├── attachment.tools.ts   # MCP tool definitions
│   │       ├── attachment.types.ts   # TypeScript type definitions
│   │       └── README.md             # Attachment API documentation
│   └── tools/                        # Tool management
│       └── index.ts                  # Tool registry and dispatcher
├── test/                             # Test suite
│   ├── incident.test.ts              # Incident functionality tests
│   ├── change.test.ts                # Change functionality tests
│   ├── auth.test.ts                  # Authentication tests
│   ├── test.env.example              # Test environment template
│   └── test.env                      # Test environment variables
├── dist/                             # Compiled JavaScript (generated)
├── .env.example                      # Environment variables template
├── .env                              # Environment variables (create this)
├── Dockerfile                        # Docker container configuration
├── package.json                      # Node.js dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # This documentation
```

### Key Components

- **`src/server.ts`**: Main MCP server implementation handling protocol communication
- **`src/clients/DeveloperHubClient.ts`**: HTTP client with Entra ID authentication and token management
- **`src/api/incident/`**: Complete incident management implementation including service layer and MCP tool definitions
- **`src/api/change/`**: Complete change management implementation including service layer and MCP tool definitions
- **`src/api/attachment/`**: Attachment download implementation with multiple output formats (Base64, Buffer, raw bytes)
- **`src/config/`**: Environment variable loading, validation, and configuration management
- **`test/`**: Comprehensive test suite with isolated test environment

## 🧪 Testing

The project includes a comprehensive test suite covering authentication, API integration, and tool functionality.

### Test Categories

#### Authentication Tests (`auth.test.ts`)
- **Purpose**: Validates Entra ID token acquisition and management
- **Coverage**: Real authentication against Azure AD using actual credentials
- **Validates**: Token format, expiration, and API compatibility

#### Incident Tests (`incident.test.ts`)
- **Purpose**: Tests incident management functionality
- **Coverage**: CRUD operations, tool integration, error handling
- **Components**:
  - `IncidentService` tests: API interaction layer
  - `IncidentTools` tests: MCP tool wrapper functionality
  - Mock-based testing for isolated unit tests

#### Change Tests (`change.test.ts`)
- **Purpose**: Tests change management functionality
- **Coverage**: Change request operations, task retrieval, work log management
- **Components**:
  - `ChangeService` tests: API interaction layer
  - `ChangeTools` tests: MCP tool wrapper functionality
  - Mock-based testing for isolated unit tests

### Test Environment

Tests use an isolated environment configuration in `test/test.env` to ensure consistent, predictable results:

```bash
# Test environment (automatically loaded by Jest)
ENTRA_CLIENT_ID=test-client-id
ENTRA_CLIENT_SECRET=test-client-secret
PAPI_CLIENT_ID=test-papi-id
API_BASE_URL=https://test-api.example.com
ITSM_USER=test-user
ITSM_PASSWORD=test-password
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test test/incident.test.ts

# Run change tests only
npm test test/change.test.ts

# Run authentication tests only
npm test test/auth.test.ts
```

### Test Output

Successful test run shows:
```
Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        1.8s
```

The test suite validates both mock-based unit tests and real API integration, ensuring the server works correctly in both development and production environments.

---

**Built with ❤️ for Porsche AG** 🚗
