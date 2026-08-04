/**
 * Attachment API Type Definitions
 * 
 * Based on api-specification-attachment-2.0.0.yaml
 * Provides types for downloading attachments from ITSM (BMC Helix/SmartIT)
 */

/**
 * Raw attachment file response from ITSM API
 * Contains file contents as byte array and transaction ID
 */
export interface AttachmentResponse {
  statusCode: number;
  body: {
    /**
     * Raw file contents as byte values (array of integers 0-255)
     */
    file: number[];
    /**
     * Transaction ID for the download operation
     */
    transactionId: string;
  };
}

/**
 * Parameters for getting an attachment
 */
export interface GetAttachmentParams {
  /**
   * BMC Helix or SmartIT URL of the attachment
   * Must be URL encoded
   * 
   * Example URLs:
   * - https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/TMS:WorkInfo/<worklog-id>/attach/z2AF_Attachment1
   * - URLs returned from incident/change worklog endpoints
   */
  url: string;
}

/**
 * Processed attachment data with metadata
 * Useful for saving files or converting to buffers
 */
export interface AttachmentData {
  /**
   * Raw file contents as byte array
   */
  bytes: number[];
  /**
   * Transaction ID from the API
   */
  transactionId: string;
  /**
   * Original URL used to download the attachment
   */
  sourceUrl: string;
  /**
   * File size in bytes
   */
  size: number;
}

/**
 * Convert byte array to Node.js Buffer
 * Useful for file operations
 */
export function bytesToBuffer(bytes: number[]): Buffer {
  return Buffer.from(bytes);
}

/**
 * Convert byte array to Base64 string
 * Useful for transmitting binary data
 */
export function bytesToBase64(bytes: number[]): string {
  return bytesToBuffer(bytes).toString('base64');
}

/**
 * Extract filename from attachment URL if possible
 * Falls back to generic name if extraction fails
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    // Try to get the last segment after 'attach/'
    const match = url.match(/attach\/([^/?#]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    
    // Try to get the last path segment
    const urlObj = new URL(url);
    const segments = urlObj.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      return decodeURIComponent(lastSegment);
    }
  } catch (error) {
    // URL parsing failed, use fallback
  }
  
  return 'attachment';
}

/**
 * Validate attachment URL format
 * Checks if URL appears to be a valid ITSM attachment URL
 */
export function validateAttachmentUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required and must be a string' };
  }

  if (url.trim().length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  // Check if it looks like a URL
  try {
    new URL(url);
  } catch (error) {
    return { valid: false, error: 'URL is not properly formatted' };
  }

  // Check if it contains expected ITSM patterns
  const isItsmUrl = url.includes('helix') || 
                    url.includes('smartit') || 
                    url.includes('itsm.porsche.services') ||
                    url.includes('attach');

  if (!isItsmUrl) {
    return { 
      valid: false, 
      error: 'URL does not appear to be an ITSM attachment URL. Expected URLs from BMC Helix or SmartIT.' 
    };
  }

  return { valid: true };
}

/**
 * Example attachment URLs for documentation and testing
 */
export const ATTACHMENT_URL_EXAMPLES = {
  helix_worklog: 'https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/TMS:WorkInfo/000000000001234/attach/z2AF_Attachment1',
  helix_incident: 'https://helix-preprod-restapi.itsm.porsche.services/api/arsys/v1.0/entry/HPD:IncidentInterface/INC000000012345/attach/screenshot.png',
  encoded_url: 'https%3A%2F%2Fhelix-preprod-restapi.itsm.porsche.services%2Fapi%2Farsys%2Fv1.0%2Fentry%2FTMS%3AWorkInfo%2F000000000001234%2Fattach%2Fz2AF_Attachment1',
} as const;
