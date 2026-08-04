/**
 * Attachment API MCP Tools
 * 
 * MCP (Model Context Protocol) tools for downloading attachments from ITSM
 * Based on api-specification-attachment-2.0.0.yaml
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DeveloperHubClient } from '../../clients/DeveloperHubClient.js';
import {
  getAttachment,
  getAttachmentAsBase64,
  getAttachmentAsBuffer,
} from './attachment.service.js';
import type { GetAttachmentParams } from './attachment.types.js';
import { ATTACHMENT_URL_EXAMPLES, extractFilenameFromUrl } from './attachment.types.js';

export function createAttachmentTools(): Tool[] {
  return [
    {
      name: 'get_attachment',
      description: `Download an attachment from ITSM (BMC Helix or SmartIT) using its URL.

Returns the attachment file as a Base64-encoded string, along with metadata including:
- File size in bytes
- Transaction ID from the API
- Original filename extracted from URL
- Source URL used for the download

The attachment URL must be obtained from other ITSM endpoints (incidents, changes, worklogs).
The URL will be automatically URL-encoded if needed.

**Common Use Cases:**
- Download incident attachments (screenshots, logs, documents)
- Download change request documentation
- Retrieve worklog attachments
- Access files referenced in ITSM tickets

**URL Format:**
URLs typically look like:
${ATTACHMENT_URL_EXAMPLES.helix_worklog}

**Important Notes:**
- URLs can be used directly from worklog responses (they contain attachment URLs)
- The tool handles URL encoding automatically
- Files are returned as Base64 for safe JSON transmission
- Use the filename to determine file type/extension

**Examples:**

1. Download a worklog attachment:
{
  "url": "${ATTACHMENT_URL_EXAMPLES.helix_worklog}"
}

2. Download an incident screenshot:
{
  "url": "${ATTACHMENT_URL_EXAMPLES.helix_incident}"
}

3. Download using already-encoded URL:
{
  "url": "${ATTACHMENT_URL_EXAMPLES.encoded_url}"
}`,
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: `BMC Helix or SmartIT URL of the attachment. Can be:
- Direct URL from ITSM API (will be auto-encoded)
- Already URL-encoded URL
- URL obtained from incident/change/worklog responses

Example: ${ATTACHMENT_URL_EXAMPLES.helix_worklog}`,
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'get_attachment_raw',
      description: `Download an attachment from ITSM and return raw byte array.

This is an alternative to get_attachment that returns the file as an array of integers (0-255)
instead of Base64. Use this when you need the raw bytes for processing.

Returns:
- Array of byte values (0-255)
- File size in bytes
- Transaction ID
- Filename extracted from URL

See get_attachment tool for detailed documentation on URLs and usage examples.`,
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: `BMC Helix or SmartIT URL of the attachment.
Example: ${ATTACHMENT_URL_EXAMPLES.helix_worklog}`,
          },
        },
        required: ['url'],
      },
    },
  ];
}
export async function handleGetAttachment(
  client: DeveloperHubClient,
  args: GetAttachmentParams
): Promise<{
  success: boolean;
  data?: {
    base64: string;
    filename: string;
    size: number;
    sizeFormatted: string;
    transactionId: string;
    sourceUrl: string;
  };
  error?: string;
}> {
  try {
    const result = await getAttachmentAsBase64(client, args);

    // Format file size in human-readable format
    const sizeFormatted = formatFileSize(result.size);

    return {
      success: true,
      data: {
        base64: result.base64,
        filename: result.filename,
        size: result.size,
        sizeFormatted,
        transactionId: result.transactionId,
        sourceUrl: result.sourceUrl,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error downloading attachment',
    };
  }
}

/**
 * Alternative tool for downloading attachment as raw bytes
 * Useful when the consumer prefers byte array over Base64
 */
export async function handleGetAttachmentRaw(
  client: DeveloperHubClient,
  args: GetAttachmentParams
): Promise<{
  success: boolean;
  data?: {
    bytes: number[];
    filename: string;
    size: number;
    sizeFormatted: string;
    transactionId: string;
    sourceUrl: string;
  };
  error?: string;
}> {
  try {
    const result = await getAttachment(client, args);
    const filename = extractFilenameFromUrl(args.url);
    const sizeFormatted = formatFileSize(result.body.file.length);

    return {
      success: true,
      data: {
        bytes: result.body.file,
        filename,
        size: result.body.file.length,
        sizeFormatted,
        transactionId: result.body.transactionId,
        sourceUrl: args.url,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error downloading attachment',
    };
  }
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Handle attachment tool calls
 */
export async function handleAttachmentTool(
  name: string,
  args: any,
  client: DeveloperHubClient
): Promise<any> {
  switch (name) {
    case 'get_attachment':
      return await handleGetAttachment(client, args);
    case 'get_attachment_raw':
      return await handleGetAttachmentRaw(client, args);
    default:
      throw new Error(`Unknown attachment tool: ${name}`);
  }
}
