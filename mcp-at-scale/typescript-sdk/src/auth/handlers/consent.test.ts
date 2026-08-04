import { consentHandler, ConsentParamsSchema } from "./consent.js";
import { ClientApproval, ClientApprovalStore } from "../consent/consent.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import express from "express";
import request from "supertest";

// Mock client approval store
const mockClientApprovalStore = {
  getClientApproval: jest.fn(),
  setClientApproval: jest.fn(),
} as unknown as ClientApprovalStore;

// Mock client approval store factory
const mockClientApprovalStoreFactory = jest
  .fn()
  .mockReturnValue(mockClientApprovalStore);

// Mock clients store
const mockClientsStore = {
  getClient: jest.fn(),
} as unknown as OAuthRegisteredClientsStore;

// Mock client data
const mockClient: OAuthClientInformationFull = {
  client_id: "test-client-id",
  redirect_uris: [
    "https://example.com/callback",
    "https://example.com/callback2",
    "https://example.com/callback?param=value&other=test",
  ],
  client_name: "Test Client",
  grant_types: ["authorization_code"],
  response_types: ["code"],
};

// Mock consent template
const mockConsentTemplate = jest
  .fn()
  .mockReturnValue("<html><body>Consent Page</body></html>");

describe("consentHandler", () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a test Express app with the consent handler
    app = express();
    app.use(express.urlencoded({ extended: false }));

    const handler = consentHandler({
      clientApprovalStoreFactory: mockClientApprovalStoreFactory,
      clientsStore: mockClientsStore,
      authorizePath: "/auth/authorize",
      consentTemplate: mockConsentTemplate,
      consentPath: "/consent",
    });

    app.use("/consent", handler);
  });

  describe("invalid consent params", () => {
    it("should return 400 error for invalid parameters", async () => {
      const response = await request(app).get("/consent").query({
        client_id: "test-client",
        // Missing required fields like redirect_uri, response_type, code_challenge
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.any(String),
      });
      expect(mockClientsStore.getClient).not.toHaveBeenCalled();
    });

    it("should return 400 error for invalid redirect_uri format", async () => {
      const response = await request(app).get("/consent").query({
        client_id: "test-client",
        redirect_uri: "invalid-url",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.any(String),
      });
      expect(mockClientsStore.getClient).not.toHaveBeenCalled();
    });

    it("should handle POST requests with invalid body parameters", async () => {
      const response = await request(app).post("/consent").type("form").send({
        client_id: "",
        redirect_uri: "invalid-url",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("invalid client handling", () => {
    it("should return 400 error for invalid client_id", async () => {
      mockClientsStore.getClient = jest.fn().mockResolvedValue(null);

      const response = await request(app).get("/consent").query({
        client_id: "invalid-client",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Invalid client_id",
      });
      expect(mockClientsStore.getClient).toHaveBeenCalledWith("invalid-client");
    });

    it("should return 400 error for unregistered redirect_uri", async () => {
      mockClientsStore.getClient = jest.fn().mockResolvedValue(mockClient);

      const response = await request(app).get("/consent").query({
        client_id: "test-client-id",
        redirect_uri: "https://malicious.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Invalid redirect_uri",
      });
      expect(mockClientsStore.getClient).toHaveBeenCalledWith("test-client-id");
    });
  });

  describe("client approval handling", () => {
    beforeEach(() => {
      mockClientsStore.getClient = jest.fn().mockResolvedValue(mockClient);
    });

    it("should redirect to authorize when client is already approved", async () => {
      mockClientApprovalStore.getClientApproval = jest
        .fn()
        .mockReturnValue(ClientApproval.APPROVED);

      const response = await request(app).get("/consent").query({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
        scope: "openid profile",
        state: "test-state",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/auth/authorize");
      expect(response.headers.location).toContain("client_id=test-client-id");
      expect(response.headers.location).toContain(
        "redirect_uri=https%3A%2F%2Fexample.com%2Fcallback",
      );
      expect(response.headers.location).toContain("response_type=code");
      expect(response.headers.location).toContain(
        "code_challenge=test-challenge",
      );
      expect(response.headers.location).toContain("scope=openid+profile");
      expect(response.headers.location).toContain("state=test-state");

      expect(mockClientApprovalStore.getClientApproval).toHaveBeenCalledWith(
        "test-client-id",
        "https://example.com/callback",
      );
    });

    it("should return 403 when client is denied", async () => {
      mockClientApprovalStore.getClientApproval = jest
        .fn()
        .mockReturnValue(ClientApproval.DENIED);

      const response = await request(app).get("/consent").query({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
      });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: "Client approval denied",
      });
      expect(mockClientApprovalStore.getClientApproval).toHaveBeenCalledWith(
        "test-client-id",
        "https://example.com/callback",
      );
    });
  });

  describe("consent page rendering", () => {
    beforeEach(() => {
      mockClientsStore.getClient = jest.fn().mockResolvedValue(mockClient);
      mockClientApprovalStore.getClientApproval = jest
        .fn()
        .mockReturnValue(undefined);
    });

    it("should render consent page when no consent_action is provided", async () => {
      const response = await request(app).get("/consent").query({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
        scope: "openid profile",
        state: "test-state",
      });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.text).toBe("<html><body>Consent Page</body></html>");

      expect(mockConsentTemplate).toHaveBeenCalledWith({
        params: {
          client: mockClient,
          client_id: "test-client-id",
          redirect_uri: "https://example.com/callback",
          response_type: "code",
          code_challenge: "test-challenge",
          code_challenge_method: "S256",
          scope: "openid profile",
          state: "test-state",
        },
        consent_url: "/consent",
      });
    });

    it("should render consent page with optional parameters", async () => {
      const response = await request(app).get("/consent").query({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
        resource: "https://api.example.com",
      });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");

      expect(mockConsentTemplate).toHaveBeenCalledWith({
        params: {
          client: mockClient,
          client_id: "test-client-id",
          redirect_uri: "https://example.com/callback",
          response_type: "code",
          code_challenge: "test-challenge",
          code_challenge_method: "S256",
          resource: "https://api.example.com",
        },
        consent_url: "/consent",
      });
    });
  });

  describe("consent approval actions", () => {
    beforeEach(() => {
      mockClientsStore.getClient = jest.fn().mockResolvedValue(mockClient);
      mockClientApprovalStore.getClientApproval = jest
        .fn()
        .mockReturnValue(undefined);
    });

    it("should approve client and redirect to authorize on approve action", async () => {
      const response = await request(app).post("/consent").type("form").send({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
        consent_action: "approve",
        scope: "openid",
        state: "test-state",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/auth/authorize");
      expect(response.headers.location).toContain("client_id=test-client-id");

      expect(mockClientApprovalStore.setClientApproval).toHaveBeenCalledWith(
        expect.any(Object), // response object
        "test-client-id",
        "https://example.com/callback",
        ClientApproval.APPROVED,
      );
    });

    it("should deny client and return 403 on deny action", async () => {
      const response = await request(app).post("/consent").type("form").send({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
        consent_action: "deny",
      });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: "Client approval denied",
      });

      expect(mockClientApprovalStore.setClientApproval).toHaveBeenCalledWith(
        expect.any(Object), // response object
        "test-client-id",
        "https://example.com/callback",
        ClientApproval.DENIED,
      );
    });

    it("should handle approve action via GET request", async () => {
      const response = await request(app).get("/consent").query({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
        consent_action: "approve",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/auth/authorize");

      expect(mockClientApprovalStore.setClientApproval).toHaveBeenCalledWith(
        expect.any(Object), // response object
        "test-client-id",
        "https://example.com/callback",
        ClientApproval.APPROVED,
      );
    });
  });

  describe("HTTP method validation", () => {
    beforeEach(() => {
      mockClientsStore.getClient = jest.fn().mockResolvedValue(mockClient);
      mockClientApprovalStore.getClientApproval = jest
        .fn()
        .mockReturnValue(undefined);
    });

    it("should handle GET requests", async () => {
      const response = await request(app).get("/consent").query({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
      });

      expect(response.status).toBe(200);
      expect(mockConsentTemplate).toHaveBeenCalled();
    });

    it("should handle POST requests", async () => {
      const response = await request(app).post("/consent").type("form").send({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
        consent_action: "approve",
      });

      expect(response.status).toBe(302);
      expect(mockClientApprovalStore.setClientApproval).toHaveBeenCalled();
    });

    it("should reject PUT requests", async () => {
      const response = await request(app).put("/consent").send({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
      });

      expect(response.status).toBe(405); // Method Not Allowed
      expect(mockConsentTemplate).not.toHaveBeenCalled();
    });

    it("should reject DELETE requests", async () => {
      const response = await request(app).delete("/consent");

      expect(response.status).toBe(405); // Method Not Allowed
      expect(mockConsentTemplate).not.toHaveBeenCalled();
    });
  });

  describe("URL parameter handling", () => {
    beforeEach(() => {
      mockClientsStore.getClient = jest.fn().mockResolvedValue(mockClient);
      mockClientApprovalStore.getClientApproval = jest
        .fn()
        .mockReturnValue(ClientApproval.APPROVED);
    });

    it("should properly encode redirect parameters", async () => {
      const response = await request(app).post("/consent").type("form").send({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback?param=value&other=test",
        response_type: "code",
        code_challenge: "test+challenge/with=special",
        code_challenge_method: "S256",
        resource: "https://api.example.com/v1",
        consent_action: "approve",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain(
        "redirect_uri=https%3A%2F%2Fexample.com%2Fcallback%3Fparam%3Dvalue%26other%3Dtest",
      );
      expect(response.headers.location).toContain(
        "code_challenge=test%2Bchallenge%2Fwith%3Dspecial",
      );
      expect(response.headers.location).toContain(
        "resource=https%3A%2F%2Fapi.example.com%2Fv1",
      );
    });

    it("should handle missing optional parameters", async () => {
      const response = await request(app).get("/consent").query({
        client_id: "test-client-id",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
        // No scope, state, or resource
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/auth/authorize");
      expect(response.headers.location).not.toContain("scope=");
      expect(response.headers.location).not.toContain("state=");
      expect(response.headers.location).not.toContain("resource=");
    });
  });

  describe("consentHandler function structure", () => {
    it("should return an Express router", () => {
      const handler = consentHandler({
        clientApprovalStoreFactory: mockClientApprovalStoreFactory,
        clientsStore: mockClientsStore,
        authorizePath: "/auth/authorize",
        consentPath: "/consent",
      });

      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("should use default consent template when none provided", () => {
      const handler = consentHandler({
        clientApprovalStoreFactory: mockClientApprovalStoreFactory,
        clientsStore: mockClientsStore,
        authorizePath: "/auth/authorize",
        consentPath: "/consent",
        // No consentTemplate provided
      });

      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });
  });

  describe("ConsentParamsSchema validation", () => {
    it("should validate required fields", () => {
      const validParams = {
        client_id: "test-client",
        redirect_uri: "https://example.com/callback",
        response_type: "code" as const,
        code_challenge: "test-challenge",
        code_challenge_method: "S256" as const,
      };

      const result = ConsentParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("should reject invalid response_type", () => {
      const invalidParams = {
        client_id: "test-client",
        redirect_uri: "https://example.com/callback",
        response_type: "token", // Should be "code"
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
      };

      const result = ConsentParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should reject invalid code_challenge_method", () => {
      const invalidParams = {
        client_id: "test-client",
        redirect_uri: "https://example.com/callback",
        response_type: "code",
        code_challenge: "test-challenge",
        code_challenge_method: "plain", // Should be "S256"
      };

      const result = ConsentParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should validate optional consent_action enum", () => {
      const validParams = {
        client_id: "test-client",
        redirect_uri: "https://example.com/callback",
        response_type: "code" as const,
        code_challenge: "test-challenge",
        code_challenge_method: "S256" as const,
        consent_action: "approve" as const,
      };

      const result = ConsentParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });
  });
});
