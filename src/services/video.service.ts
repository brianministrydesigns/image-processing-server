import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { Readable, PassThrough } from 'stream';
import sharp from 'sharp';
import { ProcessingOptions, ProcessingResult } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execPromise = promisify(exec);

// Check if ffmpeg is available
let ffmpegAvailable = false;
let ffmpegVersion = '';

// Function to check if ffmpeg is installed
async function checkFfmpegAvailability() {
  try {
    // Try to get ffmpeg version
    const { stdout } = await execPromise('ffmpeg -version');
    ffmpegAvailable = true;
    ffmpegVersion = stdout.split('\n')[0];
    logger.info({ version: ffmpegVersion }, 'FFmpeg is available');

    // Set ffmpeg paths
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || 'ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || 'ffprobe');

    return true;
  } catch (error) {
    ffmpegAvailable = false;
    logger.warn(
      { error },
      'FFmpeg not found or not properly configured. Video watermarking will not be available. Please install ffmpeg to enable video watermarking.',
    );

    // Log installation instructions
    logger.warn(
      'Installation instructions:\n' +
        '- macOS: brew install ffmpeg\n' +
        '- Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg\n' +
        '- Windows: Download from https://ffmpeg.org/download.html and add to PATH',
    );

    return false;
  }
}

// Check ffmpeg availability on startup
checkFfmpegAvailability().catch((error) => {
  logger.error({ error }, 'Error checking ffmpeg availability');
});

/**
 * Creates a preview video with watermark
 * @param inputBuffer Original video buffer
 * @param options Processing options
 * @returns Processed video result
 */
