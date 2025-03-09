import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { Readable, PassThrough } from 'stream';
import { ProcessingOptions, ProcessingResult } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

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

    const watermarkPath = path.join(process.cwd(), config.paths.watermark);
    const videoBitrate = options?.quality ? `${options.quality}k` : config.processing.videoBitrate;

    const inputVideoStream = new Readable();
    inputVideoStream.push(inputBuffer);
    inputVideoStream.push(null);

    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    outputStream.on('data', (chunk) => {
      chunks.push(chunk as Buffer);
    });

    return new Promise((resolve, reject) => {
      ffmpeg(inputVideoStream)
        .input(watermarkPath)
        .complexFilter([
          {
            filter: 'overlay',
            options: {
              x: '(main_w-overlay_w)/2',
              y: '(main_h-overlay_h)/2',
            },
          },
        ])
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          `-preset ${config.processing.videoPreset}`,
          `-b:v ${videoBitrate}`,
          `-b:a ${config.processing.audioBitrate}`,
        ])
        .format('mp4')
        .pipe(outputStream)
        .on('end', () => {
          logger.info('Video processing completed successfully');
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: 'video/mp4',
            extension: 'mp4',
          });
        })
        .on('error', (err) => {
          logger.error({ error: err }, 'Error processing video');
          reject(new Error(`Failed to process video: ${err.message}`));
        });
    });
  } catch (error) {
    logger.error({ error }, 'Error processing video');
    throw new Error(`Failed to process video: ${(error as Error).message}`);
  }
};
