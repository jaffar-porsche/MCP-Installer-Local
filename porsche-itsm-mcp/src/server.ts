#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createConfig } from './config/index.js';
import { DeveloperHubClient } from './clients/DeveloperHubClient.js';
import { createAllTools, handleToolCall } from './tools/index.js';

async function main() {
  try {
    // Load configuration
    const config = createConfig();
    console.error('✅ Configuration loaded successfully');

    // Initialize Developer Hub client
    const client = new DeveloperHubClient(config);
    console.error('✅ Developer Hub client initialized');

    // Create MCP server
    const server = new Server(
      {
        name: 'porsche-itsm-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register tools
    const tools = createAllTools();
    console.error(`✅ Registered ${tools.length} tools`);

    // Handle list tools request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: tools,
      };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const result = await handleToolCall(
          request.params.name,
          request.params.arguments || {},
          client
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 Porsche ITSM HUB MCP Server running on stdio');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.error('🛑 Shutting down Porsche ITSM HUB MCP Server');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('🛑 Shutting down Porsche ITSM HUB MCP Server');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
