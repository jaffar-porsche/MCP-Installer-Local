import { randomUUID } from "node:crypto";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastify, { type FastifyInstance } from "fastify";

import { buildAuthorizationUrl, createPkcePair, exchangeCodeForTokens } from "./auth.js";
import { loadConfig, type AppConfig } from "./config.js";
import { registerServiceProxy } from "./proxy.js";
import { createInMemorySessionStore } from "./session-store.js";

export function createGateway(config: AppConfig = loadConfig()): FastifyInstance {
  const app = fastify({
    logger: {
      level: config.logLevel,
    },
  });

  const sessions = createInMemorySessionStore();

  app.register(helmet, { global: true });
  app.register(cors, { origin: true, credentials: true });
  app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
  });
  app.register(cookie, {
    secret: config.sessionSecret,
    hook: "onRequest",
  });

  app.get("/", async () => ({
    service: "mcp-gateway",
    authEnabled: config.auth.enabled,
    services: config.services.map((service) => ({
      name: service.name,
      upstreamUrl: service.upstreamUrl,
    })),
  }));

  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => ({
    status: "ready",
    authEnabled: config.auth.enabled,
    serviceCount: config.services.length,
  }));

  app.get("/auth/login", async (_request, reply) => {
    if (!config.auth.enabled) {
      return reply.code(503).send({ error: "OIDC is not configured" });
    }

    const state = randomUUID();
    const pkce = createPkcePair();
    const authorizationUrl = await buildAuthorizationUrl(config, state, pkce);

    reply.setCookie("gateway_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/",
      maxAge: 600,
    });
    reply.setCookie("gateway_pkce_verifier", pkce.verifier, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/",
      maxAge: 600,
    });

    return reply.redirect(authorizationUrl);
  });

  app.get("/auth/callback", async (request, reply) => {
    if (!config.auth.enabled) {
      return reply.code(503).send({ error: "OIDC is not configured" });
    }

    const query = request.query as { code?: string; state?: string; error?: string; error_description?: string };

    if (query.error) {
      return reply.code(400).send({ error: query.error, error_description: query.error_description });
    }

    const stateCookie = request.cookies.gateway_oauth_state;
    const verifier = request.cookies.gateway_pkce_verifier;

    if (!query.code || !query.state || !stateCookie || !verifier || query.state !== stateCookie) {
      return reply.code(400).send({ error: "Invalid OAuth callback state" });
    }

    const tokens = await exchangeCodeForTokens(config, query.code, verifier);
    const session = sessions.create(tokens);

    reply.clearCookie("gateway_oauth_state", { path: "/" });
    reply.clearCookie("gateway_pkce_verifier", { path: "/" });
    reply.setCookie("gateway_session", session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return reply.send({
      status: "authenticated",
      user: session.user,
      expiresAt: session.expiresAt,
    });
  });

  app.get("/auth/me", async (request, reply) => {
    const sessionId = request.cookies.gateway_session;
    if (!sessionId) {
      return reply.code(401).send({ authenticated: false });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return reply.code(401).send({ authenticated: false });
    }

    return {
      authenticated: true,
      user: session.user,
      expiresAt: session.expiresAt,
    };
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionId = request.cookies.gateway_session;
    if (sessionId) {
      sessions.delete(sessionId);
    }

    reply.clearCookie("gateway_session", { path: "/" });
    return reply.send({ status: "signed-out" });
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!config.auth.enabled) {
      return;
    }

    const protectedPath = request.url.startsWith("/jira") || request.url.startsWith("/confluence") || request.url.startsWith("/gitlab");
    if (!protectedPath) {
      return;
    }

    const sessionId = request.cookies.gateway_session;
    if (!sessionId || !sessions.get(sessionId)) {
      return reply.code(401).send({
        error: "authentication_required",
        login: "/auth/login",
      });
    }
  });

  for (const service of config.services) {
    void registerServiceProxy(app, config, service, sessions);
  }

  return app;
}