import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),
  NODE_ENV: z.string().default("development"),
  SESSION_SECRET: z.string().min(32),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  GATEWAY_BASE_URL: z.string().url().default("http://localhost:8080"),
  OIDC_ISSUER_URL: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_SCOPES: z
    .string()
    .default("openid profile email offline_access")
    .transform((value) => value.split(/\s+/).filter(Boolean)),
  JIRA_UPSTREAM_URL: z.string().url().optional(),
  CONFLUENCE_UPSTREAM_URL: z.string().url().optional(),
  GITLAB_UPSTREAM_URL: z.string().url().optional(),
  JIRA_SERVICE_TOKEN: z.string().optional(),
  CONFLUENCE_SERVICE_TOKEN: z.string().optional(),
  GITLAB_SERVICE_TOKEN: z.string().optional(),
});

export type ServiceName = "jira" | "confluence" | "gitlab";

export interface ServiceDefinition {
  name: ServiceName;
  upstreamUrl: string;
  serviceToken?: string;
}

export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
  nodeEnv: string;
  sessionSecret: string;
  cookieSecure: boolean;
  gatewayBaseUrl: string;
  auth: {
    enabled: boolean;
    issuerUrl?: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    scopes: string[];
  };
  services: ServiceDefinition[];
}

function normalizeService(
  name: ServiceName,
  upstreamUrl: string | undefined,
  serviceToken: string | undefined,
): ServiceDefinition | null {
  if (!upstreamUrl) {
    return null;
  }

  return {
    name,
    upstreamUrl,
    serviceToken,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  const authFields = [parsed.OIDC_ISSUER_URL, parsed.OIDC_CLIENT_ID, parsed.OIDC_CLIENT_SECRET];
  const hasAnyAuthField = authFields.some(Boolean);
  const hasAllAuthFields = authFields.every(Boolean);

  if (hasAnyAuthField && !hasAllAuthFields) {
    throw new Error("OIDC_ISSUER_URL, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET must be set together");
  }

  const redirectUri = parsed.OIDC_REDIRECT_URI ?? `${parsed.GATEWAY_BASE_URL.replace(/\/$/, "")}/auth/callback`;

  const services = [
    normalizeService("jira", parsed.JIRA_UPSTREAM_URL, parsed.JIRA_SERVICE_TOKEN),
    normalizeService("confluence", parsed.CONFLUENCE_UPSTREAM_URL, parsed.CONFLUENCE_SERVICE_TOKEN),
    normalizeService("gitlab", parsed.GITLAB_UPSTREAM_URL, parsed.GITLAB_SERVICE_TOKEN),
  ].filter((service): service is ServiceDefinition => service !== null);

  return {
    port: parsed.PORT,
    host: parsed.HOST,
    logLevel: parsed.LOG_LEVEL,
    nodeEnv: parsed.NODE_ENV,
    sessionSecret: parsed.SESSION_SECRET,
    cookieSecure: parsed.COOKIE_SECURE,
    gatewayBaseUrl: parsed.GATEWAY_BASE_URL.replace(/\/$/, ""),
    auth: {
      enabled: hasAllAuthFields,
      issuerUrl: parsed.OIDC_ISSUER_URL,
      clientId: parsed.OIDC_CLIENT_ID,
      clientSecret: parsed.OIDC_CLIENT_SECRET,
      redirectUri,
      scopes: parsed.OIDC_SCOPES,
    },
    services,
  };
}