import { callbackHandler } from "./callback.js";
import { DcrProxyOAuthServerProvider } from "../providers/dcrProxyProvider.js";
import {
  InvalidRequestError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import express from "express";
import request from "supertest";

// Mock the provider
const mockProvider = {
  callback: jest.fn(),
} as unknown as DcrProxyOAuthServerProvider;

describe("callbackHandler", () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a test Express app with the callback handler
    app = express();
    const handler = callbackHandler({ provider: mockProvider });
    app.use("/callback", handler);
  });

  describe("invalid callback params", () => {
    it("should return 400 error for missing required parameters", async () => {
      const response = await request(app)
        .get("/callback")
        .query({ invalidParam: "should not be here" });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "invalid_request",
        error_description: expect.stringContaining("OAuth callback error"),
      });
      expect(mockProvider.callback).not.toHaveBeenCalled();
    });

    it("should handle malformed query parameters gracefully", async () => {
      const response = await request(app).get("/callback").query({
        state: "",
        code: "",
        error: "invalid_request",
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "invalid_request",
        error_description: "OAuth callback error: invalid_request",
      });
      expect(mockProvider.callback).not.toHaveBeenCalled();
    });
  });

  describe("missing code parameter", () => {
    it("should return 400 error when code is missing", async () => {
      const response = await request(app).get("/callback").query({
        state: "valid-state",
        // code is missing
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "invalid_request",
        error_description: "OAuth callback error: access_denied",
      });
      expect(mockProvider.callback).not.toHaveBeenCalled();
    });

    it("should return 400 error when code is empty string", async () => {
      const response = await request(app).get("/callback").query({
        state: "valid-state",
        code: "",
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "invalid_request",
        error_description: "OAuth callback error: access_denied",
      });
      expect(mockProvider.callback).not.toHaveBeenCalled();
    });

    it("should use error parameter when code is missing and error is provided", async () => {
      const response = await request(app).get("/callback").query({
        state: "valid-state",
        error: "invalid_client",
        // code is missing
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "invalid_request",
        error_description: "OAuth callback error: invalid_client",
      });
      expect(mockProvider.callback).not.toHaveBeenCalled();
    });
  });

  describe("successful provider callback", () => {
    it("should call provider.callback with correct parameters", async () => {
      const validCode = "valid-authorization-code";
      const validState = "valid-state-parameter";

      // Mock successful provider callback that sends a response
      mockProvider.callback = jest
        .fn()
        .mockImplementation(async (params, res) => {
          res.status(200).json({ success: true });
        });

      const response = await request(app).get("/callback").query({
        code: validCode,
        state: validState,
      });

      expect(mockProvider.callback).toHaveBeenCalledWith(
        {
          code: validCode,
          state: validState,
        },
        expect.any(Object), // The response object
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it("should call provider.callback without state parameter when state is undefined", async () => {
      const validCode = "valid-authorization-code";

      // Mock successful provider callback that sends a response
      mockProvider.callback = jest
        .fn()
        .mockImplementation(async (params, res) => {
          res.status(200).json({ success: true });
        });

      const response = await request(app).get("/callback").query({
        code: validCode,
        // state is undefined
      });

      expect(mockProvider.callback).toHaveBeenCalledWith(
        {
          code: validCode,
          state: undefined,
        },
        expect.any(Object), // The response object
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  describe("provider callback errors", () => {
    it("should handle ServerError from provider callback", async () => {
      const validCode = "valid-authorization-code";
      const validState = "valid-state-parameter";

      // Mock provider callback to throw ServerError
      const serverError = new ServerError(
        "Missing state parameter in callback",
      );
      mockProvider.callback = jest.fn().mockRejectedValue(serverError);

      const response = await request(app).get("/callback").query({
        code: validCode,
        state: validState,
      });

      expect(mockProvider.callback).toHaveBeenCalledWith(
        {
          code: validCode,
          state: validState,
        },
        expect.any(Object),
      );
      expect(response.status).toBe(500);
      expect(response.body).toEqual(serverError.toResponseObject());
    });

    it("should handle InvalidRequestError from provider callback", async () => {
      const validCode = "valid-authorization-code";
      const validState = "valid-state-parameter";

      // Mock provider callback to throw InvalidRequestError
      const invalidRequestError = new InvalidRequestError(
        "Invalid authorization code",
      );
      mockProvider.callback = jest.fn().mockRejectedValue(invalidRequestError);

      const response = await request(app).get("/callback").query({
        code: validCode,
        state: validState,
      });

      expect(mockProvider.callback).toHaveBeenCalledWith(
        {
          code: validCode,
          state: validState,
        },
        expect.any(Object),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual(invalidRequestError.toResponseObject());
    });

    it("should handle non-OAuthError exceptions from provider callback", async () => {
      const validCode = "valid-authorization-code";
      const validState = "valid-state-parameter";

      // Mock provider callback to throw generic Error
      const genericError = new Error("Unexpected error");
      mockProvider.callback = jest.fn().mockRejectedValue(genericError);

      const response = await request(app).get("/callback").query({
        code: validCode,
        state: validState,
      });

      expect(mockProvider.callback).toHaveBeenCalledWith(
        {
          code: validCode,
          state: validState,
        },
        expect.any(Object),
      );
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: "server_error",
        error_description: "Internal Server Error",
      });
    });
  });

  describe("HTTP method validation", () => {
    it("should handle GET requests", async () => {
      const validCode = "valid-authorization-code";
      const validState = "valid-state-parameter";

      // Mock successful provider callback that sends a response
      mockProvider.callback = jest
        .fn()
        .mockImplementation(async (params, res) => {
          res.status(200).json({ success: true });
        });

      const response = await request(app).get("/callback").query({
        code: validCode,
        state: validState,
      });

      expect(mockProvider.callback).toHaveBeenCalledWith(
        {
          code: validCode,
          state: validState,
        },
        expect.any(Object),
      );
      expect(response.status).toBe(200);
    });

    it("should reject POST requests", async () => {
      const response = await request(app).post("/callback").send({
        code: "valid-code",
        state: "valid-state",
      });

      expect(response.status).toBe(405); // Method Not Allowed
      expect(mockProvider.callback).not.toHaveBeenCalled();
    });

    it("should reject PUT requests", async () => {
      const response = await request(app).put("/callback").send({
        code: "valid-code",
        state: "valid-state",
      });

      expect(response.status).toBe(405); // Method Not Allowed
      expect(mockProvider.callback).not.toHaveBeenCalled();
    });
  });

  describe("callbackHandler function", () => {
    it("should return an Express router", () => {
      const handler = callbackHandler({ provider: mockProvider });
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });
  });
});
