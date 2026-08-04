import { createHash, randomBytes } from "node:crypto";

import type { AppConfig } from "./config.js";
import type { SessionUserProfile } from "./session-store.js";

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  user?: SessionUserProfile;
}

const discoveryCache = new Map<string, Promise<OidcDiscoveryDocument>>();

export function createPkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
}

export async function discoverOidcDocument(issuerUrl: string): Promise<OidcDiscoveryDocument> {
  const cached = discoveryCache.get(issuerUrl);
  if (cached) {
    return cached;
  }

  const discovered = fetch(`${issuerUrl.replace(/\/$/, "")}/.well-known/openid-configuration`, {
    headers: { accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`OIDC discovery failed with status ${response.status}`);
    }

    return (await response.json()) as OidcDiscoveryDocument;
  });

  discoveryCache.set(issuerUrl, discovered);
  return discovered;
}

export async function buildAuthorizationUrl(
  config: AppConfig,
  state: string,
  pkce: PkcePair,
): Promise<string> {
  if (!config.auth.enabled || !config.auth.issuerUrl) {
    throw new Error("OIDC is not configured");
  }

  const oidc = await discoverOidcDocument(config.auth.issuerUrl);
  const url = new URL(oidc.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.auth.clientId ?? "");
  url.searchParams.set("redirect_uri", config.auth.redirectUri ?? "");
  url.searchParams.set("scope", config.auth.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

export async function exchangeCodeForTokens(
  config: AppConfig,
  code: string,
  verifier: string,
): Promise<TokenExchangeResult> {
  if (!config.auth.enabled || !config.auth.issuerUrl || !config.auth.clientId || !config.auth.clientSecret || !config.auth.redirectUri) {
    throw new Error("OIDC is not configured");
  }

  const oidc = await discoverOidcDocument(config.auth.issuerUrl);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.auth.clientId,
    client_secret: config.auth.clientSecret,
    code,
    code_verifier: verifier,
    redirect_uri: config.auth.redirectUri,
  });

  const response = await fetch(oidc.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  };

  const user = await fetchUserInfo(oidc, payload.access_token).catch(() => undefined);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    idToken: payload.id_token,
    expiresAt: payload.expires_in ? Math.floor(Date.now() / 1000) + payload.expires_in : undefined,
    user,
  };
}

async function fetchUserInfo(
  oidc: OidcDiscoveryDocument,
  accessToken: string,
): Promise<SessionUserProfile> {
  if (!oidc.userinfo_endpoint) {
    return {};
  }

  const response = await fetch(oidc.userinfo_endpoint, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`User info request failed with status ${response.status}`);
  }

  const user = (await response.json()) as Record<string, unknown>;

  return {
    sub: typeof user.sub === "string" ? user.sub : undefined,
    name: typeof user.name === "string" ? user.name : undefined,
    email: typeof user.email === "string" ? user.email : undefined,
    preferredUsername:
      typeof user.preferred_username === "string"
        ? user.preferred_username
        : undefined,
  };
}