import { DeveloperHubClient } from '../../clients/DeveloperHubClient.js';
import { getEnv } from '../../config/env.js';
import {
  CreateChangeRequest,
  ChangeResponse,
  WorkLogFilter,
  GetChangesParams,
  ChangeListResponse,
  GetTasksParams,
  TaskListResponse,
  GetWorkLogsParams,
  WorkLogListResponse
} from './change.types.js';
import { FilterExpression } from '../filter.types.js';
import { formatSortString } from '../sort.types.js';
import { normalizePaginationParams } from '../pagination.types.js';

export class ChangeService {
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
   * Create a new change in ITSM
   */
  async createChange(change: CreateChangeRequest): Promise<ChangeResponse> {
    try {
      const response = await this.client.post<ChangeResponse>('/change', change);
      return response;
    } catch (error) {
      throw new Error(`Failed to create change: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all changes with optional filtering, sorting, and pagination
   */
  async getChanges(params?: GetChangesParams): Promise<ChangeListResponse> {
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

      const response = await this.client.get<ChangeListResponse>(
        '/change',
        queryParams,
        this.getItsmHeaders()
      );
      
      return response;
    } catch (error) {
      throw new Error(`Failed to get changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific change by ID
   */
  async getChange(id: string): Promise<string> {
    try {
      const response = await this.client.get<string>(`/change/${id}`, undefined, this.getItsmHeaders());
      return response;
    } catch (error) {
      throw new Error(`Failed to get change ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get tasks for a specific change
   */
  async getChangeTasks(id: string, params?: GetTasksParams): Promise<TaskListResponse> {
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

      const response = await this.client.get<TaskListResponse>(
        `/change/${id}/tasks`,
        queryParams,
        this.getItsmHeaders()
      );
      
      return response;
    } catch (error) {
      throw new Error(`Failed to get change tasks for ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get tasks for a specific change (legacy method for backward compatibility)
   * @deprecated Use getChangeTasks with GetTasksParams instead
   */
  async getChangeTasksLegacy(id: string): Promise<string> {
    try {
      const response = await this.client.get<string>(`/change/${id}/tasks`, undefined, this.getItsmHeaders());
      return response;
    } catch (error) {
      throw new Error(`Failed to get change tasks for ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get work logs for a specific change
   */
  async getChangeWorkLogs(id: string, params?: GetWorkLogsParams): Promise<WorkLogListResponse> {
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

      const response = await this.client.get<WorkLogListResponse>(
        `/change/${id}/worklogs`,
        queryParams,
        this.getItsmHeaders()
      );
      
      return response;
    } catch (error) {
      throw new Error(`Failed to get change work logs for ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get work logs for a specific change (legacy method for backward compatibility)
   * @deprecated Use getChangeWorkLogs with GetWorkLogsParams instead
   */
  async getChangeWorkLogsLegacy(id: string, filter?: WorkLogFilter): Promise<string> {
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

      const response = await this.client.get<string>(`/change/${id}/worklogs`, params, this.getItsmHeaders());
      return response;
    } catch (error) {
      throw new Error(`Failed to get change work logs for ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get work logs for a specific task within a change
   */
  async getTaskWorkLogs(changeId: string, taskId: string, params?: GetWorkLogsParams): Promise<WorkLogListResponse> {
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

      const response = await this.client.get<WorkLogListResponse>(
        `/change/${changeId}/task/${taskId}/worklogs`,
        queryParams,
        this.getItsmHeaders()
      );
      
      return response;
    } catch (error) {
      throw new Error(`Failed to get task work logs for change ${changeId}, task ${taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
