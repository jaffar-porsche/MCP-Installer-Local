function requiredEnv(env: string): string {
  const value = process.env[env];
  if (!value) {
    throw new Error(`Must define required environment variable '${env}'`);
  }
  return value;
}

export const config = {
  entraTenantId: requiredEnv("ENTRA_TENANT_ID"),
  entraClientId: requiredEnv("ENTRA_CLIENT_ID"),
  entraClientSecret: requiredEnv("ENTRA_CLIENT_SECRET"),
  sessionIdKey: requiredEnv("SESSION_ID_KEY"),
  entraAuthUrl: requiredEnv("ENTRA_AUTH_URL"),
  entraTokenUrl: requiredEnv("ENTRA_TOKEN_URL"),
};
