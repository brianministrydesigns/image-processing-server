import request from 'supertest';
import express from 'express';
import { retryProcessing } from '../../controllers/preview.controller';
import { getOriginalFile } from '../../services/storage.service';
import { createPreviewImage } from '../../services/image.service';
import { createPreviewVideo } from '../../services/video.service';

// Mock the storage service
jest.mock('../../services/storage.service', () => ({
  getOriginalFile: jest.fn(),
  uploadFile: jest.fn().mockResolvedValue({
    url: 'https://test-bucket.wasabisys.com/test-file-retry.webp',
    key: 'test-file-retry.webp',
  }),
}));

// Mock the image service
jest.mock('../../services/image.service', () => ({
  createPreviewImage: jest.fn().mockResolvedValue({
    buffer: Buffer.from('test-image-data'),
    contentType: 'image/webp',
    extension: 'webp',
  }),
}));

// Mock the video service
jest.mock('../../services/video.service', () => ({
  createPreviewVideo: jest.fn().mockResolvedValue({
    buffer: Buffer.from('test-video-data'),
    contentType: 'video/mp4',
    extension: 'mp4',
  }),
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Retry Processing Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.post('/retry', retryProcessing);
  });

  it('should retry processing an image file', async () => {
    // Mock the getOriginalFile to return an image
    (getOriginalFile as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('original-image-data'),
      filename: 'test-image.jpg',
      mimetype: 'image/jpeg',
    });

    const response = await request(app)
      .post('/retry')
      .send({
        fileId: 'test-file-id',
        options: {
          quality: 90,
          width: 1280,
          height: 720,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('fileId');
    expect(response.body.url).toBe('https://test-bucket.wasabisys.com/test-file-retry.webp');
    expect(getOriginalFile).toHaveBeenCalledWith('test-file-id');
    expect(createPreviewImage).toHaveBeenCalledWith(Buffer.from('original-image-data'), {
      quality: 90,
      width: 1280,
      height: 720,
    });
  });

  it('should retry processing a video file', async () => {
    // Mock the getOriginalFile to return a video
    (getOriginalFile as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('original-video-data'),
      filename: 'test-video.mp4',
      mimetype: 'video/mp4',
    });

    const response = await request(app)
      .post('/retry')
      .send({
        fileId: 'test-file-id',
        options: {
          quality: 500,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('fileId');
    expect(response.body.url).toBe('https://test-bucket.wasabisys.com/test-file-retry.webp');
    expect(getOriginalFile).toHaveBeenCalledWith('test-file-id');
    expect(createPreviewVideo).toHaveBeenCalledWith(Buffer.from('original-video-data'), {
      quality: 500,
    });
  });

  it('should handle errors when the file is not found', async () => {
    // Mock the getOriginalFile to throw an error
    (getOriginalFile as jest.Mock).mockRejectedValue(new Error('File not found'));

    const response = await request(app).post('/retry').send({
      fileId: 'non-existent-file-id',
    });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Error retrying file processing');
    expect(response.body).toHaveProperty('fileId');
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('canRetry');
  });

  it('should handle missing fileId', async () => {
    const response = await request(app)
      .post('/retry')
      .send({
        options: {
          quality: 90,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('No fileId provided');
  });
});
