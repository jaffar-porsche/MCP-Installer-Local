import { DeveloperHubClient } from '../clients/DeveloperHubClient.js';
import { IncidentService } from '../api/incident/incident.service.js';
import { createIncidentTools, handleIncidentTool } from '../api/incident/incident.tools.js';
import { ChangeService } from '../api/change/change.service.js';
import { createChangeTools, handleChangeTool } from '../api/change/change.tools.js';
import { createAttachmentTools, handleAttachmentTool } from '../api/attachment/attachment.tools.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export function createAllTools(): Tool[] {
  return [
    ...createIncidentTools(),
    ...createChangeTools(),
    ...createAttachmentTools()
  ];
}

export async function handleToolCall(
  name: string,
  args: any,
  client: DeveloperHubClient
): Promise<any> {
  const incidentService = new IncidentService(client);
  const changeService = new ChangeService(client);
  
  // Check if it's an incident tool
  const incidentTools = ['create_incident', 'get_incidents', 'get_incident', 'update_incident'];
  if (incidentTools.includes(name)) {
    return await handleIncidentTool(name, args, incidentService);
  }
  
  // Check if it's a change tool
  const changeTools = ['create_change', 'get_changes', 'get_change', 'get_change_tasks', 'get_change_worklogs', 'get_task_worklogs'];
  if (changeTools.includes(name)) {
    return await handleChangeTool(name, args, changeService);
  }
  
  // Check if it's an attachment tool
  const attachmentTools = ['get_attachment', 'get_attachment_raw'];
  if (attachmentTools.includes(name)) {
    return await handleAttachmentTool(name, args, client);
  }
  
  throw new Error(`Unknown tool: ${name}`);
}
