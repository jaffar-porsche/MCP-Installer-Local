/**
 * Attachment API Service
 * 
 * Service layer for downloading attachments from ITSM (BMC Helix/SmartIT)
 * Based on api-specification-attachment-2.0.0.yaml
 */

import { DeveloperHubClient } from '../../clients/DeveloperHubClient.js';
import type {
  AttachmentResponse,
  GetAttachmentParams,
  AttachmentData,
} from './attachment.types.js';
import { validateAttachmentUrl, extractFilenameFromUrl } from './attachment.types.js';

/**
 * Download an attachment from ITSM using the provided URL
 * 
 * @param client - DeveloperHubClient instance
 * @param params - Parameters including the attachment URL
 * @returns Attachment response with raw file bytes and transaction ID
 * @throws Error if URL is invalid or download fails
 * 
 * @example
 * ```typescript
 * const response = await getAttachment(client, {
 *   url: 'https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/TMS:WorkInfo/123/attach/file.pdf'
 * });
 * console.log(`Downloaded ${response.body.file.length} bytes`);
 * ```
 */
export async function getAttachment(
  client: DeveloperHubClient,
  params: GetAttachmentParams
): Promise<AttachmentResponse> {
  // Validate the attachment URL
  const validation = validateAttachmentUrl(params.url);
  if (!validation.valid) {
    throw new Error(`Invalid attachment URL: ${validation.error}`);
  }

  // URL encode the attachment URL for the path parameter
  const encodedUrl = encodeURIComponent(params.url);
  
  // Make the API request
  const response = await client.get<AttachmentResponse>(
    `/attachment/${encodedUrl}`
  );

  return response;
}

/**
 * Download an attachment and return processed data with metadata
 * 
 * @param client - DeveloperHubClient instance
 * @param params - Parameters including the attachment URL
 * @returns Processed attachment data with metadata
 * @throws Error if URL is invalid or download fails
 * 
 * @example
 * ```typescript
 * const data = await getAttachmentData(client, {
 *   url: 'https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/TMS:WorkInfo/123/attach/report.pdf'
 * });
 * 
 * console.log(`File: ${extractFilenameFromUrl(data.sourceUrl)}`);
 * console.log(`Size: ${data.size} bytes`);
 * 
 * // Convert to Buffer for file operations
 * const buffer = Buffer.from(data.bytes);
 * await fs.writeFile('report.pdf', buffer);
 * ```
 */
export async function getAttachmentData(
  client: DeveloperHubClient,
  params: GetAttachmentParams
): Promise<AttachmentData> {
  const response = await getAttachment(client, params);

  return {
    bytes: response.body.file,
    transactionId: response.body.transactionId,
    sourceUrl: params.url,
    size: response.body.file.length,
  };
}

/**
 * Download an attachment and convert to Base64 string
 * Useful for embedding in JSON or transmitting over text-based protocols
 * 
 * @param client - DeveloperHubClient instance
 * @param params - Parameters including the attachment URL
 * @returns Object with Base64 encoded file and metadata
 * @throws Error if URL is invalid or download fails
 * 
 * @example
 * ```typescript
 * const result = await getAttachmentAsBase64(client, {
 *   url: 'https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/TMS:WorkInfo/123/attach/image.png'
 * });
 * 
 * // Use in data URL
 * const dataUrl = `data:image/png;base64,${result.base64}`;
 * ```
 */
export async function getAttachmentAsBase64(
  client: DeveloperHubClient,
  params: GetAttachmentParams
): Promise<{
  base64: string;
  transactionId: string;
  sourceUrl: string;
  size: number;
  filename: string;
}> {
  const data = await getAttachmentData(client, params);
  const buffer = Buffer.from(data.bytes);
  const base64 = buffer.toString('base64');

  return {
    base64,
    transactionId: data.transactionId,
    sourceUrl: data.sourceUrl,
    size: data.size,
    filename: extractFilenameFromUrl(data.sourceUrl),
  };
}

/**
 * Download an attachment and return as Buffer
 * Most convenient for file operations in Node.js
 * 
 * @param client - DeveloperHubClient instance
 * @param params - Parameters including the attachment URL
 * @returns Object with Buffer and metadata
 * @throws Error if URL is invalid or download fails
 * 
 * @example
 * ```typescript
 * import fs from 'fs/promises';
 * 
 * const result = await getAttachmentAsBuffer(client, {
 *   url: 'https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/TMS:WorkInfo/123/attach/document.pdf'
 * });
 * 
 * // Save to file
 * await fs.writeFile(result.filename, result.buffer);
 * console.log(`Saved ${result.size} bytes to ${result.filename}`);
 * ```
 */
export async function getAttachmentAsBuffer(
  client: DeveloperHubClient,
  params: GetAttachmentParams
): Promise<{
  buffer: Buffer;
  transactionId: string;
  sourceUrl: string;
  size: number;
  filename: string;
}> {
  const data = await getAttachmentData(client, params);
  const buffer = Buffer.from(data.bytes);

  return {
    buffer,
    transactionId: data.transactionId,
    sourceUrl: data.sourceUrl,
    size: data.size,
    filename: extractFilenameFromUrl(data.sourceUrl),
  };
}
