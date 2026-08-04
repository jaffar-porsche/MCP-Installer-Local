import { allowedMethods } from "@modelcontextprotocol/sdk/server/auth/middleware/allowedMethods.js";
import { DcrProxyOAuthServerProvider } from "../providers/dcrProxyProvider.js";
import express, { RequestHandler } from "express";
import { z } from "zod";
import {
  InvalidRequestError,
  OAuthError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";

export type CallbackHandlerOptions = {
  provider: DcrProxyOAuthServerProvider;
};

export const RequestCallbackParamsSchema = z.object({
  state: z.string().optional(),
  code: z.string().optional(),
  error: z.string().optional(),
});

export function callbackHandler({
  provider,
}: CallbackHandlerOptions): RequestHandler {
  const router = express.Router();
  router.use(allowedMethods(["GET"]));

  router.all("/", async (req, res) => {
    try {
      const result = RequestCallbackParamsSchema.safeParse(req.query);
      if (!result.success) {
        throw new InvalidRequestError(result.error.message);
      }
      const { code, state } = result.data;
      if (!code) {
        const err = result.data.error || "access_denied";
        throw new InvalidRequestError(`OAuth callback error: ${err}`);
      }

      await provider.callback(
        {
          code,
          state,
        },
        res,
      );
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        const serverError = new ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
    }
  });

  return router;
}
