import { OAuthMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";

export type EntraOAuthMetadataParams = {
  tenantId: string;
};

export function entraOAuthMetadata(
  params: EntraOAuthMetadataParams,
): OAuthMetadata {
  return {
    issuer: `https://login.microsoftonline.com/${params.tenantId}/v2.0`,
    authorization_endpoint: `https://login.microsoftonline.com/${params.tenantId}/oauth2/v2.0/authorize`,
    token_endpoint: `https://login.microsoftonline.com/${params.tenantId}/oauth2/v2.0/token`,
    userinfo_endpoint: `https://graph.microsoft.com/oidc/userinfo`,
    response_modes_supported: ["query", "fragment", "form_post"],
    response_types_supported: [
      "code",
      "id_token",
      "code id_token",
      "id_token token",
    ],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
  };
}