export const createPreviewVideo = async (
  inputBuffer: Buffer,
  options?: ProcessingOptions,
): Promise<ProcessingResult> => {
  try {
    logger.debug('Processing video preview');

    if (!inputBuffer || inputBuffer.length === 0) {
      throw new Error('Invalid input video buffer');
    }

    // If ffmpeg is not available, return the original video with a note
    if (!ffmpegAvailable) {
      logger.warn('FFmpeg not available. Unable to apply watermark to video.');
      try {
        // Extract first frame and add watermark with explanatory text
        const firstFrame = await extractFirstFrame(inputBuffer);
        if (firstFrame) {
          // Add watermark to the first frame with explanatory text
          const watermarkPath = path.join(process.cwd(), config.paths.watermark);
          const watermarkedFrame = await addWatermarkToImageWithNote(firstFrame, watermarkPath);

          // Return the original video with metadata indicating it has a watermarked thumbnail
          // and that the video itself is not watermarked
          return {
            buffer: inputBuffer,
            contentType: 'video/mp4',
            extension: 'mp4',
            metadata: {
              watermarkedThumbnail: watermarkedFrame.toString('base64'),
              processingNote:
                'Original video returned without watermark - ffmpeg not available. Please install ffmpeg to enable video watermarking.',
            },
          };
        }
      } catch (extractError) {
        logger.error({ error: extractError }, 'Failed to extract first frame');
      }

      // If frame extraction fails, just return the original video
      return {
        buffer: inputBuffer,
        contentType: 'video/mp4',
        extension: 'mp4',
        metadata: {
          processingNote:
            'Original video returned without watermark - ffmpeg not available. Please install ffmpeg to enable video watermarking.',
        },
      };
    }

    const watermarkPath = path.join(process.cwd(), config.paths.watermark);

    // Check if watermark file exists
    if (!fs.existsSync(watermarkPath)) {
      logger.error({ watermarkPath }, 'Watermark file not found');
      return {
        buffer: inputBuffer,
        contentType: 'video/mp4',
        extension: 'mp4',
        metadata: {
          processingNote: 'Original video returned without watermark - watermark file not found',
        },
      };
    }

    const videoBitrate = options?.quality ? `${options.quality}k` : config.processing.videoBitrate;

    const inputVideoStream = new Readable();
    inputVideoStream.push(inputBuffer);
    inputVideoStream.push(null);

    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    outputStream.on('data', (chunk) => {
      chunks.push(chunk as Buffer);
    });

    // Get video metadata to determine watermark size
    let videoInfo;
    try {
      videoInfo = await getVideoMetadata(inputBuffer);
    } catch (error) {
      logger.warn({ error }, 'Failed to get video metadata. Using default watermark size.');
      videoInfo = { width: 1920, height: 1080, duration: 0 };
    }

    const { width: videoWidth, height: videoHeight } = videoInfo;

    // Calculate watermark size based on video resolution
    // Use 15% of the video width as a reasonable size for the watermark
    const watermarkWidth = Math.round(videoWidth * 0.15);

    logger.debug(
      { videoWidth, videoHeight, watermarkWidth },
      'Video dimensions and watermark size',
    );

    return new Promise((resolve) => {
      try {
        const command = ffmpeg(inputVideoStream)
          .input(watermarkPath)
          .complexFilter([
            {
              filter: 'scale',
              options: `${watermarkWidth}:-1`,
              inputs: '1:v',
              outputs: 'watermark',
            },
            {
              filter: 'overlay',
              options: {
                x: '(main_w-overlay_w)/2',
                y: '(main_h-overlay_h)/2',
              },
              inputs: ['0:v', 'watermark'],
              outputs: 'output',
            },
          ])
          .map('output')
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            `-preset ${config.processing.videoPreset}`,
            `-b:v ${videoBitrate}`,
            `-b:a ${config.processing.audioBitrate}`,
          ])
          .format('mp4')
          .on('start', (commandLine) => {
            logger.debug({ commandLine }, 'FFmpeg process started');
          })
          .on('progress', (progress) => {
            logger.debug({ progress }, 'FFmpeg progress');
          })
          .on('end', () => {
            logger.info('Video processing completed successfully');
            resolve({
              buffer: Buffer.concat(chunks),
              contentType: 'video/mp4',
              extension: 'mp4',
            });
          })
          .on('error', (err) => {
            logger.error({ error: err, command: 'ffmpeg' }, 'Error processing video with ffmpeg');

            // Log more details about the error
            if (err.message) {
              logger.error(`FFmpeg error message: ${err.message}`);
            }

            // If ffmpeg fails, return the original video as a fallback
            logger.warn('Returning original video due to processing error');
            resolve({
              buffer: inputBuffer,
              contentType: 'video/mp4',
              extension: 'mp4',
              metadata: {
                processingNote: `Original video returned without watermark - ffmpeg processing error: ${err.message || 'Unknown error'}`,
              },
            });
          });

        command.pipe(outputStream);
      } catch (error) {
        logger.error({ error }, 'Error setting up ffmpeg command');

        // Return the original video as a fallback
        logger.warn('Returning original video due to ffmpeg setup error');
        resolve({
          buffer: inputBuffer,
          contentType: 'video/mp4',
          extension: 'mp4',
          metadata: {
            processingNote: 'Original video returned without watermark - ffmpeg setup error',
          },
        });
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error processing video');

    // Return the original video as a fallback
    logger.warn('Returning original video due to error');
    return {
      buffer: inputBuffer,
      contentType: 'video/mp4',
      extension: 'mp4',
      metadata: {
        processingNote: 'Original video returned without watermark - processing error',
      },
    };
  }
};

/**
 * Extracts the first frame from a video buffer
 * @param videoBuffer Video buffer
 * @returns Buffer containing the first frame as a JPEG image
 */
async function extractFirstFrame(videoBuffer: Buffer): Promise<Buffer | null> {
  if (!ffmpegAvailable) {
    // Create a default thumbnail when ffmpeg is not available
    try {
      // Create a simple placeholder image with text
      const width = 640;
      const height = 360;
      const placeholderImage = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
              <rect width="100%" height="100%" fill="#000000"/>
              <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Video Preview</text>
            </svg>`,
            ),
            gravity: 'center',
          },
        ])
        .jpeg()
        .toBuffer();

      return placeholderImage;
    } catch (error) {
      logger.error({ error }, 'Error creating placeholder thumbnail');
      return null;
    }
  }

  return new Promise((resolve) => {
    try {
      const inputStream = new Readable();
      inputStream.push(videoBuffer);
      inputStream.push(null);

      const outputStream = new PassThrough();
      const chunks: Buffer[] = [];

      outputStream.on('data', (chunk) => {
        chunks.push(chunk as Buffer);
      });

      ffmpeg(inputStream)
        .outputOptions(['-vframes 1'])
        .format('image2')
        .on('end', () => {
          resolve(Buffer.concat(chunks));
        })
        .on('error', () => {
          resolve(null);
        })
        .pipe(outputStream);
    } catch (error) {
      logger.error({ error }, 'Error extracting first frame');
      resolve(null);
    }
  });
}

/**
 * Adds a watermark to an image with explanatory text
 * @param imageBuffer Image buffer
 * @param watermarkPath Path to watermark image
 * @returns Buffer containing the watermarked image with explanatory text
 */
async function addWatermarkToImageWithNote(
  imageBuffer: Buffer,
  watermarkPath: string,
): Promise<Buffer> {
  try {
    const image = sharp(imageBuffer);

    // Check if watermark file exists
    try {
      // Try to create a watermark overlay
      const watermark = sharp(watermarkPath).resize({ width: 200 });
      const watermarkBuffer = await watermark.toBuffer();

      // Add the watermark to the image
      const watermarkedImage = await image
        .composite([
          {
            input: watermarkBuffer,
            gravity: 'center',
          },
        ])
        .jpeg();

      // Add explanatory text to the image
      const metadata = await image.metadata();
      const width = metadata.width || 640;
      const height = metadata.height || 360;

      const explanatoryText = Buffer.from(
        `<svg width="${width}" height="${height}">
          <rect x="${width / 2 - 150}" y="${height / 2 - 25}" width="300" height="50" fill="rgba(0,0,0,0.5)" rx="10" ry="10"/>
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">© WATERMARK</text>
        </svg>`,
      );

      return await watermarkedImage
        .composite([
          {
            input: explanatoryText,
            gravity: 'center',
          },
        ])
        .toBuffer();
    } catch (watermarkError) {
      logger.warn(
        { error: watermarkError },
        'Error loading watermark, adding text overlay instead',
      );

      // If watermark file doesn't exist or can't be loaded, add a text overlay
      const metadata = await image.metadata();
      const width = metadata.width || 640;
      const height = metadata.height || 360;

      const explanatoryText = Buffer.from(
        `<svg width="${width}" height="${height}">
          <rect x="${width / 2 - 150}" y="${height / 2 - 25}" width="300" height="50" fill="rgba(0,0,0,0.5)" rx="10" ry="10"/>
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">© WATERMARK</text>
        </svg>`,
      );

      return await image
        .composite([
          {
            input: explanatoryText,
            gravity: 'center',
          },
        ])
        .toBuffer();
    }
  } catch (error) {
    logger.error({ error }, 'Error adding watermark to image');
    return imageBuffer;
  }
}

/**
 * Gets video metadata including width and height
 * @param inputBuffer Video buffer
 * @returns Video metadata
 */
interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

async function getVideoMetadata(inputBuffer: Buffer): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    if (!ffmpegAvailable) {
      reject(new Error('FFmpeg not available'));
      return;
    }

    try {
      const inputStream = new Readable();
      inputStream.push(inputBuffer);
      inputStream.push(null);

      ffmpeg(inputStream).ffprobe((err, metadata) => {
        if (err) {
          logger.error({ error: err }, 'Error getting video metadata');
          reject(new Error(`Failed to get video metadata: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          width: videoStream.width || 1920,
          height: videoStream.height || 1080,
          duration: parseFloat(videoStream.duration || '0'),
        });
      });
    } catch (error) {
      logger.error({ error }, 'Error in ffprobe');
      reject(error);
    }
  });
}
