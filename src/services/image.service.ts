import sharp from 'sharp';
import path from 'path';
import { ProcessingOptions, ProcessingResult } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * Creates a preview image with watermark
 * @param inputBuffer Original image buffer
 * @param options Processing options
 * @returns Processed image result
 */
export const createPreviewImage = async (
  inputBuffer: Buffer,
  options?: ProcessingOptions,
): Promise<ProcessingResult> => {
  try {
    logger.debug('Processing image preview');

    const width = options?.width || config.processing.imageWidth;
    const height = options?.height || config.processing.imageHeight;
    const quality = options?.quality || config.processing.imageQuality;

    const image = sharp(inputBuffer)
      .resize({
        width,
        height,
        fit: sharp.fit.contain,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality });

    const watermarkPath = path.join(process.cwd(), config.paths.watermark);
    const watermark = sharp(watermarkPath).resize({ width: 200 }).png();

    const [imageBuffer, watermarkBuffer] = await Promise.all([
      image.toBuffer(),
      watermark.toBuffer(),
    ]);

    const outputBuffer = await sharp(imageBuffer)
      .composite([
        {
          input: watermarkBuffer,
          gravity: 'center',
        },
      ])
      .webp({ quality })
      .toBuffer();

    logger.info('Image processing completed successfully');

    return {
      buffer: outputBuffer,
      contentType: 'image/webp',
      extension: 'webp',
    };
  } catch (error) {
    logger.error({ error }, 'Error processing image');
    throw new Error(`Failed to process image: ${(error as Error).message}`);
  }
};
