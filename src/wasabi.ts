import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.WASABI_REGION,
  endpoint: process.env.WASABI_ENDPOINT,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY!,
    secretAccessKey: process.env.WASABI_SECRET_KEY!,
  },
  forcePathStyle: true, // Required for Wasabi
});

/**
 * Uploads a file to Wasabi S3
 */
export const uploadToWasabi = async (
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: bucket === process.env.PUBLIC_BUCKET ? "public-read" : "private",
  });

  return await s3.send(command);
};

/**
 * Generates a signed URL for retrieving an object from Wasabi
 */
export const getSignedUrlFromWasabi = async (key: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: process.env.PRIVATE_BUCKET,
    Key: key,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1-hour expiry
};
