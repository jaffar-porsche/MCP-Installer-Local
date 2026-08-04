import { DeveloperHubClient } from '../src/clients/DeveloperHubClient.js';
import { createConfig } from '../src/config/index.js';
import axios from 'axios';

// Real authentication tests against Entra ID
// Uses actual credentials from test.env to test token flow
describe('DeveloperHubClient - Entra ID Authentication', () => {
  let client: DeveloperHubClient;
  let config: any;
  
  beforeEach(() => {
    config = createConfig();
  });

  afterEach(() => {
    // Clean up any modifications
    jest.clearAllMocks();
  });

  test('should initialize configuration', () => {
    client = new DeveloperHubClient(config);
    expect(client).toBeInstanceOf(DeveloperHubClient);
  });

  test('should obtain real access token from Entra ID', async () => {
    // This test makes a real HTTP request to Microsoft Entra ID
    const tokenUrl = `https://login.microsoftonline.com/${config.auth.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: config.auth.clientId,
      client_secret: config.auth.clientSecret,
      scope: config.auth.scope,
      grant_type: 'client_credentials'
    });

    try {
      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000 // 10 second timeout
      });

      // Verify token response structure
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('access_token');
      expect(response.data).toHaveProperty('token_type');
      expect(response.data).toHaveProperty('expires_in');
      expect(response.data.token_type).toBe('Bearer');
      expect(typeof response.data.access_token).toBe('string');
      expect(response.data.access_token.length).toBeGreaterThan(0);
      expect(typeof response.data.expires_in).toBe('number');
      expect(response.data.expires_in).toBeGreaterThan(0);

      console.log('✅ Successfully obtained Entra ID token');
      console.log(`Token type: ${response.data.token_type}`);
      console.log(`Expires in: ${response.data.expires_in} seconds`);
      console.log(`Token length: ${response.data.access_token.length} characters`);
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Entra ID authentication failed:');
        console.error(`Status: ${error.response?.status}`);
        console.error(`Data:`, error.response?.data);
        console.error(`Config:`, {
          clientId: config.auth.clientId,
          scope: config.auth.scope,
          tenantId: config.auth.tenantId
        });
      }
      throw error;
    }
  }, 15000); // 15 second timeout for this test

});
