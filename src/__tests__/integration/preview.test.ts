/* eslint-disable prettier/prettier */
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createPreview } from '../../controllers/preview.controller';

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
  });

  it('should process an image file and return a URL', async () => {
    const testImagePath = path.join(__dirname, '../../../public/watermark.png');
    const imageBuffer = fs.readFileSync(testImagePath);

    const response = await request(app)
      .post('/createPreview')
      .attach('file', imageBuffer, 'test-image.png')
      .set('Content-Type', 'image/png');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(response.body.url).toBe('https://test-bucket.wasabisys.com/test-file.webp');
  });
});
