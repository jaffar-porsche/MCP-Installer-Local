/**
 * Sort types for ITSM Hub API
 * Based on the ITSMHub REST API documentation
 */

/**
 * Sort order: ascending or descending
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Single sort field with order
 */
export interface SortField {
  /**
   * Field name to sort by
   */
  field: string;
  
  /**
   * Sort order (asc or desc)
   * Default: asc
   */
  order?: SortOrder;
}

/**
 * Sort parameters - can be a single field or multiple fields
 */
export type SortParams = SortField | SortField[];

/**
 * Parses a sort string into SortField objects
 * Format: "field1.order,field2.order,field3"
 * Example: "createdDate.desc,impactLevel.asc"
 * 
 * @param sortString - The sort string from query parameter
 * @returns Array of SortField objects
 */
export function parseSortString(sortString: string): SortField[] {
  if (!sortString || sortString.trim() === '') {
    return [];
  }

  return sortString
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => {
      const [field, order] = part.split('.');
      return {
        field: field.trim(),
        order: (order?.trim().toLowerCase() as SortOrder) || 'asc'
      };
    });
}

/**
 * Converts SortField array to query string format
 * Example: [{ field: "createdDate", order: "desc" }] => "createdDate.desc"
 * 
 * @param sortFields - Array of sort fields
 * @returns Formatted sort string for API query
 */
export function formatSortString(sortFields: SortField[]): string {
  return sortFields
    .map(({ field, order }) => {
      const orderSuffix = order && order !== 'asc' ? `.${order}` : '';
      return `${field}${orderSuffix}`;
    })
    .join(',');
}

/**
 * Validates sort fields
 */
export function validateSortFields(
  sortFields: SortField[],
  validFields?: string[]
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const sortField of sortFields) {
    if (!sortField.field || typeof sortField.field !== 'string') {
      errors.push('Sort field name is required and must be a string');
      continue;
    }

    if (sortField.order && !['asc', 'desc'].includes(sortField.order)) {
      errors.push(`Invalid sort order "${sortField.order}" for field "${sortField.field}". Must be "asc" or "desc"`);
    }

    if (validFields && !validFields.includes(sortField.field)) {
      errors.push(`Invalid sort field "${sortField.field}". Valid fields: ${validFields.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Common sortable fields for incidents
 */
export const INCIDENT_SORTABLE_FIELDS = [
  'incidentNumber',
  'title',
  'status',
  'createdDate',
  'updatedDate',
  'impactLevel',
  'urgencyLevel',
  'customerPriority',
  'assignedGroup',
  'assignedSupportCompany',
  'assignedSupportOrganization',
  'upn',
  'serviceType'
] as const;

/**
 * Example sort configurations
 */
export const SORT_EXAMPLES = {
  singleField: 'createdDate.desc',
  multipleFields: 'createdDate.desc,impactLevel.asc',
  defaultOrder: 'status', // defaults to asc
  parsed: [
    { field: 'createdDate', order: 'desc' as const },
    { field: 'impactLevel', order: 'asc' as const }
  ]
};
