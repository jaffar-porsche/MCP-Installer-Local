import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
  OAuthMetadata,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  exchangeAuthorization,
  OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import pkceChallenge from "pkce-challenge";
import { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { TokenCipher } from "./tokenCipher.js";

export type DcrProxyOptions = {
  /**
   * Proxied metadata.
   */
  oauthMetadata: OAuthMetadata;
  /**
   * Individual endpoint URLs for the DCR proxy.
   */
  endpoints: DcrProxyEndpoints;
  /**
   * Client ID to use for the DCR Proxy
   */
  clientId: string;
  /**
   * Client secret to use for the DCR Proxy
   */
  clientSecret: string;
  /**
   * Clients store to manage registered clients
   */
  clientsStore: OAuthRegisteredClientsStore;
  /**
   * Cache is the cache to use by the DCR Proxy.
   */
  store: DcrStore;
  /**
   * Scopes are the scopes to request during authorization.
   */
  scopes?: string[];
  /**
   * Token cipher to encrypt/decrypt tokens.
   */
  tokenCipher: TokenCipher;
  /**
   * Token expiration time in seconds. Defaults to 3600 (1 hour).
   */
  tokenExpiresInSeconds?: number;
  /**
   * Control how client authentication is added on token exchange.
   */
  addClientAuthentication?: OAuthClientProvider["addClientAuthentication"];
  /**
   * Supply a custom fetch function on token exchange.
   */
  fetchFn?: FetchLike;
};

export type Auth = {
  codeVerifier: string;
  clientClientId: string;
  clientCodeChallenge?: string;
  clientCodeChallengeMethod?: string;
  clientState?: string;
  clientScopes?: string[];
  clientCallbackRedirectUri: string;
};

export type Session = {
  clientClientId: string;
  clientScopes?: string[];
  oAuthTokens: OAuthTokens;
};

export interface DcrStore {
  setStateCode(state: string, code: string): Promise<void>;
  getStateCode(state: string): string | undefined | Promise<string | undefined>;

  getAuth(code: string): Auth | undefined | Promise<Auth | undefined>;
  setAuth(code: string, session: Auth): Promise<void>;

  setCodeSessionKey(code: string, sessionKey: string): Promise<void>;
  getCodeSessionKey(
    code: string,
  ): string | undefined | Promise<string | undefined>;

  setSession(sessionKey: string, session: Session): Promise<void>;
  getSession(
    sessionKey: string,
  ): Session | undefined | Promise<Session | undefined>;
}

export type CallbackParams = {
  code: string;
  state?: string;
};

export type DcrProxyEndpoints = {
  callbackUrl: string;
};

export class DcrProxyOAuthServerProvider
  implements OAuthServerProvider, DcrProxySessionIdTranslator
{
  private readonly oauthMetadata: OAuthMetadata;
  private readonly endpoints: DcrProxyEndpoints;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly _clientsStore: OAuthRegisteredClientsStore;
  private readonly _store: DcrStore;
  private readonly scopes: string[];
  private readonly tokenCipher: TokenCipher;
  private readonly tokenExpiresInSeconds: number;
  private readonly addClientAuthentication?: OAuthClientProvider["addClientAuthentication"];
  private readonly fetchFn?: FetchLike;

  constructor({
    oauthMetadata,
    endpoints,
    clientId,
    clientSecret,
    clientsStore,
    store: cache,
    scopes,
    tokenCipher,
    tokenExpiresInSeconds,
    addClientAuthentication,
    fetchFn,
  }: DcrProxyOptions) {
    this.oauthMetadata = oauthMetadata;
    this.endpoints = endpoints;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this._clientsStore = clientsStore;
    this._store = cache;
    this.scopes = scopes || [];
    this.tokenCipher = tokenCipher;
    this.tokenExpiresInSeconds = tokenExpiresInSeconds || 3600;
    this.addClientAuthentication = addClientAuthentication;
    this.fetchFn = fetchFn;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  get store(): DcrStore {
    return this._store;
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const state = uuidv4();
    const code = uuidv4();
    const { code_challenge: codeChallenge, code_verifier: codeVerifier } =
      await pkceChallenge();

    await this._store.setAuth(code, {
      codeVerifier,
      clientClientId: client.client_id,
      clientCodeChallenge: params.codeChallenge,
      clientCodeChallengeMethod: "S256", // TODO: Is this always S256?
      clientState: params.state,
      clientCallbackRedirectUri: params.redirectUri,
      clientScopes: params.scopes,
    });
    await this._store.setStateCode(state, code);

    const targetUrl = new URL(this.oauthMetadata.authorization_endpoint);
    const searchParams = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.endpoints.callbackUrl,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    if (this.scopes?.length) {
      searchParams.set("scope", this.scopes.join(" "));
    }

    targetUrl.search = searchParams.toString();
    res.redirect(targetUrl.toString());
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const auth = await this._store.getAuth(authorizationCode);

    if (!auth) {
      throw new ServerError(
        "Auth not found for the provided authorization code",
      );
    }

    return auth.clientCodeChallenge || "";
  }

  async translateSessionId(sessionId: string): Promise<OAuthTokens> {
    const sessionKey = this.tokenCipher.open(sessionId);
    const session = await this._store.getSession(sessionKey);
    if (!session) {
      throw new ServerError("Session not found for the provided session key");
    }

    return session.oAuthTokens;
  }

  async callback(params: CallbackParams, res: Response): Promise<void> {
    if (!params.state) {
      throw new ServerError("Missing state parameter in callback");
    }

    const code = await this._store.getStateCode(params.state);
    if (!code) {
      throw new ServerError("State not found for the provided state parameter");
    }

    const auth = await this._store.getAuth(code);
    if (!auth) {
      throw new ServerError("Auth not found for the provided state");
    }

    const oAuthTokens = await exchangeAuthorization(this.oauthMetadata.issuer, {
      metadata: this.oauthMetadata,
      clientInformation: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
      },
      authorizationCode: params.code,
      codeVerifier: auth.codeVerifier,
      redirectUri: this.endpoints.callbackUrl,
      addClientAuthentication: this.addClientAuthentication,
      fetchFn: this.fetchFn,
    });

    const sessionKey = uuidv4();
    await this._store.setSession(sessionKey, {
      clientClientId: auth.clientClientId,
      clientScopes: auth.clientScopes,
      oAuthTokens,
    });
    await this._store.setCodeSessionKey(code, sessionKey);

    const redirectUrl = new URL(auth.clientCallbackRedirectUri);
    const searchParams = new URLSearchParams({ code });
    if (auth.clientState) {
      searchParams.set("state", auth.clientState);
    }
    redirectUrl.search = searchParams.toString();
    res.redirect(redirectUrl.toString());
  }

  async exchangeAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL,
  ): Promise<OAuthTokens> {
    const sessionKey = await this._store.getCodeSessionKey(authorizationCode);
    if (!sessionKey) {
      throw new ServerError(
        "Session key not found for the provided authorization code",
      );
    }

    return {
      token_type: "Bearer",
      access_token: this.tokenCipher.seal(sessionKey),
      expires_in: this.tokenExpiresInSeconds,
    };
  }

  exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    _refreshToken: string,
    _scopes?: string[],
    _resource?: URL,
  ): Promise<OAuthTokens> {
    throw new Error("Method not implemented.");
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const sessionId = token; // We only hand out session IDs as access tokens
    const sessionKey = this.tokenCipher.open(sessionId);
    const session = await this._store.getSession(sessionKey);
    if (!session) {
      throw new OAuthError("No session found for token");
    }

    const oAuthTokens = session.oAuthTokens;

    return {
      token,
      clientId: session.clientClientId,
      scopes: oAuthTokens.scope ? oAuthTokens.scope.split(" ") : [],
      expiresAt: oAuthTokens.expires_in
        ? Date.now() + oAuthTokens.expires_in * 1000
        : undefined,
    };
  }

  revokeToken?(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void>;

  skipLocalPkceValidation?: boolean | undefined = false;
}

export interface DcrProxySessionIdTranslator {
  translateSessionId(sessionId: string): Promise<OAuthTokens>;
}
