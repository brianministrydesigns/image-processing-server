/**
 * Application configuration
 * Centralizes all environment variables and provides defaults
 */
export const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  wasabi: {
    accessKey: process.env.WASABI_ACCESS_KEY || '',
    secretKey: process.env.WASABI_SECRET_KEY || '',
    region: process.env.WASABI_REGION || 'us-central-1',
    endpoint: process.env.WASABI_ENDPOINT || 'https://s3.us-central-1.wasabisys.com',
    privateBucket: process.env.WASABI_PRIVATE_BUCKET || '',
    publicBucket: process.env.WASABI_PUBLIC_BUCKET || '',
  },
  processing: {
    imageQuality: 80,
    imageWidth: 1920,
    imageHeight: 1080,
    videoPreset: 'veryfast',
    videoBitrate: '500k',
    audioBitrate: '64k',
  },
  paths: {
    watermark: process.env.WATERMARK_PATH || 'public/watermark.png',
  },
};

/**
 * Validates that all required configuration is present
 * @throws Error if any required configuration is missing
 */
export const validateConfig = (): void => {
  const requiredConfigs = [
    { key: 'wasabi.accessKey', value: config.wasabi.accessKey },
    { key: 'wasabi.secretKey', value: config.wasabi.secretKey },
    { key: 'wasabi.publicBucket', value: config.wasabi.publicBucket },
  ];

  const missingConfigs = requiredConfigs.filter((item) => !item.value);

  if (missingConfigs.length > 0) {
    const missingKeys = missingConfigs.map((item) => item.key).join(', ');
    throw new Error(`Missing required configuration: ${missingKeys}`);
  }
};
