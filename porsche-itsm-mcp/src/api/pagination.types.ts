/**
 * Pagination types for ITSM Hub API
 * Based on the ITSMHub REST API documentation
 */

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  /**
   * Number of results to return per page
   * Default: 20, Maximum: 1000
   */
  limit?: number;
  
  /**
   * Number of results to skip from the beginning
   * Default: 0
   */
  offset?: number;
}

/**
 * Pagination information in the response
 */
export interface PaginationInfo {
  /**
   * Suggested limit for the next page
   */
  limit: number;
  
  /**
   * Offset for the next page of results
   */
  offset: number;
}

/**
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /**
   * Array of result entries
   */
  entries: T[];
  
  /**
   * Pagination info for the next set of results
   * Only present if more results are available
   */
  next?: PaginationInfo;
}

/**
 * Constants for pagination
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 1000,
  DEFAULT_OFFSET: 0
} as const;

/**
 * Validates pagination parameters
 */
export function validatePaginationParams(params: PaginationParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (params.limit !== undefined) {
    if (params.limit < 1) {
      errors.push('limit must be at least 1');
    }
    if (params.limit > PAGINATION_DEFAULTS.MAX_LIMIT) {
      errors.push(`limit cannot exceed ${PAGINATION_DEFAULTS.MAX_LIMIT}`);
    }
  }

  if (params.offset !== undefined && params.offset < 0) {
    errors.push('offset cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes pagination parameters with defaults
 */
export function normalizePaginationParams(params?: PaginationParams): Required<PaginationParams> {
  return {
    limit: params?.limit ?? PAGINATION_DEFAULTS.DEFAULT_LIMIT,
    offset: params?.offset ?? PAGINATION_DEFAULTS.DEFAULT_OFFSET
  };
}

/**
 * Calculates the next pagination info
 */
export function calculateNextPagination(
  currentOffset: number,
  currentLimit: number,
  totalReturned: number,
  hasMore: boolean
): PaginationInfo | undefined {
  if (!hasMore || totalReturned < currentLimit) {
    return undefined;
  }

  return {
    limit: currentLimit,
    offset: currentOffset + currentLimit
  };
}
