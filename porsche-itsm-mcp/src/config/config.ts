import { getEnv, validateEnv } from './env.js';

export interface AppConfig {
  auth: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    scope: string;
  };
  api: {
    baseUrl: string;
  };
}

export function createConfig(): AppConfig {
  validateEnv();
  
  // Get fresh environment values
  const env = getEnv();
  
  return {
    auth: {
      tenantId: env.PORSCHE_TENANT_ID,
      clientId: env.ENTRA_CLIENT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
      scope: `${env.ENTRA_CLIENT_ID}/.default`
    },
    api: {
      baseUrl: env.API_BASE_URL,
    }
  };
}
