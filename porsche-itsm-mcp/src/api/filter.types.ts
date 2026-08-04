/**
 * Filter expression types for ITSM Hub API queries
 * Based on the ITSMHub REST API documentation
 */

/**
 * Comparison operators supported by the API
 * - eq: equals
 * - ne: not equals
 * - gt: greater than
 * - lt: less than
 * - like: contains / matches substring, use % as wildcard character
 */
export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'like';

/**
 * Simple field comparison filter
 * Example: { "field": "status", "op": "eq", "value": "open" }
 */
export interface SimpleFilter {
  field: string;
  op: ComparisonOperator;
  value: string | number;
}

/**
 * AND logical operator - all conditions must be true
 * Example: { "and": [filter1, filter2] }
 */
export interface AndFilter {
  and: FilterExpression[];
}

/**
 * OR logical operator - at least one condition must be true
 * Example: { "or": [filter1, filter2] }
 */
export interface OrFilter {
  or: FilterExpression[];
}

/**
 * NOT logical operator - negates the condition
 * Example: { "not": { "field": "status", "op": "eq", "value": "closed" } }
 */
export interface NotFilter {
  not: FilterExpression;
}

/**
 * Recursive filter expression type
 * Can be a simple comparison or a combination of logical operators
 */
export type FilterExpression = SimpleFilter | AndFilter | OrFilter | NotFilter;

/**
 * Type guards for filter expressions
 */
export function isSimpleFilter(filter: FilterExpression): filter is SimpleFilter {
  return 'field' in filter && 'op' in filter && 'value' in filter;
}

export function isAndFilter(filter: FilterExpression): filter is AndFilter {
  return 'and' in filter;
}

export function isOrFilter(filter: FilterExpression): filter is OrFilter {
  return 'or' in filter;
}

export function isNotFilter(filter: FilterExpression): filter is NotFilter {
  return 'not' in filter;
}

/**
 * Validates a filter expression
 */
export function validateFilter(filter: any): filter is FilterExpression {
  if (!filter || typeof filter !== 'object') {
    return false;
  }

  if (isSimpleFilter(filter)) {
    return (
      typeof filter.field === 'string' &&
      ['eq', 'ne', 'gt', 'lt', 'like'].includes(filter.op) &&
      (typeof filter.value === 'string' || typeof filter.value === 'number')
    );
  }

  if (isAndFilter(filter)) {
    return Array.isArray(filter.and) && filter.and.every(validateFilter);
  }

  if (isOrFilter(filter)) {
    return Array.isArray(filter.or) && filter.or.every(validateFilter);
  }

  if (isNotFilter(filter)) {
    return validateFilter(filter.not);
  }

  return false;
}

/**
 * Example filter expressions for documentation
 */
export const FILTER_EXAMPLES = {
  simple: {
    field: 'status',
    op: 'eq' as const,
    value: 'open'
  },
  like: {
    field: 'title',
    op: 'like' as const,
    value: 'urgent%'
  },
  and: {
    and: [
      { field: 'status', op: 'eq' as const, value: 'open' },
      { field: 'priority', op: 'gt' as const, value: 2 }
    ]
  },
  or: {
    or: [
      { field: 'status', op: 'eq' as const, value: 'open' },
      { field: 'status', op: 'eq' as const, value: 'in_progress' }
    ]
  },
  not: {
    not: {
      field: 'status',
      op: 'eq' as const,
      value: 'closed'
    }
  },
  complex: {
    and: [
      { field: 'priority', op: 'gt' as const, value: 2 },
      {
        or: [
          { field: 'status', op: 'eq' as const, value: 'open' },
          { field: 'status', op: 'eq' as const, value: 'in_progress' }
        ]
      }
    ]
  }
};
