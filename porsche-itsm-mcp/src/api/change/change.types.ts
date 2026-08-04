import { FilterExpression } from '../filter.types.js';
import { PaginationParams, PaginatedResponse } from '../pagination.types.js';
import { SortField } from '../sort.types.js';

export interface CreateChangeRequest {
  // Required fields
  upn: string;
  changeDescription: string;
  changeType: string;
  scheduledTiming: string;
  impactLevel: number;
  urgencyLevel: number;
  companyName: string;
  locationName: string;
  supportGroupName: string;
  supportOrgName: string;
  templateId: string;
}

export interface ChangeResponse {
  infrastructureChangeId: string;
}

// Change entry as returned by GET /change
export interface ChangeEntry {
  infrastructureChangeId: string;
  submitter?: string;
  upn: string;
  changeDescription: string;
  impactLevel: number;
  urgencyLevel: number;
  changeType: string;
  companyName: string;
  locationName: string;
  supportGroupName: string;
  supportOrgName: string;
  templateId: string;
  scheduledTiming?: string;
  status?: string;
  createdDate?: string;
  updatedDate?: string;
  [key: string]: any;
}

// Paginated response for change queries
export type ChangeListResponse = PaginatedResponse<ChangeEntry>;

// Parameters for querying changes with filters, pagination, and sorting
export interface GetChangesParams {
  /**
   * Filter expression using the ITSMHub filter syntax
   */
  filter?: FilterExpression;
  
  /**
   * Sort configuration
   */
  sort?: SortField[];
  
  /**
   * Pagination parameters
   */
  pagination?: PaginationParams;
}

// Task entry as returned by GET /change/{id}/tasks
export interface TaskEntry {
  taskId: string;
  taskName?: string;
  status?: string;
  assignedTo?: string;
  [key: string]: any;
}

// Paginated response for task queries
export type TaskListResponse = PaginatedResponse<TaskEntry>;

// Work log entry as returned by GET /change/{id}/worklogs or GET /change/{id}/task/{taskId}/worklogs
export interface WorkLogEntry {
  workLogId?: string;
  workInfoType?: string;
  viewAccess?: string;
  description?: string;
  submitter?: string;
  submitDate?: string;
  [key: string]: any;
}

// Paginated response for work log queries
export type WorkLogListResponse = PaginatedResponse<WorkLogEntry>;

// Parameters for querying tasks with filters, pagination, and sorting
export interface GetTasksParams {
  /**
   * Filter expression using the ITSMHub filter syntax
   */
  filter?: FilterExpression;
  
  /**
   * Sort configuration
   */
  sort?: SortField[];
  
  /**
   * Pagination parameters
   */
  pagination?: PaginationParams;
}

// Parameters for querying work logs with filters, pagination, and sorting
export interface GetWorkLogsParams {
  /**
   * Filter expression using the ITSMHub filter syntax
   */
  filter?: FilterExpression;
  
  /**
   * Sort configuration
   */
  sort?: SortField[];
  
  /**
   * Pagination parameters
   */
  pagination?: PaginationParams;
}

// Deprecated: keeping for backward compatibility
export interface ChangeFilter {
  // Add any filter parameters if available
  [key: string]: string | undefined;
}

// Deprecated: keeping for backward compatibility
export interface WorkLogFilter {
  workInfoType?: string;
  viewAccess?: string;
}
