import { Request, Response } from 'express';
import path from 'path';
import { createPreviewImage } from '../services/image.service';
import { createPreviewVideo } from '../services/video.service';
import {
  uploadFile,
  storeOriginalFile,
  getOriginalFile,
  getOriginalFileUrl,
} from '../services/storage.service';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { RetryProcessingRequest, PreviewResponse } from '../types';

/**
 * Handles the creation of preview files (images or videos)
 * @param req Express request
 * @param res Express response
 */
export const createPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      logger.warn('No file uploaded');
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    logger.info({ filename: file.originalname, mimetype: file.mimetype }, 'Processing file');

    // Store the original file for potential retry
    const { fileId, result: originalResult } = await storeOriginalFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    const originalUrl = originalResult.url;

    let processedResult;

    try {
      if (file.mimetype.startsWith('image/')) {
        processedResult = await createPreviewImage(file.buffer);
      } else if (file.mimetype.startsWith('video/')) {
        processedResult = await createPreviewVideo(file.buffer);
      } else {
        logger.warn({ mimetype: file.mimetype }, 'Unsupported file type');
        res.status(400).json({ message: 'Unsupported file type' });
        return;
      }
    } catch (processingError) {
      logger.error({ error: processingError }, 'Error processing file');
      res.status(500).json({
        message: 'Error processing file',
        fileId,
        originalUrl,
        error: (processingError as Error).message,
        canRetry: true,
      });
      return;
    }

    const key = `${Date.now()}-${path.parse(file.originalname).name}.${processedResult.extension}`;

    const uploadResult = await uploadFile({
      bucket: config.wasabi.publicBucket,
      key,
      buffer: processedResult.buffer,
      contentType: processedResult.contentType,
      isPublic: true,
      metadata: {
        fileId,
        originalName: file.originalname,
      },
    });

    const response: PreviewResponse = {
      url: uploadResult.url,
      originalUrl,
      fileId,
    };

    // If there's a watermarked thumbnail in the metadata, include it in the response
    if (processedResult.metadata?.watermarkedThumbnail) {
      response.thumbnailData = processedResult.metadata.watermarkedThumbnail;
    }

    if (processedResult.metadata?.processingNote) {
      response.processingNote = processedResult.metadata.processingNote;
    }

    res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'Error creating preview');
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Handles the creation of image previews
 * @param req Express request
 * @param res Express response
 */
export const createImagePreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      logger.warn('No file uploaded');
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    if (!file.mimetype.startsWith('image/')) {
      logger.warn({ mimetype: file.mimetype }, 'Unsupported file type - expected image');
      res.status(400).json({ message: 'Unsupported file type - expected image' });
      return;
    }

    logger.info({ filename: file.originalname, mimetype: file.mimetype }, 'Processing image');

    // Store the original file for potential retry
    const { fileId, result: originalResult } = await storeOriginalFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    const originalUrl = originalResult.url;

    try {
      const processedResult = await createPreviewImage(file.buffer);
      const key = `${Date.now()}-${path.parse(file.originalname).name}.${processedResult.extension}`;

      const uploadResult = await uploadFile({
        bucket: config.wasabi.publicBucket,
        key,
        buffer: processedResult.buffer,
        contentType: processedResult.contentType,
        isPublic: true,
        metadata: {
          fileId,
          originalName: file.originalname,
        },
      });

      const response: PreviewResponse = {
        url: uploadResult.url,
        originalUrl,
        fileId,
      };

      res.status(200).json(response);
    } catch (processingError) {
      logger.error({ error: processingError }, 'Error processing image');
      res.status(500).json({
        message: 'Error processing image',
        fileId,
        originalUrl,
        error: (processingError as Error).message,
        canRetry: true,
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error creating image preview');
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Handles the creation of video previews
 * @param req Express request
 * @param res Express response
 */
export const createVideoPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      logger.warn('No file uploaded');
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    if (!file.mimetype.startsWith('video/')) {
      logger.warn({ mimetype: file.mimetype }, 'Unsupported file type - expected video');
      res.status(400).json({ message: 'Unsupported file type - expected video' });
      return;
    }

    logger.info({ filename: file.originalname, mimetype: file.mimetype }, 'Processing video');

    // Store the original file for potential retry
    const { fileId, result: originalResult } = await storeOriginalFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    const originalUrl = originalResult.url;

    try {
      const processedResult = await createPreviewVideo(file.buffer);
      const key = `${Date.now()}-${path.parse(file.originalname).name}.${processedResult.extension}`;

      const uploadResult = await uploadFile({
        bucket: config.wasabi.publicBucket,
        key,
        buffer: processedResult.buffer,
        contentType: processedResult.contentType,
        isPublic: true,
        metadata: {
          fileId,
          originalName: file.originalname,
        },
      });

      const response: PreviewResponse = {
        url: uploadResult.url,
        originalUrl,
        fileId,
      };

      // If there's a watermarked thumbnail in the metadata, include it in the response
      if (processedResult.metadata?.watermarkedThumbnail) {
        response.thumbnailData = processedResult.metadata.watermarkedThumbnail;
      }

      res.status(200).json(response);
    } catch (processingError) {
      logger.error({ error: processingError }, 'Error processing video');
      res.status(500).json({
        message: 'Error processing video',
        fileId,
        originalUrl,
        error: (processingError as Error).message,
        canRetry: true,
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error creating video preview');
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Handles retrying the processing of a previously uploaded file
 * @param req Express request
 * @param res Express response
 */
export const retryProcessing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId, options } = req.body as RetryProcessingRequest;

    if (!fileId) {
      logger.warn('No fileId provided');
      res.status(400).json({ message: 'No fileId provided' });
      return;
    }

    logger.info({ fileId }, 'Retrying file processing');

    try {
      // Retrieve the original file
      const { buffer, filename, mimetype } = await getOriginalFile(fileId);
      const originalExtension = path.extname(filename).substring(1);
      const originalUrl = getOriginalFileUrl(fileId, originalExtension);

      let processedResult;

      // Process the file based on its type
      if (mimetype.startsWith('image/')) {
        processedResult = await createPreviewImage(buffer, options);
      } else if (mimetype.startsWith('video/')) {
        processedResult = await createPreviewVideo(buffer, options);
      } else {
        logger.warn({ mimetype }, 'Unsupported file type for retry');
        res.status(400).json({ message: 'Unsupported file type for retry' });
        return;
      }

      const key = `${Date.now()}-${path.parse(filename).name}.${processedResult.extension}`;

      const uploadResult = await uploadFile({
        bucket: config.wasabi.publicBucket,
        key,
        buffer: processedResult.buffer,
        contentType: processedResult.contentType,
        isPublic: true,
        metadata: {
          fileId,
          originalName: filename,
          isRetry: 'true',
        },
      });

      const response: PreviewResponse = {
        url: uploadResult.url,
        originalUrl,
        fileId,
      };

      // If there's a watermarked thumbnail in the metadata, include it in the response
      if (processedResult.metadata?.watermarkedThumbnail) {
        response.thumbnailData = processedResult.metadata.watermarkedThumbnail;
      }

      if (processedResult.metadata?.processingNote) {
        response.processingNote = processedResult.metadata.processingNote;
      }

      res.status(200).json(response);
    } catch (processingError) {
      logger.error({ error: processingError, fileId }, 'Error retrying file processing');
      res.status(500).json({
        message: 'Error retrying file processing',
        fileId,
        error: (processingError as Error).message,
        canRetry: true,
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error in retry processing');
    res.status(500).json({ message: 'Internal server error' });
  }
};
