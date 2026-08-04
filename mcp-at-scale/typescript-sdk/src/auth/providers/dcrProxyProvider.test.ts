import {
  DcrProxyOAuthServerProvider,
  DcrStore,
  Auth,
  Session,
} from "./dcrProxyProvider.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import {
  OAuthClientInformationFull,
  OAuthMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { Response } from "express";
import {
  OAuthError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { TokenCipher } from "./tokenCipher.js";

// Mock uuid and pkce-challenge modules
jest.mock("uuid", () => ({
  v4: jest.fn(() => "mock-uuid-" + Math.random().toString(36).substring(7)),
}));

jest.mock("pkce-challenge", () => {
  return jest.fn(() =>
    Promise.resolve({
      code_verifier: "mock-code-verifier",
      code_challenge: "mock-code-challenge",
    }),
  );
});

// Mock OAuth metadata
const mockOAuthMetadata: OAuthMetadata = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/authorize",
  token_endpoint: "https://auth.example.com/token",
  jwks_uri: "https://auth.example.com/.well-known/jwks.json",
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code"],
  code_challenge_methods_supported: ["S256"],
};

// Mock client data
const mockClient: OAuthClientInformationFull = {
  client_id: "test-client-id",
  redirect_uris: ["https://client.example.com/callback"],
  client_name: "Test Client",
  grant_types: ["authorization_code"],
  response_types: ["code"],
};

// Mock DcrStore
class MockDcrStore implements DcrStore {
  private stateCodeMap = new Map<string, string>();
  private authMap = new Map<string, Auth>();
  private codeSessionKeyMap = new Map<string, string>();
  private sessionMap = new Map<string, Session>();

  async setStateCode(state: string, code: string): Promise<void> {
    this.stateCodeMap.set(state, code);
  }

  async getStateCode(state: string): Promise<string | undefined> {
    return this.stateCodeMap.get(state);
  }

  async getAuth(code: string): Promise<Auth | undefined> {
    return this.authMap.get(code);
  }

  async setAuth(code: string, session: Auth): Promise<void> {
    this.authMap.set(code, session);
  }

  async setCodeSessionKey(code: string, sessionKey: string): Promise<void> {
    this.codeSessionKeyMap.set(code, sessionKey);
  }

  async getCodeSessionKey(code: string): Promise<string | undefined> {
    return this.codeSessionKeyMap.get(code);
  }

  async setSession(sessionKey: string, session: Session): Promise<void> {
    this.sessionMap.set(sessionKey, session);
  }

  async getSession(sessionKey: string): Promise<Session | undefined> {
    return this.sessionMap.get(sessionKey);
  }

  // Helper methods for testing
  clear() {
    this.stateCodeMap.clear();
    this.authMap.clear();
    this.codeSessionKeyMap.clear();
    this.sessionMap.clear();
  }
}

// Mock clients store
const mockClientsStore = {
  getClient: jest.fn(),
  registerClient: jest.fn(),
  updateClient: jest.fn(),
  deleteClient: jest.fn(),
  listClients: jest.fn(),
} as unknown as OAuthRegisteredClientsStore;

// Mock token cipher
const mockTokenCipher = {
  seal: jest.fn((token: string) => `sealed-${token}`),
  open: jest.fn((encrypted: string) =>
    encrypted.startsWith("sealed-")
      ? encrypted.slice(7)
      : (() => {
          throw new Error("Invalid token");
        })(),
  ),
} as unknown as TokenCipher;

// Mock fetch function
const mockFetch = jest.fn();

