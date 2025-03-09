import { S3Client, PutObjectCommand, GetObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/config';
import { StorageOptions, StorageResult } from '../types';
import { logger } from '../utils/logger';

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
    const { bucket, key, contentType, isPublic = false } = options;

    logger.debug({ bucket, key, contentType }, 'Uploading file to Wasabi');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: options.buffer,
      ContentType: contentType,
      ACL: isPublic ? ObjectCannedACL.public_read : ObjectCannedACL.private,
    });

    await s3Client.send(command);

    const fileUrl = isPublic
      ? `https://${bucket}.s3.${config.wasabi.region}.wasabisys.com/${key}`
      : await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
          expiresIn: 3600,
        });

    logger.info({ url: fileUrl }, 'File uploaded successfully');

    return { url: fileUrl };
  } catch (error) {
    logger.error({ error }, 'Error uploading file to Wasabi');
    throw new Error(`Failed to upload file: ${(error as Error).message}`);
  }
};
