import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ObjectCannedACL,
  ListObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/config';
import { StorageOptions, StorageResult } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * S3 client for Wasabi storage
 */
const s3Client = new S3Client({
  region: config.wasabi.region,
  endpoint: config.wasabi.endpoint,
  credentials: {
    accessKeyId: config.wasabi.accessKey,
    secretAccessKey: config.wasabi.secretKey,
  },
  forcePathStyle: true,
});

/**
 * Uploads a file to Wasabi S3
 * @param options Upload options
 * @returns Storage result with URL
 */
export const uploadFile = async (options: StorageOptions): Promise<StorageResult> => {
  try {
    const { bucket, key, contentType, isPublic = false, metadata = {} } = options;

    logger.debug({ bucket, key, contentType }, 'Uploading file to Wasabi');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: options.buffer,
      ContentType: contentType,
      ACL: isPublic ? ObjectCannedACL.public_read : ObjectCannedACL.private,
      Metadata: metadata,
    });

    await s3Client.send(command);

    const fileUrl = isPublic
      ? `https://${bucket}.s3.${config.wasabi.region}.wasabisys.com/${key}`
      : await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
          expiresIn: 3600,
        });

    logger.info({ url: fileUrl }, 'File uploaded successfully');

    return { url: fileUrl, key };
  } catch (error) {
    logger.error({ error }, 'Error uploading file to Wasabi');
    throw error;
  }
};

/**
 * Stores the original file for potential retry processing
 * @param buffer Original file buffer
 * @param filename Original filename
 * @param mimetype Original mimetype
 * @returns File ID and storage result
 */
export const storeOriginalFile = async (
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<{ fileId: string; result: StorageResult }> => {
  try {
    const fileId = uuidv4();
    const extension = filename.split('.').pop() || 'bin';
    const key = `originals/${fileId}.${extension}`;

    logger.debug({ fileId, filename }, 'Storing original file');

    const result = await uploadFile({
      bucket: config.wasabi.privateBucket,
      key,
      buffer,
      contentType: mimetype,
      isPublic: false,
      metadata: {
        originalName: filename,
        originalMimetype: mimetype,
      },
    });

    logger.info({ fileId, key }, 'Original file stored successfully');

    return { fileId, result };
  } catch (error) {
    logger.error({ error }, 'Error storing original file');
    throw error;
  }
};

/**
 * Retrieves an original file for retry processing
 * @param fileId ID of the file to retrieve
 * @returns Buffer and metadata of the original file
 */
export const getOriginalFile = async (
  fileId: string,
): Promise<{ buffer: Buffer; filename: string; mimetype: string }> => {
  try {
    logger.debug({ fileId }, 'Retrieving original file');

    const files = await s3Client.send(
      new ListObjectsCommand({
        Bucket: config.wasabi.privateBucket,
        Prefix: `originals/${fileId}`,
      }),
    );

    if (!files.Contents || files.Contents.length === 0) {
      throw new Error(`Original file not found for ID: ${fileId}`);
    }

    const fileKey = files.Contents[0].Key;
    if (!fileKey) {
      throw new Error(`Original file key not found for ID: ${fileId}`);
    }

    const fileObj = await s3Client.send(
      new GetObjectCommand({
        Bucket: config.wasabi.privateBucket,
        Key: fileKey,
      }),
    );

    if (!fileObj.Body) {
      throw new Error(`Original file body not found for ID: ${fileId}`);
    }

    const buffer = await streamToBuffer(fileObj.Body);
    const filename = fileObj.Metadata?.originalName || `${fileId}.bin`;
    const mimetype =
      fileObj.Metadata?.originalMimetype || fileObj.ContentType || 'application/octet-stream';

    logger.info({ fileId, filename }, 'Original file retrieved successfully');

    return { buffer, filename, mimetype };
  } catch (error) {
    logger.error({ error, fileId }, 'Error retrieving original file');
    throw error;
  }
};

/**
 * Gets the URL for an original file
 * @param fileId ID of the file
 * @param extension File extension
 * @returns URL to the original file
 */
export const getOriginalFileUrl = (fileId: string, extension: string): string => {
  const key = `originals/${fileId}.${extension}`;
  return `https://${config.wasabi.privateBucket}.s3.${config.wasabi.region}.wasabisys.com/${key}`;
};

/**
 * Converts a stream to a buffer
 * @param stream Stream to convert
 * @returns Buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
