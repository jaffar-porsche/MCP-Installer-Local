import { RequestHandler } from "express";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { z } from "zod";
import express from "express";
import { allowedMethods } from "@modelcontextprotocol/sdk/server/auth/middleware/allowedMethods.js";
import {
  InvalidClientError,
  InvalidRequestError,
  OAuthError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  ClientApproval,
  ClientApprovalStoreFactory,
} from "../consent/consent.js";
import { DcrStore } from "../providers/dcrProxyProvider.js";
import { RequestCallbackParamsSchema } from "../handlers/callback.js";

export type ConsentCookieMiddlewareOptions = {
  clientApprovalStoreFactory: ClientApprovalStoreFactory;
  consentUrlOrPath: string | null; // only defined if redirect to consent page is desired, otherwise clients without approval will be rejected with 403
  clientsStore: OAuthRegisteredClientsStore;
  dcrStore: DcrStore;
};

export const ClientAuthorizationParamsSchema = z.object({
  client_id: z.string(),
  redirect_uri: z
    .string()
    .optional()
    .refine((value) => value === undefined || URL.canParse(value), {
      message: "redirect_uri must be a valid URL",
    }),
});

// Parameters that must be validated for a successful authorization request. Failure can be reported to the redirect URI.
export const RequestAuthorizationParamsSchema = z.object({
  response_type: z.literal("code"),
  code_challenge: z.string(),
  code_challenge_method: z.literal("S256"),
  scope: z.string().optional(),
  state: z.string().optional(),
  resource: z.string().url().optional(),
});

export function requireConsentCookie({
  clientApprovalStoreFactory,
  consentUrlOrPath: consentUrl,
  clientsStore,
  dcrStore,
}: ConsentCookieMiddlewareOptions): RequestHandler {
  const router = express.Router();

  router.use(allowedMethods(["GET", "POST"]));
  router.use(express.urlencoded({ extended: false }));

  return async (req, res, next) => {
    let client_id, redirect_uri, client;
    try {
      const authRequestParams = ClientAuthorizationParamsSchema.safeParse(
        req.method === "POST" ? req.body : req.query,
      );
      const callbackRequestParms = RequestCallbackParamsSchema.safeParse(
        req.method === "POST" ? req.body : req.query,
      );
      if (authRequestParams.success) {
        client_id = authRequestParams.data.client_id;
        redirect_uri = authRequestParams.data.redirect_uri;
      } else if (callbackRequestParms.success) {
        const code = await dcrStore.getStateCode(
          callbackRequestParms.data.state || "",
        );
        const auth = await dcrStore.getAuth(code || "");

        client_id = auth?.clientClientId;
        redirect_uri = auth?.clientCallbackRedirectUri;
      } else {
        throw new InvalidRequestError(
          authRequestParams.error.message +
            " " +
            callbackRequestParms.error.message,
        );
      }

      if (!client_id) {
        throw new InvalidRequestError("Invalid client_id");
      }

      client = await clientsStore.getClient(client_id);
      if (!client) {
        throw new InvalidClientError("Invalid client_id");
      }

      if (redirect_uri !== undefined) {
        if (!client.redirect_uris.includes(redirect_uri)) {
          throw new InvalidRequestError("Unregistered redirect_uri");
        }
      } else if (client.redirect_uris.length === 1) {
        redirect_uri = client.redirect_uris[0];
      } else {
        throw new InvalidRequestError(
          "redirect_uri must be specified when client has multiple registered URIs",
        );
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        const serverError = new ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }

      return;
    }

    const clientApprovalStore = clientApprovalStoreFactory(req);
    const approval = clientApprovalStore.getClientApproval(
      client_id,
      redirect_uri,
    );
    if (approval === ClientApproval.APPROVED) {
      next();
      return;
    }
    if (approval === ClientApproval.DENIED) {
      res.status(403).json({ error: "Client approval denied" });
      return;
    }
    if (!consentUrl) {
      res.status(403).json({ error: "Client not approved" });
      return;
    }
    try {
      // Parse and validate authorization parameters
      const parseResult = RequestAuthorizationParamsSchema.safeParse(
        req.method === "POST" ? req.body : req.query,
      );
      if (!parseResult.success) {
        throw new InvalidRequestError(parseResult.error.message);
      }

      const { scope, code_challenge, resource, state } = parseResult.data;

      const searchParams = new URLSearchParams({
        client_id,
        redirect_uri,
        response_type: "code",
        code_challenge_method: "S256",
      });
      if (scope) {
        searchParams.set("scope", scope);
      }
      if (code_challenge) {
        searchParams.set("code_challenge", code_challenge);
      }
      if (resource) {
        searchParams.set("resource", resource);
      }
      if (state) {
        searchParams.set("state", state);
      }

      res.redirect(`${consentUrl}?${searchParams.toString()}`);
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        const serverError = new ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }

      return;
    }
  };
}
