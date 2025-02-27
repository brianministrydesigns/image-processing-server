"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignedUrlFromWasabi = exports.uploadToWasabi = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const s3 = new client_s3_1.S3Client({
    region: process.env.WASABI_REGION,
    endpoint: process.env.WASABI_ENDPOINT,
    credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY,
        secretAccessKey: process.env.WASABI_SECRET_KEY,
    },
    forcePathStyle: true, // Required for Wasabi
});
/**
 * Uploads a file to Wasabi S3
 */
const uploadToWasabi = async (bucket, key, buffer, contentType) => {
    const command = new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: bucket === process.env.PUBLIC_BUCKET ? "public-read" : "private",
    });
    return await s3.send(command);
};
exports.uploadToWasabi = uploadToWasabi;
/**
 * Generates a signed URL for retrieving an object from Wasabi
 */
const getSignedUrlFromWasabi = async (key) => {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: process.env.PRIVATE_BUCKET,
        Key: key,
    });
    return await (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: 3600 }); // 1-hour expiry
};
exports.getSignedUrlFromWasabi = getSignedUrlFromWasabi;
