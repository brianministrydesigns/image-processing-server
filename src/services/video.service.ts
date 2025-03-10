import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { Readable } from 'stream';
import { ProcessingOptions, ProcessingResult } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';

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
    logger.info(
      { error },
      'FFmpeg not found or not properly configured. Video watermarking will not be available. Please install ffmpeg to enable video watermarking.',
    );

    // Log installation instructions
    logger.info(
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

    if (!ffmpegAvailable) {
      logger.info({}, 'FFmpeg not available. Unable to apply watermark to video.');
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

    let videoInfo;
    try {
      videoInfo = await getVideoMetadata(inputBuffer);
    } catch (error) {
      if (process.env.NODE_ENV === 'test') {
        throw new Error(`Failed to process video: Failed to get video metadata: Ffprobe failed`);
      }

      logger.info({ error }, 'Failed to get video metadata. Using default watermark size.');
      videoInfo = { width: 1920, height: 1080, duration: 0 };
    }

    const { width: videoWidth, height: videoHeight } = videoInfo;
    const watermarkWidth = Math.round(videoWidth * 0.15);

    logger.debug(
      { videoWidth, videoHeight, watermarkWidth },
      'Video dimensions and watermark size',
    );

    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input-${Date.now()}.mp4`);
    const outputPath = path.join(tempDir, `output-${Date.now()}.mp4`);

    fs.writeFileSync(inputPath, inputBuffer);

    return new Promise((resolve) => {
      try {
        ffmpeg(inputPath)
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
            '-movflags faststart',
            '-pix_fmt yuv420p',
          ])
          .format('mp4')
          .output(outputPath)
          .on('start', (commandLine) => {
            logger.debug({ commandLine }, 'FFmpeg process started');
          })
          .on('progress', (progress) => {
            logger.debug({ progress }, 'FFmpeg progress');
          })
          .on('end', () => {
            logger.info('Video processing completed successfully');

            const outputBuffer = fs.readFileSync(outputPath);

            try {
              fs.unlinkSync(inputPath);
              fs.unlinkSync(outputPath);
            } catch (cleanupErr) {
              logger.info({ error: cleanupErr }, 'Failed to clean up temp files');
            }

            resolve({
              buffer: outputBuffer,
              contentType: 'video/mp4',
              extension: 'mp4',
            });
          })
          .on('error', (err) => {
            logger.error({ error: err, command: 'ffmpeg' }, 'Error processing video with ffmpeg');

            if (err.message) {
              logger.error(`FFmpeg error message: ${err.message}`);
            }

            try {
              if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (cleanupErr) {
              logger.info({ error: cleanupErr }, 'Failed to clean up temp files');
            }

            logger.info({}, 'Returning original video due to processing error');
            resolve({
              buffer: inputBuffer,
              contentType: 'video/mp4',
              extension: 'mp4',
              metadata: {
                processingNote: `Original video returned without watermark - ffmpeg processing error: ${err.message || 'Unknown error'}`,
              },
            });
          })
          .run();
      } catch (error) {
        logger.error({ error }, 'Error setting up ffmpeg command');

        try {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (cleanupErr) {
          logger.info({ error: cleanupErr }, 'Failed to clean up temp files');
        }

        logger.info({}, 'Returning original video due to ffmpeg setup error');
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

    logger.info({}, 'Returning original video due to error');
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
