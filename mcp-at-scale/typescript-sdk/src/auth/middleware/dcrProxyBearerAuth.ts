import {
  BearerAuthMiddlewareOptions,
  requireBearerAuth,
} from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { RequestHandler } from "express";
import { DcrProxySessionIdTranslator } from "../providers/dcrProxyProvider.js";

export type DcrProxyBearerAuthMiddlewareOptions =
  BearerAuthMiddlewareOptions & {
    sessionIdTranslator: DcrProxySessionIdTranslator;
  };

export function requireDcrProxyBearerAuth({
  verifier,
  requiredScopes = [],
  resourceMetadataUrl,
  sessionIdTranslator,
}: DcrProxyBearerAuthMiddlewareOptions): RequestHandler {
  return requireBearerAuth({
    requiredScopes,
    resourceMetadataUrl,
    verifier: {
      verifyAccessToken: async (sessionId: string) => {
        const token = await sessionIdTranslator.translateSessionId(sessionId);
        return verifier.verifyAccessToken(token.access_token);
      },
    },
  });
}
