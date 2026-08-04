/**
 * Examples and tests for Filter, Pagination, and Sort functionality
 * This file demonstrates various use cases for querying incidents
 */

import { IncidentService } from './incident/incident.service.js';
import { FilterExpression } from './filter.types.js';
import { parseSortString } from './sort.types.js';
import { GetIncidentsParams } from './incident/incident.types.js';

// Mock client for examples (replace with actual DeveloperHubClient in production)
// import { DeveloperHubClient } from '../clients/DeveloperHubClient.js';
// const client = new DeveloperHubClient(...);
// const incidentService = new IncidentService(client);

/**
 * Example 1: Simple filter - Get all open incidents
 */
export async function example1_SimpleFilter(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      field: 'status',
      op: 'eq',
      value: 'open'
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 2: Wildcard search - Find incidents with "network" in title
 */
export async function example2_WildcardSearch(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      field: 'title',
      op: 'like',
      value: '%network%'
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 3: AND filter - High priority open incidents
 */
export async function example3_AndFilter(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      and: [
        { field: 'customerPriority', op: 'lt', value: 3 },
        { field: 'status', op: 'eq', value: 'open' }
      ]
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 4: OR filter - Multiple statuses
 */
export async function example4_OrFilter(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      or: [
        { field: 'status', op: 'eq', value: 'open' },
        { field: 'status', op: 'eq', value: 'In Progress' }
      ]
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 5: NOT filter - Exclude closed incidents
 */
export async function example5_NotFilter(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      not: {
        field: 'status',
        op: 'eq',
        value: 'Closed'
      }
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 6: Complex nested filter
 * High impact incidents that are either open or in progress, assigned to specific groups
 */
export async function example6_ComplexFilter(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      and: [
        { field: 'impactLevel', op: 'lt', value: 3 },
        {
          or: [
            { field: 'status', op: 'eq', value: 'open' },
            { field: 'status', op: 'eq', value: 'In Progress' }
          ]
        },
        {
          or: [
            { field: 'assignedGroup', op: 'eq', value: 'NewRelic' },
            { field: 'assignedGroup', op: 'eq', value: 'Platform' }
          ]
        }
      ]
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 7: Pagination - Get first page of results
 */
export async function example7_Pagination(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    pagination: {
      limit: 50,
      offset: 0
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 8: Navigate through pages
 */
export async function example8_NavigatePages(incidentService: IncidentService) {
  const results = [];
  let offset = 0;
  const limit = 25;
  
  while (true) {
    const response = await incidentService.getIncidents({
      pagination: { limit, offset }
    });
    
    results.push(...response.entries);
    
    // Check if there are more results
    if (!response.next || response.entries.length < limit) {
      break;
    }
    
    offset = response.next.offset;
  }
  
  return results;
}

/**
 * Example 9: Simple sorting - Sort by creation date
 */
export async function example9_SimpleSorting(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    sort: [
      { field: 'createdDate', order: 'desc' }
    ]
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 10: Multiple field sorting
 */
export async function example10_MultipleSorting(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    sort: [
      { field: 'customerPriority', order: 'asc' },
      { field: 'createdDate', order: 'desc' }
    ]
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 11: Parse sort string
 */
export async function example11_ParseSortString(incidentService: IncidentService) {
  const sortString = 'createdDate.desc,impactLevel.asc';
  
  const params: GetIncidentsParams = {
    sort: parseSortString(sortString)
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 12: Combine all features
 * Get high priority incidents from specific groups, sorted by date, paginated
 */
export async function example12_CombineAllFeatures(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      and: [
        { field: 'customerPriority', op: 'lt', value: 3 },
        {
          or: [
            { field: 'assignedGroup', op: 'eq', value: 'NewRelic' },
            { field: 'assignedGroup', op: 'eq', value: 'Platform' }
          ]
        },
        {
          not: {
            field: 'status',
            op: 'eq',
            value: 'Closed'
          }
        }
      ]
    },
    sort: [
      { field: 'customerPriority', order: 'asc' },
      { field: 'createdDate', order: 'desc' }
    ],
    pagination: {
      limit: 50,
      offset: 0
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 13: Search for urgent incidents with keyword
 */
export async function example13_UrgentKeywordSearch(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      and: [
        { field: 'urgencyLevel', op: 'eq', value: 1 },
        {
          or: [
            { field: 'title', op: 'like', value: '%critical%' },
            { field: 'title', op: 'like', value: '%urgent%' },
            { field: 'details', op: 'like', value: '%critical%' }
          ]
        }
      ]
    },
    sort: [
      { field: 'createdDate', order: 'desc' }
    ]
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 14: Get recent incidents for specific user
 */
export async function example14_UserRecentIncidents(
  incidentService: IncidentService,
  upn: string
) {
  const params: GetIncidentsParams = {
    filter: {
      field: 'upn',
      op: 'eq',
      value: upn
    },
    sort: [
      { field: 'updatedDate', order: 'desc' }
    ],
    pagination: {
      limit: 10,
      offset: 0
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 15: Dashboard query - Active incidents by priority
 */
export async function example15_DashboardQuery(incidentService: IncidentService) {
  const params: GetIncidentsParams = {
    filter: {
      or: [
        { field: 'status', op: 'eq', value: 'New' },
        { field: 'status', op: 'eq', value: 'Assigned' },
        { field: 'status', op: 'eq', value: 'In Progress' }
      ]
    },
    sort: [
      { field: 'customerPriority', order: 'asc' },
      { field: 'urgencyLevel', order: 'asc' },
      { field: 'impactLevel', order: 'asc' }
    ],
    pagination: {
      limit: 100,
      offset: 0
    }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 16: Build filter dynamically based on user input
 */
export function buildDynamicFilter(
  status?: string,
  assignedGroup?: string,
  minPriority?: number,
  searchKeyword?: string
): FilterExpression | undefined {
  const conditions: FilterExpression[] = [];
  
  if (status) {
    conditions.push({ field: 'status', op: 'eq', value: status });
  }
  
  if (assignedGroup) {
    conditions.push({ field: 'assignedGroup', op: 'eq', value: assignedGroup });
  }
  
  if (minPriority !== undefined) {
    conditions.push({ field: 'customerPriority', op: 'lt', value: minPriority });
  }
  
  if (searchKeyword) {
    conditions.push({
      or: [
        { field: 'title', op: 'like', value: `%${searchKeyword}%` },
        { field: 'details', op: 'like', value: `%${searchKeyword}%` }
      ]
    });
  }
  
  if (conditions.length === 0) {
    return undefined;
  }
  
  if (conditions.length === 1) {
    return conditions[0];
  }
  
  return { and: conditions };
}

/**
 * Example 17: Use dynamic filter
 */
export async function example17_DynamicFilter(incidentService: IncidentService) {
  const filter = buildDynamicFilter(
    'open',           // status
    'Platform',       // assignedGroup
    3,                // minPriority (< 3 means priority 1 or 2)
    'network'         // searchKeyword
  );
  
  const params: GetIncidentsParams = {
    filter,
    sort: [{ field: 'createdDate', order: 'desc' }],
    pagination: { limit: 25 }
  };
  
  return await incidentService.getIncidents(params);
}

/**
 * Example 18: Get count of results (first page only)
 */
export async function example18_GetCount(incidentService: IncidentService) {
  const response = await incidentService.getIncidents({
    filter: { field: 'status', op: 'eq', value: 'open' },
    pagination: { limit: 1, offset: 0 }
  });
  
  // Note: To get total count, you'd need to paginate through all results
  // or the API would need to provide a count endpoint
  return {
    hasResults: response.entries.length > 0,
    hasMore: !!response.next
  };
}

/**
 * Example 19: Export all incidents (with rate limiting)
 */
export async function example19_ExportAll(
  incidentService: IncidentService,
  delayMs: number = 1000
) {
  const allIncidents = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await incidentService.getIncidents({
      pagination: { limit, offset },
      sort: [{ field: 'incidentNumber', order: 'asc' }]
    });
    
    allIncidents.push(...response.entries);
    
    if (!response.next || response.entries.length < limit) {
      break;
    }
    
    offset = response.next.offset;
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  return allIncidents;
}

/**
 * Example 20: Filter by date range (if supported)
 */
export async function example20_DateRange(
  incidentService: IncidentService,
  startDate: string,
  endDate: string
) {
  const params: GetIncidentsParams = {
    filter: {
      and: [
        { field: 'createdDate', op: 'gt', value: startDate },
        { field: 'createdDate', op: 'lt', value: endDate }
      ]
    },
    sort: [{ field: 'createdDate', order: 'desc' }]
  };
  
  return await incidentService.getIncidents(params);
}
