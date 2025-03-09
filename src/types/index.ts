/**
 * Media processing options
 */
export interface ProcessingOptions {
  quality?: number;
  width?: number;
  height?: number;
}

/**
 * Response from media processing
 */
export interface ProcessingResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

/**
 * Storage options for uploading to Wasabi
 */
export interface StorageOptions {
  bucket: string;
  key: string;
  contentType: string;
  buffer: Buffer;
  isPublic?: boolean;
}

/**
 * Response from storage upload
 */
export interface StorageResult {
  url: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}
