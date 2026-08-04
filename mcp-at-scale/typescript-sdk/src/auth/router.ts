import {
  AuthRouterOptions,
  createOAuthMetadata,
  mcpAuthMetadataRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import express from "express";
import { Request } from "express";
import { DcrProxyOAuthServerProvider } from "./providers/dcrProxyProvider.js";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { callbackHandler } from "./handlers/callback.js";
import { consentHandler, TemplateParams } from "./handlers/consent.js";
import { CookieClientApprovalStore } from "./consent/consent.js";
import { requireConsentCookie } from "./middleware/consentCookie.js";

export type DcrProxyAuthRouterOptions = AuthRouterOptions & {
  provider: DcrProxyOAuthServerProvider;
  /**
   * The path the MCP server listens at.
   * For example, '/mcp'
   */
  resourceServerPath: string;

  /**
   * The path the DCR proxy router expects OAuth2 callbacks at.
   * If unset, defaults to '/callback'.
   */
  callbackPath?: string;

  /**
   * Consent template function to use for rendering the consent page.
   * If not provided, a default template will be used.
   */
  consentTemplate?: (params: TemplateParams) => string;

  /**
   * The path the DCR proxy router expects consent requests at.
   * If unset, defaults to '/consent'.
   */
  consentPath?: string;
};

const MCP_APPROVED_CLIENTS_COOKIE_NAME = "MCP_APPROVED_CLIENTS";
const MCP_DENIED_CLIENTS_COOKIE_NAME = "MCP_DENIED_CLIENTS";

export function mcpDcrProxyAuthRouter(options: DcrProxyAuthRouterOptions) {
  const oauthMetadata = createOAuthMetadata(options);

  const router = express.Router();

  const clientApprovalStoreFactory = (req: Request) =>
    new CookieClientApprovalStore(
      MCP_APPROVED_CLIENTS_COOKIE_NAME,
      MCP_DENIED_CLIENTS_COOKIE_NAME,
      req,
    );

  const consentPath = options.consentPath || "/consent";
  const authorizePath = new URL(oauthMetadata.authorization_endpoint).pathname;
  router.use(
    authorizePath,
    requireConsentCookie({
      clientApprovalStoreFactory,
      consentUrlOrPath: consentPath,
      clientsStore: options.provider.clientsStore,
      dcrStore: options.provider.store,
    }),
    authorizationHandler({
      provider: options.provider,
      ...options.authorizationOptions,
    }),
  );

  router.use(
    new URL(oauthMetadata.token_endpoint).pathname,
    tokenHandler({ provider: options.provider, ...options.tokenOptions }),
  );

  router.use(
    new URL(oauthMetadata.registration_endpoint!).pathname,
    clientRegistrationHandler({
      clientsStore: options.provider.clientsStore,
      ...options.clientRegistrationOptions,
    }),
  );

  router.use(
    consentPath,
    consentHandler({
      clientApprovalStoreFactory: clientApprovalStoreFactory,
      authorizePath: authorizePath,
      consentPath: consentPath,
      clientsStore: options.provider.clientsStore,
      consentTemplate: options.consentTemplate,
    }),
  );
  const callbackPath = options.callbackPath || "/callback";
  router.use(
    callbackPath,
    requireConsentCookie({
      clientApprovalStoreFactory,
      consentUrlOrPath: null,
      clientsStore: options.provider.clientsStore,
      dcrStore: options.provider.store,
    }),
    callbackHandler({ provider: options.provider }),
  );

  router.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: new URL(options.resourceServerPath, options.issuerUrl),
      serviceDocumentationUrl: options.serviceDocumentationUrl,
      scopesSupported: options.scopesSupported,
      resourceName: options.resourceName,
    }),
  );

  return router;
}
