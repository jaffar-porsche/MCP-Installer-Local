import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { allowedMethods } from "@modelcontextprotocol/sdk/server/auth/middleware/allowedMethods.js";
import { RequestHandler, Response } from "express";
import express from "express";
import z from "zod";
import {
  ClientApproval,
  ClientApprovalStoreFactory,
} from "../consent/consent.js";
import consent from "./views/consent.js";
import Handlebars from "handlebars";
import { OAuthClientInformationFullSchema } from "@modelcontextprotocol/sdk/shared/auth.js";

export const ConsentParamsSchema = z.object({
  client_id: z.string(),
  redirect_uri: z
    .string()
    .refine((value) => value === undefined || URL.canParse(value), {
      message: "redirect_uri must be a valid URL",
    }),
  response_type: z.literal("code"),
  code_challenge: z.string(),
  code_challenge_method: z.literal("S256"),
  scope: z.string().optional(),
  state: z.string().optional(),
  resource: z.string().url().optional(),
  consent_action: z.enum(["approve", "deny"]).optional(),
});

export const TemplateParamsSchema = z.object({
  params: ConsentParamsSchema.extend({
    client: OAuthClientInformationFullSchema,
  }),
  consent_url: z.string(),
});

export type ConsentParams = z.infer<typeof ConsentParamsSchema>;
export type TemplateParams = z.infer<typeof TemplateParamsSchema>;

export type ConsentHandlerOptions = {
  clientApprovalStoreFactory: ClientApprovalStoreFactory;
  clientsStore: OAuthRegisteredClientsStore;
  authorizePath: string;
  /**
   * Template function to render the consent page. If not provided, a default template will be used.
   */
  consentTemplate?: (params: TemplateParams) => string;
  consentPath: string;
};

function redirectToAuthorize(
  res: Response,
  authorizePath: string,
  params: ConsentParams,
) {
  const searchParams = new URLSearchParams({
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    response_type: "code",
    code_challenge_method: "S256",
  });
  if (params.scope) {
    searchParams.set("scope", params.scope);
  }
  if (params.code_challenge) {
    searchParams.set("code_challenge", params.code_challenge);
  }
  if (params.resource) {
    searchParams.set("resource", params.resource);
  }
  if (params.state) {
    searchParams.set("state", params.state);
  }
  res.redirect(`${authorizePath}?${searchParams.toString()}`);
  return;
}

const defaultConsentTemplate = Handlebars.compile<TemplateParams>(consent);

export function consentHandler({
  clientApprovalStoreFactory,
  clientsStore,
  authorizePath,
  consentTemplate = defaultConsentTemplate,
  consentPath,
}: ConsentHandlerOptions): RequestHandler {
  const router = express.Router();
  router.use(allowedMethods(["GET", "POST"]));
  router.use(express.urlencoded({ extended: false }));

  router.all("/", async (req, res) => {
    const result = ConsentParamsSchema.safeParse(
      req.method === "POST" ? req.body : req.query,
    );
    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }

    const client = await clientsStore.getClient(result.data.client_id);
    if (!client) {
      res.status(400).json({ error: "Invalid client_id" });
      return;
    }

    if (!client.redirect_uris.includes(result.data.redirect_uri)) {
      res.status(400).json({ error: "Invalid redirect_uri" });
      return;
    }

    const clientApprovalStore = clientApprovalStoreFactory(req);
    const approval = clientApprovalStore.getClientApproval(
      result.data.client_id,
      result.data.redirect_uri,
    );
    if (approval === ClientApproval.APPROVED) {
      redirectToAuthorize(res, authorizePath, result.data);
      return;
    }
    if (approval === ClientApproval.DENIED) {
      res.status(403).json({ error: "Client approval denied" });
      return;
    }

    if (!result.data.consent_action) {
      const consentView = consentTemplate({
        params: {
          client,
          ...result.data,
        },
        consent_url: consentPath,
      });

      res.set("Content-Type", "text/html");
      res.send(consentView);
      return;
    }

    if (result.data.consent_action === "approve") {
      clientApprovalStore.setClientApproval(
        res,
        result.data.client_id,
        result.data.redirect_uri,
        ClientApproval.APPROVED,
      );
      redirectToAuthorize(res, authorizePath, result.data);
      return;
    } else {
      clientApprovalStore.setClientApproval(
        res,
        result.data.client_id,
        result.data.redirect_uri,
        ClientApproval.DENIED,
      );
      res.status(403).json({ error: "Client approval denied" });
      return;
    }
  });

  return router;
}
