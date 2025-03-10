/* eslint-disable prettier/prettier */
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createPreview, createImagePreview, createVideoPreview } from '../../controllers/preview.controller';

jest.mock('../../services/image.service', () => ({
  createPreviewImage: jest.fn().mockResolvedValue({
    buffer: Buffer.from('test-image-data'),
    contentType: 'image/webp',
    extension: 'webp',
  }),
}));

jest.mock('../../services/video.service', () => ({
  createPreviewVideo: jest.fn().mockResolvedValue({
    buffer: Buffer.from('test-video-data'),
    contentType: 'video/mp4',
    extension: 'mp4',
  }),
}));

jest.mock('../../services/storage.service', () => ({
  uploadFile: jest.fn().mockResolvedValue({
    url: 'https://test-bucket.wasabisys.com/test-file.webp',
    key: 'test-file.webp',
  }),
  storeOriginalFile: jest.fn().mockResolvedValue({
    fileId: 'test-file-id',
    result: {
      url: 'https://test-bucket.wasabisys.com/originals/test-file-id.jpg',
      key: 'originals/test-file-id.jpg',
    },
  }),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../controllers/preview.controller', () => {
  const originalModule = jest.requireActual('../../controllers/preview.controller');
  
  return {
    ...originalModule,
    createPreview: jest.fn().mockImplementation((req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      return originalModule.createPreview(req, res);
    }),
    createImagePreview: jest.fn().mockImplementation((req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      return originalModule.createImagePreview(req, res);
    }),
    createVideoPreview: jest.fn().mockImplementation((req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      return originalModule.createVideoPreview(req, res);
    }),
  };
});

describe('Preview Controller Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();

    const storage = multer.memoryStorage();
    const upload = multer({ storage });

    app.post('/createPreview', upload.single('file'), createPreview);
    app.post('/image', upload.single('file'), createImagePreview);
    app.post('/video', upload.single('file'), createVideoPreview);
  });

  it('should process an image file and return a URL using legacy endpoint', async () => {
    const testImagePath = path.join(__dirname, '../../../public/watermark.png');
    const imageBuffer = fs.readFileSync(testImagePath);

    const response = await request(app)
      .post('/createPreview')
      .attach('file', imageBuffer, 'test-image.png')
      .set('Content-Type', 'image/png');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('fileId');
    expect(response.body.url).toBe('https://test-bucket.wasabisys.com/test-file.webp');
    expect(response.body.fileId).toBe('test-file-id');
  });

  it('should process an image file using the dedicated image endpoint', async () => {
    const testImagePath = path.join(__dirname, '../../../public/watermark.png');
    const imageBuffer = fs.readFileSync(testImagePath);

    const response = await request(app)
      .post('/image')
      .attach('file', imageBuffer, 'test-image.png')
      .set('Content-Type', 'image/png');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('fileId');
    expect(response.body.url).toBe('https://test-bucket.wasabisys.com/test-file.webp');
    expect(response.body.fileId).toBe('test-file-id');
  });

  it('should reject non-image files on the image endpoint', async () => {
    const testVideoBuffer = Buffer.from('fake-video-data');

    const response = await request(app)
      .post('/image')
      .attach('file', testVideoBuffer, 'test-video.mp4')
      .set('Content-Type', 'video/mp4');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('expected image');
  });

  it('should process a video file using the dedicated video endpoint', async () => {
    const testVideoBuffer = Buffer.from('fake-video-data');

    const response = await request(app)
      .post('/video')
      .attach('file', testVideoBuffer, 'test-video.mp4')
      .set('Content-Type', 'video/mp4');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('fileId');
    expect(response.body.url).toBe('https://test-bucket.wasabisys.com/test-file.webp');
    expect(response.body.fileId).toBe('test-file-id');
  });

  it('should reject non-video files on the video endpoint', async () => {
    const testImagePath = path.join(__dirname, '../../../public/watermark.png');
    const imageBuffer = fs.readFileSync(testImagePath);

    const response = await request(app)
      .post('/video')
      .attach('file', imageBuffer, 'test-image.png')
      .set('Content-Type', 'image/png');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('expected video');
  });
});
