import express from "express";
import cors from "cors";
import { config } from "./dcrProxyConfig.js";
import { mcpDcrProxyAuthRouter } from "../auth/router.js";
import { DemoInMemoryClientsStore } from "@modelcontextprotocol/sdk/examples/server/demoInMemoryOAuthProvider.js";
import { DemoInMemoryDcrProxyStore } from "./demoInMemoryDcrProxyStore.js";
import { entraOAuthMetadata } from "../auth/entra.js";
import { DcrProxyOAuthServerProvider } from "../auth/providers/dcrProxyProvider.js";
import { AesGcmTokenCipher } from "../auth/providers/tokenCipher.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const PORT = 3001;
const baseUrl = `http://localhost:${PORT}`;

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
    resourceServerPath: "/",
  }),
);

app.listen(PORT, () => {
  console.log(`OAuth2 proxy server running on ${baseUrl}`);
});