// Mock response object
const createMockResponse = () => {
  const res = {
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

describe("DcrProxyOAuthServerProvider", () => {
  let provider: DcrProxyOAuthServerProvider;
  let store: MockDcrStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new MockDcrStore();

    provider = new DcrProxyOAuthServerProvider({
      oauthMetadata: mockOAuthMetadata,
      endpoints: {
        callbackUrl: "https://proxy.example.com/callback",
      },
      clientId: "dcr-proxy-client-id",
      clientSecret: "dcr-proxy-client-secret",
      clientsStore: mockClientsStore,
      store,
      scopes: ["openid", "profile"],
      tokenCipher: mockTokenCipher,
      fetchFn: mockFetch,
    });
  });

  describe("constructor and properties", () => {
    it("should create provider with required options", () => {
      expect(provider).toBeDefined();
      expect(provider.clientsStore).toBe(mockClientsStore);
      expect(provider.skipLocalPkceValidation).toBe(false);
    });

    it("should use default scopes if none provided", () => {
      const providerWithoutScopes = new DcrProxyOAuthServerProvider({
        oauthMetadata: mockOAuthMetadata,
        endpoints: {
          callbackUrl: "https://proxy.example.com/callback",
        },
        clientId: "dcr-proxy-client-id",
        clientSecret: "dcr-proxy-client-secret",
        clientsStore: mockClientsStore,
        store,
        tokenCipher: mockTokenCipher,
      });

      expect(providerWithoutScopes).toBeDefined();
    });
  });

  describe("authorize", () => {
    const authParams: AuthorizationParams = {
      redirectUri: "https://client.example.com/callback",
      state: "client-state-123",
      codeChallenge: "client-code-challenge",
      scopes: ["openid", "profile"],
    };

    it("should redirect to authorization endpoint with correct parameters", async () => {
      const res = createMockResponse();

      await provider.authorize(mockClient, authParams, res);

      expect(res.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0];

      expect(redirectUrl).toContain("https://auth.example.com/authorize");
      expect(redirectUrl).toContain("client_id=dcr-proxy-client-id");
      expect(redirectUrl).toContain("response_type=code");
      expect(redirectUrl).toContain(
        "redirect_uri=https%3A%2F%2Fproxy.example.com%2Fcallback",
      );
      expect(redirectUrl).toContain("code_challenge_method=S256");
      expect(redirectUrl).toContain("scope=openid+profile");
    });

    it("should store auth information in store", async () => {
      const res = createMockResponse();

      await provider.authorize(mockClient, authParams, res);

      // Extract state from redirect URL
      const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0];
      const url = new URL(redirectUrl);
      const state = url.searchParams.get("state");

      expect(state).toBeDefined();

      // Verify auth was stored
      const code = await store.getStateCode(state!);
      expect(code).toBeDefined();

      const auth = await store.getAuth(code!);
      expect(auth).toBeDefined();
      expect(auth?.clientClientId).toBe(mockClient.client_id);
      expect(auth?.clientCallbackRedirectUri).toBe(authParams.redirectUri);
      expect(auth?.clientState).toBe(authParams.state);
      expect(auth?.clientCodeChallenge).toBe(authParams.codeChallenge);
      expect(auth?.clientCodeChallengeMethod).toBe("S256");
      expect(auth?.clientScopes).toEqual(authParams.scopes);
      expect(auth?.codeVerifier).toBeDefined();
    });

    it("should handle missing optional parameters", async () => {
      const res = createMockResponse();
      const minimalParams: AuthorizationParams = {
        redirectUri: "https://client.example.com/callback",
        codeChallenge: "minimal-code-challenge",
      };

      await provider.authorize(mockClient, minimalParams, res);

      expect(res.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0];
      const url = new URL(redirectUrl);
      const state = url.searchParams.get("state");
      const code = await store.getStateCode(state!);
      const auth = await store.getAuth(code!);

      expect(auth?.clientState).toBeUndefined();
      expect(auth?.clientScopes).toBeUndefined();
    });

    it("should omit scope parameter when no scopes configured", async () => {
      const providerWithoutScopes = new DcrProxyOAuthServerProvider({
        oauthMetadata: mockOAuthMetadata,
        endpoints: {
          callbackUrl: "https://proxy.example.com/callback",
        },
        clientId: "dcr-proxy-client-id",
        clientSecret: "dcr-proxy-client-secret",
        clientsStore: mockClientsStore,
        store,
        tokenCipher: mockTokenCipher,
      });

      const res = createMockResponse();

      await providerWithoutScopes.authorize(mockClient, authParams, res);

      const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl).not.toContain("scope=");
    });
  });

  describe("challengeForAuthorizationCode", () => {
    it("should return client code challenge for valid authorization code", async () => {
      const authorizationCode = "test-auth-code";
      const auth: Auth = {
        codeVerifier: "test-verifier",
        clientClientId: mockClient.client_id,
        clientCodeChallenge: "client-code-challenge",
        clientCodeChallengeMethod: "S256",
        clientCallbackRedirectUri: "https://client.example.com/callback",
      };

      await store.setAuth(authorizationCode, auth);

      const challenge = await provider.challengeForAuthorizationCode(
        mockClient,
        authorizationCode,
      );

      expect(challenge).toBe("client-code-challenge");
    });

    it("should return empty string when no code challenge exists", async () => {
      const authorizationCode = "test-auth-code";
      const auth: Auth = {
        codeVerifier: "test-verifier",
        clientClientId: mockClient.client_id,
        clientCallbackRedirectUri: "https://client.example.com/callback",
      };

      await store.setAuth(authorizationCode, auth);

      const challenge = await provider.challengeForAuthorizationCode(
        mockClient,
        authorizationCode,
      );

      expect(challenge).toBe("");
    });

    it("should throw error for non-existent authorization code", async () => {
      await expect(
        provider.challengeForAuthorizationCode(mockClient, "non-existent-code"),
      ).rejects.toThrow(ServerError);

      await expect(
        provider.challengeForAuthorizationCode(mockClient, "non-existent-code"),
      ).rejects.toThrow("Auth not found for the provided authorization code");
    });
  });

  describe("callback", () => {
    it("should handle successful callback and redirect to client", async () => {
      const state = "callback-state";
      const code = "callback-code";
      const providerCode = "provider-code";
      const auth: Auth = {
        codeVerifier: "test-verifier",
        clientClientId: mockClient.client_id,
        clientCallbackRedirectUri: "https://client.example.com/callback",
        clientState: "client-state-123",
      };

      await store.setStateCode(state, code);
      await store.setAuth(code, auth);

      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "provider-access-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      const res = createMockResponse();

      await provider.callback({ code: providerCode, state }, res);

      expect(res.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0];

      expect(redirectUrl).toContain("https://client.example.com/callback");
      expect(redirectUrl).toContain("code=");
      expect(redirectUrl).toContain("state=client-state-123");

      // Verify session was stored
      const sessionKey = await store.getCodeSessionKey(code);
      expect(sessionKey).toBeDefined();

      const session = await store.getSession(sessionKey!);
      expect(session).toBeDefined();
      expect(session?.clientClientId).toBe(mockClient.client_id);
      expect(session?.oAuthTokens.access_token).toBe("provider-access-token");
    });

    it("should redirect without state when client state is not provided", async () => {
      const state = "callback-state";
      const code = "callback-code";
      const providerCode = "provider-code";
      const auth: Auth = {
        codeVerifier: "test-verifier",
        clientClientId: mockClient.client_id,
        clientCallbackRedirectUri: "https://client.example.com/callback",
      };

      await store.setStateCode(state, code);
      await store.setAuth(code, auth);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "provider-access-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      const res = createMockResponse();

      await provider.callback({ code: providerCode, state }, res);

      const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl).toContain("https://client.example.com/callback");
      expect(redirectUrl).toContain("code=");
      expect(redirectUrl).not.toContain("state=");
    });

    it("should throw error when state parameter is missing", async () => {
      const res = createMockResponse();

      await expect(
        provider.callback({ code: "some-code" }, res),
      ).rejects.toThrow(ServerError);

      await expect(
        provider.callback({ code: "some-code" }, res),
      ).rejects.toThrow("Missing state parameter in callback");
    });

    it("should throw error when state is not found in store", async () => {
      const res = createMockResponse();

      await expect(
        provider.callback({ code: "some-code", state: "invalid-state" }, res),
      ).rejects.toThrow(ServerError);

      await expect(
        provider.callback({ code: "some-code", state: "invalid-state" }, res),
      ).rejects.toThrow("State not found for the provided state parameter");
    });

    it("should throw error when auth is not found for code", async () => {
      const state = "callback-state";
      const code = "callback-code";

      await store.setStateCode(state, code);

      const res = createMockResponse();

      await expect(
        provider.callback({ code: "provider-code", state }, res),
      ).rejects.toThrow(ServerError);

      await expect(
        provider.callback({ code: "provider-code", state }, res),
      ).rejects.toThrow("Auth not found for the provided state");
    });
  });

  describe("exchangeAuthorizationCode", () => {
    it("should return access token with encrypted session key", async () => {
      const authorizationCode = "auth-code-123";
      const sessionKey = "session-key-123";

      await store.setCodeSessionKey(authorizationCode, sessionKey);

      const tokens = await provider.exchangeAuthorizationCode(
        mockClient,
        authorizationCode,
      );

      expect(tokens.token_type).toBe("Bearer");
      expect(tokens.access_token).toBeDefined();
      expect(tokens.expires_in).toBe(3600);
      expect(tokens.access_token).not.toBe(sessionKey); // Should be encrypted
    });

    it("should throw error when session key not found", async () => {
      await expect(
        provider.exchangeAuthorizationCode(mockClient, "non-existent-code"),
      ).rejects.toThrow(ServerError);

      await expect(
        provider.exchangeAuthorizationCode(mockClient, "non-existent-code"),
      ).rejects.toThrow(
        "Session key not found for the provided authorization code",
      );
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify valid access token and return auth info", async () => {
      const sessionKey = "session-key-123";
      const session: Session = {
        clientClientId: mockClient.client_id,
        clientScopes: ["openid", "profile"],
        oAuthTokens: {
          token_type: "Bearer",
          access_token: "provider-access-token",
          expires_in: 3600,
          scope: "openid profile",
        },
      };

      await store.setSession(sessionKey, session);

      // Create encrypted session ID (simulating what exchangeAuthorizationCode returns)
      const sessionId = mockTokenCipher.seal(sessionKey);

      const authInfo = await provider.verifyAccessToken(sessionId);

      expect(authInfo.token).toBe(sessionId);
      expect(authInfo.clientId).toBe(mockClient.client_id);
      expect(authInfo.scopes).toEqual(["openid", "profile"]);
      expect(authInfo.expiresAt).toBeDefined();
      expect(authInfo.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should handle tokens without scope", async () => {
      const sessionKey = "session-key-123";
      const session: Session = {
        clientClientId: mockClient.client_id,
        oAuthTokens: {
          token_type: "Bearer",
          access_token: "provider-access-token",
          expires_in: 3600,
        },
      };

      await store.setSession(sessionKey, session);

      const sessionId = mockTokenCipher.seal(sessionKey);

      const authInfo = await provider.verifyAccessToken(sessionId);

      expect(authInfo.scopes).toEqual([]);
    });

    it("should handle tokens without expires_in", async () => {
      const sessionKey = "session-key-123";
      const session: Session = {
        clientClientId: mockClient.client_id,
        oAuthTokens: {
          token_type: "Bearer",
          access_token: "provider-access-token",
        },
      };

      await store.setSession(sessionKey, session);

      const sessionId = mockTokenCipher.seal(sessionKey);

      const authInfo = await provider.verifyAccessToken(sessionId);

      expect(authInfo.expiresAt).toBeUndefined();
    });

    it("should throw error for invalid session ID", async () => {
      await expect(
        provider.verifyAccessToken("invalid-session-id"),
      ).rejects.toThrow();
    });

    it("should throw OAuthError when session not found", async () => {
      // Create a valid encrypted session ID for non-existent session
      const nonExistentKey = "non-existent-session-key";
      const sessionId = mockTokenCipher.seal(nonExistentKey);

      await expect(provider.verifyAccessToken(sessionId)).rejects.toThrow(
        OAuthError,
      );

      await expect(provider.verifyAccessToken(sessionId)).rejects.toThrow(
        "No session found for token",
      );
    });
  });

  describe("translateSessionId", () => {
    it("should translate encrypted session ID to OAuth tokens", async () => {
      const sessionKey = "session-key-123";
      const oAuthTokens: OAuthTokens = {
        token_type: "Bearer",
        access_token: "provider-access-token",
        expires_in: 3600,
        refresh_token: "provider-refresh-token",
        scope: "openid profile",
      };
      const session: Session = {
        clientClientId: mockClient.client_id,
        oAuthTokens,
      };

      await store.setSession(sessionKey, session);

      const sessionId = mockTokenCipher.seal(sessionKey);

      const tokens = await provider.translateSessionId(sessionId);

      expect(tokens).toEqual(oAuthTokens);
    });

    it("should throw error for invalid session ID", async () => {
      await expect(
        provider.translateSessionId("invalid-session-id"),
      ).rejects.toThrow();
    });

    it("should throw ServerError when session not found", async () => {
      const nonExistentKey = "non-existent-session-key";
      const sessionId = mockTokenCipher.seal(nonExistentKey);

      await expect(provider.translateSessionId(sessionId)).rejects.toThrow(
        ServerError,
      );

      await expect(provider.translateSessionId(sessionId)).rejects.toThrow(
        "Session not found for the provided session key",
      );
    });
  });

  describe("exchangeRefreshToken", () => {
    it("should throw error as method is not implemented", () => {
      expect(() => {
        provider.exchangeRefreshToken(mockClient, "refresh-token");
      }).toThrow("Method not implemented.");
    });
  });

  describe("end-to-end flow", () => {
    it("should complete full OAuth flow from authorize to token verification", async () => {
      // Step 1: Authorize
      const authParams: AuthorizationParams = {
        redirectUri: "https://client.example.com/callback",
        state: "client-state",
        codeChallenge: "client-challenge",
        scopes: ["openid", "profile"],
      };

      const authorizeRes = createMockResponse();
      await provider.authorize(mockClient, authParams, authorizeRes);

      // Extract state and code from authorize flow
      const authorizeRedirectUrl = (authorizeRes.redirect as jest.Mock).mock
        .calls[0][0];
      const authorizeUrl = new URL(authorizeRedirectUrl);
      const proxyState = authorizeUrl.searchParams.get("state");

      // Step 2: Simulate callback from authorization server
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "provider-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "openid profile",
        }),
      });

      const callbackRes = createMockResponse();
      await provider.callback(
        { code: "provider-auth-code", state: proxyState! },
        callbackRes,
      );

      // Extract code from callback redirect
      const callbackRedirectUrl = (callbackRes.redirect as jest.Mock).mock
        .calls[0][0];
      const callbackUrl = new URL(callbackRedirectUrl);
      const clientCode = callbackUrl.searchParams.get("code");

      // Step 3: Exchange authorization code for access token
      const tokens = await provider.exchangeAuthorizationCode(
        mockClient,
        clientCode!,
      );

      expect(tokens.access_token).toBeDefined();
      expect(tokens.token_type).toBe("Bearer");

      // Step 4: Verify access token
      const authInfo = await provider.verifyAccessToken(tokens.access_token);

      expect(authInfo.clientId).toBe(mockClient.client_id);
      expect(authInfo.scopes).toEqual(["openid", "profile"]);
    });
  });

  describe("error handling", () => {
    it("should handle store errors gracefully", async () => {
      const failingStore = {
        ...store,
        getAuth: jest.fn().mockRejectedValue(new Error("Store error")),
      } as unknown as DcrStore;

      const providerWithFailingStore = new DcrProxyOAuthServerProvider({
        oauthMetadata: mockOAuthMetadata,
        endpoints: {
          callbackUrl: "https://proxy.example.com/callback",
        },
        clientId: "dcr-proxy-client-id",
        clientSecret: "dcr-proxy-client-secret",
        clientsStore: mockClientsStore,
        store: failingStore,
        tokenCipher: mockTokenCipher,
      });

      await expect(
        providerWithFailingStore.challengeForAuthorizationCode(
          mockClient,
          "test-code",
        ),
      ).rejects.toThrow("Store error");
    });
  });
});
