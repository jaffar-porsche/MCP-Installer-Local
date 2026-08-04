import { DeveloperHubClient } from '../../clients/DeveloperHubClient.js';
import { getEnv } from '../../config/env.js';
import {
  CreateIncidentRequest,
  UpdateIncidentRequest,
  IncidentResponse,
  IncidentFilter,
  GetIncidentsParams,
  IncidentListResponse
} from './incident.types.js';
import { FilterExpression } from '../filter.types.js';
import { formatSortString } from '../sort.types.js';
import { normalizePaginationParams } from '../pagination.types.js';

export class IncidentService {
  constructor(private client: DeveloperHubClient) {}

  /**
   * Get ITSM headers required for read operations
   */
  private getItsmHeaders(): Record<string, string> {
    const env = getEnv();
    return {
      'itsmUser': env.ITSM_USER,
      'itsmPassword': env.ITSM_PASSWORD
    };
  }

  /**
   * Serializes a FilterExpression into a JSON string for the API
   */
  private serializeFilter(filter: FilterExpression): string {
    return JSON.stringify(filter);
  }

  /**
   * Create a new incident in ITSM
   */
  async createIncident(incident: CreateIncidentRequest): Promise<IncidentResponse> {
    try {
      const response = await this.client.post<string>('/incident', incident);
      return { id: response };
    } catch (error) {
      throw new Error(`Failed to create incident: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all incidents with optional filtering, sorting, and pagination
   */
  async getIncidents(params?: GetIncidentsParams): Promise<IncidentListResponse> {
    try {
      const queryParams: Record<string, string> = {};
      
      // Add filter if provided
      if (params?.filter) {
        queryParams.filter = this.serializeFilter(params.filter);
      }

      // Add sort if provided
      if (params?.sort && params.sort.length > 0) {
        queryParams.sort = formatSortString(params.sort);
      }

      // Add pagination parameters
      const pagination = normalizePaginationParams(params?.pagination);
      queryParams.limit = pagination.limit.toString();
      queryParams.offset = pagination.offset.toString();

      const response = await this.client.get<IncidentListResponse>(
        '/incident',
        queryParams,
        this.getItsmHeaders()
      );
      
      return response;
    } catch (error) {
      throw new Error(`Failed to get incidents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all incidents with optional filtering (legacy method for backward compatibility)
   * @deprecated Use getIncidents with GetIncidentsParams instead
   */
  async getIncidentsLegacy(filter?: IncidentFilter): Promise<IncidentResponse[]> {
    try {
      const params: Record<string, string> = {};
      
      if (filter) {
        // Build filter query string as per API spec
        const filterParts: string[] = [];
        for (const [key, value] of Object.entries(filter)) {
          if (value !== undefined) {
            filterParts.push(`'${key}'="${value}"`);
          }
        }
        if (filterParts.length > 0) {
          params.filter = filterParts.join(' AND ');
        }
      }

      const response = await this.client.get<string>('/incident', params, this.getItsmHeaders());
      return [{ id: response }];
    } catch (error) {
      throw new Error(`Failed to get incidents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific incident by ID
   */
  async getIncident(id: string): Promise<IncidentResponse> {
    try {
      const response = await this.client.get<string>(`/incident/${id}`, undefined, this.getItsmHeaders());
      return { id: response };
    } catch (error) {
      throw new Error(`Failed to get incident ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing incident
   */
  async updateIncident(id: string, updates: UpdateIncidentRequest): Promise<IncidentResponse> {
    try {
      const response = await this.client.put<string>(`/incident/${id}`, updates, this.getItsmHeaders());
      return { id: response };
    } catch (error) {
      throw new Error(`Failed to update incident ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
