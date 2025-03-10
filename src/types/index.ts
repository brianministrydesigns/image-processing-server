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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, string>;
}

/**
 * Response from storage upload
 */
export interface StorageResult {
  url: string;
  key?: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

/**
 * Original file information for retry processing
 */
export interface OriginalFileInfo {
  id: string;
  originalKey: string;
  originalName: string;
  originalMimetype: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
}

/**
 * Retry processing request
 */
export interface RetryProcessingRequest {
  fileId: string;
  options?: ProcessingOptions;
}

/**
 * Preview response with both preview and original URLs
 */
export interface PreviewResponse {
  url: string;
  originalUrl?: string;
  fileId: string;
  thumbnailData?: string;
  processingNote?: string;
}
