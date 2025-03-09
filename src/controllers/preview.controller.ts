import { Request, Response } from 'express';
import path from 'path';
import { createPreviewImage } from '../services/image.service';
import { createPreviewVideo } from '../services/video.service';
import { uploadFile } from '../services/storage.service';
import { config } from '../config/config';
import { logger } from '../utils/logger';

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

    let processedResult;

    if (file.mimetype.startsWith('image/')) {
      processedResult = await createPreviewImage(file.buffer);
    } else if (file.mimetype.startsWith('video/')) {
      processedResult = await createPreviewVideo(file.buffer);
    } else {
      logger.warn({ mimetype: file.mimetype }, 'Unsupported file type');
      res.status(400).json({ message: 'Unsupported file type' });
      return;
    }

    const key = `${Date.now()}-${path.parse(file.originalname).name}.${processedResult.extension}`;

    const uploadResult = await uploadFile({
      bucket: config.wasabi.publicBucket,
      key,
      buffer: processedResult.buffer,
      contentType: processedResult.contentType,
      isPublic: true,
    });

    res.status(200).json({ url: uploadResult.url });
  } catch (error) {
    logger.error({ error }, 'Error creating preview');
    res.status(500).json({ message: 'Internal server error' });
  }
};
