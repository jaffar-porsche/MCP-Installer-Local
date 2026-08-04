import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express, { Request, Response } from "express";
import { getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { Client } from "@microsoft/microsoft-graph-client";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import cors from "cors";
import { mcpDcrProxyAuthRouter } from "../auth/router.js";
import { DcrProxyOAuthServerProvider } from "../auth/providers/dcrProxyProvider.js";
import { DemoInMemoryClientsStore } from "@modelcontextprotocol/sdk/examples/server/demoInMemoryOAuthProvider.js";
import { entraOAuthMetadata } from "../auth/entra.js";
import { config } from "./dcrProxyConfig.js";
import { requireDcrProxyBearerAuth } from "../auth/middleware/dcrProxyBearerAuth.js";
import { DemoInMemoryDcrProxyStore } from "./demoInMemoryDcrProxyStore.js";
import { AesGcmTokenCipher } from "../auth/providers/tokenCipher.js";

const getServer = () => {
  const server = new McpServer({
    name: "WhoAmI",
    version: "0.0.0",
  });

  const getClient = (authInfo: AuthInfo | undefined) => {
    return Client.init({
      authProvider: (done) => {
        if (authInfo?.token) {
          done(null, authInfo.token);
        } else {
          done(new Error("No access token available"), null);
        }
      },
    });
  };

  server.tool(
    "me",
    "Get information about the current user",
    async ({ authInfo }) => {
      const client = getClient(authInfo);
      const me = await client.api("/me").get();
      return {
        content: [{ type: "text", text: JSON.stringify(me) }],
      };
    },
  );

  return server;
};

const MCP_PORT = 3000;
const baseUrl = `http://localhost:${MCP_PORT}`;

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
  }),
);

const dcrProxyOAuthServerProvider = new DcrProxyOAuthServerProvider({
  endpoints: {
    callbackUrl: `${baseUrl}/callback`,
  },
  clientsStore: new DemoInMemoryClientsStore(),
  store: new DemoInMemoryDcrProxyStore(),
  scopes: ["openid", "profile", "email"],
  oauthMetadata: entraOAuthMetadata({ tenantId: config.entraTenantId }),
  clientId: config.entraClientId,
  clientSecret: config.entraClientSecret,
  tokenCipher: new AesGcmTokenCipher(config.sessionIdKey),
});

app.use(
  mcpDcrProxyAuthRouter({
    issuerUrl: new URL(baseUrl),
    provider: dcrProxyOAuthServerProvider,
    resourceServerPath: "/mcp",
  }),
);

const PayloadSchema = z.object({
  appid: z.string(),
  scp: z.string().transform((val) => val.split(" ")),
  exp: z.number(),
});

const tokenVerifier = {
  verifyAccessToken: async (token: string) => {
    try {
      const decoded = jwt.decode(token, { complete: true });
      const payload = PayloadSchema.parse(decoded!.payload);
      return {
        token,
        clientId: payload.appid,
        scopes: payload.scp,
        expiresAt: payload.exp,
      };
    } catch (error) {
      console.error("Error decoding token:", error);
      throw new Error(`Invalid or expired token: ${error}`);
    }
  },
};

const authMiddleware = requireDcrProxyBearerAuth({
  verifier: tokenVerifier,
  requiredScopes: [],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(
    new URL(`http://localhost:${MCP_PORT}`),
  ),
  sessionIdTranslator: dcrProxyOAuthServerProvider,
});

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// MCP POST endpoint with optional auth
const mcpPostHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  try {
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore, // Enable resumability
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(
            `Transport closed for session ${sid}, removing from transports map`,
          );
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server BEFORE handling the request
      // so responses can flow back through the same transport
      const server = getServer();
      await server.connect(transport);

      await transport.handleRequest(req, res, req.body);
      return; // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    // Handle the request with existing transport - no need to reconnect
    // The existing transport is already connected to the server
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
};

app.post("/mcp", authMiddleware, mcpPostHandler);

// Handle DELETE requests for session termination (according to MCP spec)
const mcpDeleteHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  console.log(`Received session termination request for session ${sessionId}`);

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
};

app.delete("/mcp", authMiddleware, mcpDeleteHandler);

app.listen(MCP_PORT, () => {
  console.log(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  console.log("Server shutdown complete");
  process.exit(0);
});
