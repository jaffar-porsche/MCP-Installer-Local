import { FilterExpression } from '../filter.types.js';
import { PaginationParams, PaginatedResponse } from '../pagination.types.js';
import { SortField } from '../sort.types.js';

// Incident status values as per API specification
export type IncidentStatus = 
  | 'New'
  | 'Assigned'
  | 'In Progress'
  | 'Pending'
  | 'Resolved'
  | 'Closed'
  | 'Cancelled';

// Service type values as per API specification
export type ServiceType = 
  | 'User Service Restoration'
  | 'User Service Request'
  | 'Infrastructure Restoration'
  | 'Infrastructure Event'
  | 'Security Incident';

// Impact and urgency levels (1-4)
export type ImpactLevel = 1 | 2 | 3 | 4;
export type UrgencyLevel = 1 | 2 | 3 | 4;
export type CustomerPriority = 1 | 2 | 3 | 4;

// Interface for creating an incident (POST request)
export interface CreateIncidentRequest {
  title: string;
  status?: IncidentStatus;
  upn: string; // User Profile Number (Porsche login ID)
  serviceType?: ServiceType;
  impactLevel?: ImpactLevel;
  urgencyLevel?: UrgencyLevel;
  details: string;
  ciName?: string; // Configuration Item name
  assignedGroup: string;
  assignedSupportCompany: string;
  assignedSupportOrganization: string;
  customerPriority?: CustomerPriority;
  productCategorization?: string[]; // Up to 3 tiers
  reportedSource?: string;
}

// Interface for updating an incident (PUT request)
export interface UpdateIncidentRequest {
  title?: string;
  status?: IncidentStatus;
  requestorUserId?: string; // ITSM username of requestor
  serviceType?: ServiceType;
  impactLevel?: ImpactLevel;
  urgencyLevel?: UrgencyLevel;
  details?: string;
  ciName?: string;
  assignedGroup?: string;
  assignedSupportCompany?: string;
  assignedSupportOrganization?: string;
  customerPriority?: CustomerPriority;
  productCategorization?: string[];
  reportedSource?: string;
}

// Response from API (simplified - API returns string but we might parse it)
export interface IncidentResponse {
  id?: string;
  incidentNumber?: string;
  [key: string]: any;
}

// Incident entry as returned by GET /incident
export interface IncidentEntry {
  incidentNumber: string;
  title: string;
  details: string;
  assignedGroup: string;
  assignedSupportCompany: string;
  assignedSupportOrganization: string;
  upn: string;
  status: IncidentStatus;
  serviceType?: ServiceType;
  impactLevel?: ImpactLevel;
  urgencyLevel?: UrgencyLevel;
  ciName?: string;
  productCategorization?: string[];
  customerPriority?: CustomerPriority;
  reportedSource?: string;
  createdDate?: string;
  updatedDate?: string;
}

// Paginated response for incident queries
export type IncidentListResponse = PaginatedResponse<IncidentEntry>;

// Parameters for querying incidents with filters, pagination, and sorting
export interface GetIncidentsParams {
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
// Parameters for filtering incidents
export interface IncidentFilter {
  assignedGroup?: string;
  status?: IncidentStatus;
  [key: string]: any;
}

// Human-readable descriptions for levels
export const IMPACT_DESCRIPTIONS = {
  1: '1-extensive/widespread',
  2: '2-significant/large', 
  3: '3-moderate/limited',
  4: '4-minor/localized'
} as const;

export const URGENCY_DESCRIPTIONS = {
  1: '1-Critical',
  2: '2-High',
  3: '3-medium',
  4: '4-low'
} as const;

export const PRIORITY_DESCRIPTIONS = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low'
} as const;
