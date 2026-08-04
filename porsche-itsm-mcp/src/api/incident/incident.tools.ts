import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { IncidentService } from './incident.service.js';
import {
  CreateIncidentRequest,
  UpdateIncidentRequest,
  IncidentFilter,
  GetIncidentsParams,
  IMPACT_DESCRIPTIONS,
  URGENCY_DESCRIPTIONS,
  PRIORITY_DESCRIPTIONS
} from './incident.types.js';
import { FilterExpression, FILTER_EXAMPLES } from '../filter.types.js';
import { parseSortString } from '../sort.types.js';
import { PAGINATION_DEFAULTS } from '../pagination.types.js';

export function createIncidentTools(): Tool[] {
  return [
    {
      name: 'create_incident',
      description: 'Create a new incident in Porsche ITSM system. Requires title, details, assigned support information, and user profile number (UPN).',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Brief title describing the incident'
          },
          details: {
            type: 'string',
            description: 'Detailed description of the incident'
          },
          upn: {
            type: 'string',
            description: 'User Profile Number (Porsche login ID) of the person reporting the incident'
          },
          assignedGroup: {
            type: 'string',
            description: 'Support group that should handle this incident'
          },
          assignedSupportCompany: {
            type: 'string',
            description: 'Support company (e.g., "Porsche")'
          },
          assignedSupportOrganization: {
            type: 'string',
            description: 'Support organization (e.g., "Platform")'
          },
          status: {
            type: 'string',
            enum: ['New', 'Assigned', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Cancelled'],
            description: 'Initial status of the incident',
            default: 'New'
          },
          serviceType: {
            type: 'string',
            enum: ['User Service Restoration', 'User Service Request', 'Infrastructure Restoration', 'Infrastructure Event', 'Security Incident'],
            description: 'Type of service request'
          },
          impactLevel: {
            type: 'integer',
            enum: [1, 2, 3, 4],
            description: `Impact level: ${Object.entries(IMPACT_DESCRIPTIONS).map(([k, v]) => `${k}=${v}`).join(', ')}`
          },
          urgencyLevel: {
            type: 'integer',
            enum: [1, 2, 3, 4],
            description: `Urgency level: ${Object.entries(URGENCY_DESCRIPTIONS).map(([k, v]) => `${k}=${v}`).join(', ')}`
          },
          customerPriority: {
            type: 'integer',
            enum: [1, 2, 3, 4],
            description: `Customer priority: ${Object.entries(PRIORITY_DESCRIPTIONS).map(([k, v]) => `${k}=${v}`).join(', ')}`
          },
          ciName: {
            type: 'string',
            description: 'Name of the associated Configuration Item'
          },
          productCategorization: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 3,
            description: 'Up to three tiers of product categorization (e.g., ["Software", "Application", "Container Software"])'
          },
          reportedSource: {
            type: 'string',
            description: 'How the incident was reported (default: "Other")'
          }
        },
        required: ['title', 'details', 'upn', 'assignedGroup', 'assignedSupportCompany', 'assignedSupportOrganization']
      }
    },
    
    {
      name: 'get_incidents',
      description: `Retrieve incidents from Porsche ITSM system with advanced filtering, sorting, and pagination.
      
Filter Expression Examples:
- Simple: ${JSON.stringify(FILTER_EXAMPLES.simple)}
- Like: ${JSON.stringify(FILTER_EXAMPLES.like)}
- AND: ${JSON.stringify(FILTER_EXAMPLES.and)}
- OR: ${JSON.stringify(FILTER_EXAMPLES.or)}
- NOT: ${JSON.stringify(FILTER_EXAMPLES.not)}
- Complex: ${JSON.stringify(FILTER_EXAMPLES.complex)}

Sort Examples:
- Single field: "createdDate.desc"
- Multiple fields: "createdDate.desc,impactLevel.asc"
- Default order (asc): "status"

Pagination:
- Default limit: ${PAGINATION_DEFAULTS.DEFAULT_LIMIT}
- Max limit: ${PAGINATION_DEFAULTS.MAX_LIMIT}
- Use offset for page navigation`,
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            description: `Filter expression using JSON format. Supports:
- Simple comparison: { "field": "status", "op": "eq", "value": "open" }
- Operators: eq (equals), ne (not equals), gt (greater than), lt (less than), like (wildcard with %)
- AND group: { "and": [filter1, filter2] }
- OR group: { "or": [filter1, filter2] }
- NOT: { "not": filter }
Can be nested for complex queries.`
          },
          sort: {
            type: 'string',
            description: `Sort order specification. Format: "field1.order,field2.order"
Valid fields: incidentNumber, title, status, createdDate, updatedDate, impactLevel, urgencyLevel, customerPriority, assignedGroup, upn, serviceType
Valid orders: asc, desc (defaults to asc if not specified)
Example: "createdDate.desc,impactLevel.asc"`
          },
          limit: {
            type: 'integer',
            description: `Number of results to return. Default: ${PAGINATION_DEFAULTS.DEFAULT_LIMIT}, Max: ${PAGINATION_DEFAULTS.MAX_LIMIT}`,
            minimum: 1,
            maximum: PAGINATION_DEFAULTS.MAX_LIMIT
          },
          offset: {
            type: 'integer',
            description: 'Number of results to skip (for pagination). Default: 0',
            minimum: 0
          }
        }
      }
    },

    {
      name: 'get_incident',
      description: 'Get details of a specific incident by its ID or incident number.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Either the Request ID or Incident Number of the incident'
          }
        },
        required: ['id']
      }
    },

    {
      name: 'update_incident',
      description: 'Update an existing incident in Porsche ITSM system.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Either the Request ID or Incident Number of the incident to update'
          },
          title: {
            type: 'string',
            description: 'Updated title for the incident'
          },
          status: {
            type: 'string',
            enum: ['New', 'Assigned', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Cancelled'],
            description: 'Updated status of the incident'
          },
          details: {
            type: 'string',
            description: 'Updated detailed description'
          },
          requestorUserId: {
            type: 'string',
            description: 'ITSM username of the requestor'
          },
          serviceType: {
            type: 'string',
            enum: ['User Service Restoration', 'User Service Request', 'Infrastructure Restoration', 'Infrastructure Event', 'Security Incident'],
            description: 'Updated service type'
          },
          impactLevel: {
            type: 'integer',
            enum: [1, 2, 3, 4],
            description: `Updated impact level: ${Object.entries(IMPACT_DESCRIPTIONS).map(([k, v]) => `${k}=${v}`).join(', ')}`
          },
          urgencyLevel: {
            type: 'integer',
            enum: [1, 2, 3, 4],
            description: `Updated urgency level: ${Object.entries(URGENCY_DESCRIPTIONS).map(([k, v]) => `${k}=${v}`).join(', ')}`
          },
          assignedGroup: {
            type: 'string',
            description: 'Updated assigned support group'
          },
          assignedSupportCompany: {
            type: 'string',
            description: 'Updated support company'
          },
          assignedSupportOrganization: {
            type: 'string',
            description: 'Updated support organization'
          },
          customerPriority: {
            type: 'integer',
            enum: [1, 2, 3, 4],
            description: `Updated customer priority: ${Object.entries(PRIORITY_DESCRIPTIONS).map(([k, v]) => `${k}=${v}`).join(', ')}`
          },
          ciName: {
            type: 'string',
            description: 'Updated Configuration Item name'
          },
          productCategorization: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 3,
            description: 'Updated product categorization'
          },
          reportedSource: {
            type: 'string',
            description: 'Updated reported source'
          }
        },
        required: ['id']
      }
    }
  ];
}

export async function handleIncidentTool(
  name: string,
  args: any,
  incidentService: IncidentService
): Promise<any> {
  switch (name) {
    case 'create_incident':
      return await incidentService.createIncident(args as CreateIncidentRequest);
      
    case 'get_incidents': {
      // Parse the arguments into GetIncidentsParams format
      const params: GetIncidentsParams = {};
      
      if (args.filter) {
        params.filter = args.filter as FilterExpression;
      }
      
      if (args.sort) {
        params.sort = parseSortString(args.sort);
      }
      
      if (args.limit !== undefined || args.offset !== undefined) {
        params.pagination = {
          limit: args.limit,
          offset: args.offset
        };
      }
      
      return await incidentService.getIncidents(params);
    }
      
    case 'get_incident':
      return await incidentService.getIncident(args.id);
      
    case 'update_incident':
      const { id, ...updates } = args;
      return await incidentService.updateIncident(id, updates as UpdateIncidentRequest);
      
    default:
      throw new Error(`Unknown incident tool: ${name}`);
  }
}
