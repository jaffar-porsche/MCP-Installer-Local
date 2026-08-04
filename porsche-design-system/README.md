# Porsche Design MCP Server

This is a Model Context Protocol (MCP) server that provides access to Porsche Design System components, templates, and documentation. The server has been updated to use the standard MCP HTTP transport protocol.

**To use an existing deployment of the server in VSCode with Github Copilot, add the following to `mcp.json`**

```json
"Porsche Design System MCP": {
		"url": "https://mcp-server-porsche-design-b6hyhzbhgpf2e4fq.germanywestcentral-01.azurewebsites.net/mcp",
		"type": "http",
		"headers": {
			"Authorization": "Bearer yiAlEJcnoWP5x1Nzj1UeYQ"
		}
	},
```

## Features

- **MCP HTTP Transport**: Standard JSON-RPC over HTTP
- **Component Access**: Browse and retrieve detailed information about Porsche Design components
- **Framework Support**: React and Angular examples and documentation
- **Template System**: Access to complete Angular template setups
- **Style System**: Access to design tokens and styling information

## MCP Tools Available

The server provides the following MCP tools:

1. **`angular_template`** - Get complete Angular project template with setup instructions
2. **`list_components`** - List all available Porsche Design components
3. **`get_component`** - Get detailed component information with framework-specific examples
4. **`introduction`** - Get the introduction guide
5. **`quickstart`** - Get framework-specific quickstart guides
6. **`list_styles`** - List all available design system styles
7. **`get_style`** - Get detailed style information with examples

## Local Development

1. Clone the repository and navigate to the project directory

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the server:
    ```bash
    python main.py
    ```