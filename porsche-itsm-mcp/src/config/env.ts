import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a function to get current environment values
// This ensures we always get the latest values from process.env
export const getEnv = () => ({
  ENTRA_CLIENT_ID: process.env.ENTRA_CLIENT_ID || '',
  ENTRA_CLIENT_SECRET: process.env.ENTRA_CLIENT_SECRET || '',
  API_BASE_URL: process.env.API_BASE_URL || '',
  PORSCHE_TENANT_ID: "56564e0f-83d3-4b52-92e8-a6bb9ea36564",
  ITSM_USER: process.env.ITSM_USER || '',
  ITSM_PASSWORD: process.env.ITSM_PASSWORD || ''
});

// Export env as a dynamic getter for backwards compatibility
export const env = getEnv();

// Validate required environment variables
export function validateEnv(): void {
  const currentEnv = getEnv();
  const required = ['ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'API_BASE_URL', 'ITSM_USER', 'ITSM_PASSWORD'];
  const missing = required.filter(key => !currentEnv[key as keyof typeof currentEnv]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
