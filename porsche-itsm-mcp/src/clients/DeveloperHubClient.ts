import axios, { AxiosInstance } from 'axios';
import { AppConfig } from '../config/index.js';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class DeveloperHubClient {
  private axiosInstance: AxiosInstance;
  private config: AppConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: AppConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.api.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-papi-client-id': config.auth.clientId
      }
    });

    // Add request interceptor to ensure token is valid
    this.axiosInstance.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    if (!this.accessToken || now >= this.tokenExpiry) {
      await this.refreshToken();
    }
  }

  private async refreshToken(): Promise<void> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.config.auth.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: this.config.auth.clientId,
        client_secret: this.config.auth.clientSecret,
        scope: this.config.auth.scope,
        grant_type: 'client_credentials'
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
    } catch (error) {
      throw new Error(`Failed to obtain access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async get<T>(path: string, params?: Record<string, any>, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await this.axiosInstance.get<T>(path, { 
      params,
      headers: extraHeaders ? { ...extraHeaders } : undefined
    });
    return response.data;
  }

  public async post<T>(path: string, data?: any, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await this.axiosInstance.post<T>(path, data, {
      headers: extraHeaders ? { ...extraHeaders } : undefined
    });
    return response.data;
  }

  public async put<T>(path: string, data?: any, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await this.axiosInstance.put<T>(path, data, {
      headers: extraHeaders ? { ...extraHeaders } : undefined
    });
    return response.data;
  }

  public async delete<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await this.axiosInstance.delete<T>(path, {
      headers: extraHeaders ? { ...extraHeaders } : undefined
    });
    return response.data;
  }
}
