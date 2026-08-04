import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ChangeService } from './change.service.js';
import { 
  CreateChangeRequest, 
  WorkLogFilter,
  GetChangesParams,
  GetTasksParams,
  GetWorkLogsParams
} from './change.types.js';
import { FilterExpression, FILTER_EXAMPLES } from '../filter.types.js';
import { parseSortString } from '../sort.types.js';
import { PAGINATION_DEFAULTS } from '../pagination.types.js';

export function createChangeTools(): Tool[] {
  return [
    {
      name: 'create_change',
      description: 'Create a new change request in ITSM',
      inputSchema: {
        type: 'object',
        properties: {
          upn: {
            type: 'string',
            description: 'Your Porsche login id (User Profile Number)'
          },
          changeDescription: {
            type: 'string',
            description: 'Description of the change'
          },
          changeType: {
            type: 'string',
            description: 'Type of change',
            default: 'Change'
          },
          scheduledTiming: {
            type: 'string',
            description: 'Scheduled timing for the change',
            default: 'Normal'
          },
          impactLevel: {
            type: 'integer',
            description: 'Impact level (1=extensive/widespread, 2=significant/large, 3=moderate/limited, 4=minor/localized)',
            minimum: 1,
            maximum: 4
          },
          urgencyLevel: {
            type: 'integer',
            description: 'Urgency level (1=Critical, 2=High, 3=Medium, 4=Low)',
            minimum: 1,
            maximum: 4
          },
          companyName: {
            type: 'string',
            description: 'Company name',
            default: 'Porsche'
          },
          locationName: {
            type: 'string',
            description: 'Location name',
            default: 'Porsche'
          },
          supportGroupName: {
            type: 'string',
            description: 'Support group responsible for the change'
          },
          supportOrgName: {
            type: 'string',
            description: 'Support organization',
            default: 'Platform'
          },
          templateId: {
            type: 'string',
            description: 'ID of template to be used for the change'
          }
        },
        required: [
          'upn',
          'changeDescription',
          'changeType',
          'scheduledTiming',
          'impactLevel',
          'urgencyLevel',
          'companyName',
          'locationName',
          'supportGroupName',
          'supportOrgName',
          'templateId'
        ]
      }
    },
    {
      name: 'get_changes',
      description: `Retrieve changes from Porsche ITSM system with advanced filtering, sorting, and pagination.
      
Filter Expression Examples:
- Simple: ${JSON.stringify(FILTER_EXAMPLES.simple)}
- Like: ${JSON.stringify(FILTER_EXAMPLES.like)}
- AND: ${JSON.stringify(FILTER_EXAMPLES.and)}
- OR: ${JSON.stringify(FILTER_EXAMPLES.or)}
- NOT: ${JSON.stringify(FILTER_EXAMPLES.not)}

Sort Examples:
- Single field: "createdDate.desc"
- Multiple fields: "createdDate.desc,impactLevel.asc"

Pagination:
- Default limit: ${PAGINATION_DEFAULTS.DEFAULT_LIMIT}
- Max limit: ${PAGINATION_DEFAULTS.MAX_LIMIT}`,
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            description: `Filter expression using JSON format. Supports:
- Simple comparison: { "field": "status", "op": "eq", "value": "open" }
- Operators: eq, ne, gt, lt, like (wildcard with %)
- AND group: { "and": [filter1, filter2] }
- OR group: { "or": [filter1, filter2] }
- NOT: { "not": filter }`
          },
          sort: {
            type: 'string',
            description: `Sort order specification. Format: "field1.order,field2.order"
Valid orders: asc, desc (defaults to asc)
Example: "createdDate.desc,supportGroupName.asc"`
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
      name: 'get_change',
      description: 'Get details of a specific change request',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Infrastructure Change ID (e.g., CRQ123456)'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'get_change_tasks',
      description: 'Get tasks associated with a change request with optional filtering, sorting, and pagination',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Infrastructure Change ID (e.g., CRQ123456)'
          },
          filter: {
            type: 'object',
            description: 'Filter expression for tasks'
          },
          sort: {
            type: 'string',
            description: 'Sort order (e.g., "status.asc")'
          },
          limit: {
            type: 'integer',
            description: `Results per page. Default: ${PAGINATION_DEFAULTS.DEFAULT_LIMIT}, Max: ${PAGINATION_DEFAULTS.MAX_LIMIT}`,
            minimum: 1,
            maximum: PAGINATION_DEFAULTS.MAX_LIMIT
          },
          offset: {
            type: 'integer',
            description: 'Pagination offset',
            minimum: 0
          }
        },
        required: ['id']
      }
    },
    {
      name: 'get_change_worklogs',
      description: 'Get work logs and comments for a change request with optional filtering, sorting, and pagination',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Infrastructure Change ID (e.g., CRQ123456)'
          },
          filter: {
            type: 'object',
            description: 'Filter expression for work logs'
          },
          sort: {
            type: 'string',
            description: 'Sort order (e.g., "submitDate.desc")'
          },
          limit: {
            type: 'integer',
            description: `Results per page. Default: ${PAGINATION_DEFAULTS.DEFAULT_LIMIT}, Max: ${PAGINATION_DEFAULTS.MAX_LIMIT}`,
            minimum: 1,
            maximum: PAGINATION_DEFAULTS.MAX_LIMIT
          },
          offset: {
            type: 'integer',
            description: 'Pagination offset',
            minimum: 0
          }
        },
        required: ['id']
      }
    },
    {
      name: 'get_task_worklogs',
      description: 'Get work logs for a specific task within a change request',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Infrastructure Change ID (e.g., CRQ123456)'
          },
          taskId: {
            type: 'string',
            description: 'Task ID (e.g., TAS123456)'
          },
          filter: {
            type: 'object',
            description: 'Filter expression for work logs'
          },
          sort: {
            type: 'string',
            description: 'Sort order (e.g., "submitDate.desc")'
          },
          limit: {
            type: 'integer',
            description: `Results per page. Default: ${PAGINATION_DEFAULTS.DEFAULT_LIMIT}, Max: ${PAGINATION_DEFAULTS.MAX_LIMIT}`,
            minimum: 1,
            maximum: PAGINATION_DEFAULTS.MAX_LIMIT
          },
          offset: {
            type: 'integer',
            description: 'Pagination offset',
            minimum: 0
          }
        },
        required: ['changeId', 'taskId']
      }
    }
  ];
}

export async function handleChangeTool(
  name: string,
  args: any,
  changeService: ChangeService
): Promise<any> {
  switch (name) {
    case 'create_change':
      return await changeService.createChange(args as CreateChangeRequest);
    
    case 'get_changes': {
      // Parse the arguments into GetChangesParams format
      const params: GetChangesParams = {};
      
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
      
      return await changeService.getChanges(params);
    }
    
    case 'get_change':
      const changeData = await changeService.getChange(args.id);
      return { data: changeData };
    
    case 'get_change_tasks': {
      const params: GetTasksParams = {};
      
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
      
      return await changeService.getChangeTasks(args.id, params);
    }
    
    case 'get_change_worklogs': {
      const params: GetWorkLogsParams = {};
      
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
      
      return await changeService.getChangeWorkLogs(args.id, params);
    }
    
    case 'get_task_worklogs': {
      const params: GetWorkLogsParams = {};
      
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
      
      return await changeService.getTaskWorkLogs(args.changeId, args.taskId, params);
    }
    
    default:
      throw new Error(`Unknown change tool: ${name}`);
  }
}
