import type { FastifyInstance } from "fastify";

import proxy from "@fastify/http-proxy";

import type { AppConfig, ServiceDefinition } from "./config.js";
import type { SessionStore } from "./session-store.js";

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((accumulator, pair) => {
    const [rawName, ...rawValueParts] = pair.trim().split("=");
    if (!rawName) {
      return accumulator;
    }

    accumulator[decodeURIComponent(rawName)] = decodeURIComponent(rawValueParts.join("=") || "");
    return accumulator;
  }, {});
}

function getUpstreamToken(
  requestHeaders: Record<string, string | string[] | undefined>,
  service: ServiceDefinition,
  sessions: SessionStore,
): string | undefined {
  const cookies = parseCookieHeader(typeof requestHeaders.cookie === "string" ? requestHeaders.cookie : undefined);
  const sessionId = cookies.gateway_session;
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (session?.accessToken) {
    return session.accessToken;
  }

  return service.serviceToken || undefined;
}

export async function registerServiceProxy(
  app: FastifyInstance,
  config: AppConfig,
  service: ServiceDefinition,
  sessions: SessionStore,
): Promise<void> {
  await app.register(proxy, {
    upstream: service.upstreamUrl,
    prefix: `/${service.name}`,
    rewritePrefix: "",
    replyOptions: {
      rewriteRequestHeaders(originalReq, headers) {
        const token = getUpstreamToken(originalReq.headers, service, sessions);
        const rewritten = { ...headers };

        if (token) {
          rewritten.authorization = `Bearer ${token}`;
        }

        rewritten["x-gateway-service"] = service.name;
        rewritten["x-gateway-mode"] = config.auth.enabled ? "user-session" : "service-token";
        return rewritten;
      },
    },
  });
}