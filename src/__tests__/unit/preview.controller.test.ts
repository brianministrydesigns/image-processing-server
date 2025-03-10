import { Request, Response } from 'express';
import { Readable } from 'stream';
import { createPreview } from '../../controllers/preview.controller';
import { createPreviewImage } from '../../services/image.service';
import { createPreviewVideo } from '../../services/video.service';
import { uploadFile, storeOriginalFile } from '../../services/storage.service';
import { logger } from '../../utils/logger';

jest.mock('../../services/image.service');
jest.mock('../../services/video.service');
jest.mock('../../services/storage.service');
jest.mock('../../utils/logger');

describe('Preview Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseObject: any;

  beforeEach(() => {
    jest.clearAllMocks();

    responseObject = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((result) => {
        responseObject = result;
        return mockResponse;
      }),
    };

    (createPreviewImage as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('test-image-data'),
      contentType: 'image/webp',
      extension: 'webp',
    });

    (createPreviewVideo as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('test-video-data'),
      contentType: 'video/mp4',
      extension: 'mp4',
    });

    (uploadFile as jest.Mock).mockResolvedValue({
      url: 'https://test-bucket.wasabisys.com/test-file.webp',
      key: 'test-file.webp',
    });

    (storeOriginalFile as jest.Mock).mockResolvedValue({
      fileId: 'test-file-id',
      result: {
        url: 'https://test-bucket.wasabisys.com/originals/test-file-id.jpg',
        key: 'originals/test-file-id.jpg',
      },
    });
  });

  it('should return 400 when no file is uploaded', async () => {
    mockRequest = {
      file: undefined,
    };

    await createPreview(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(responseObject).toEqual({ message: 'No file uploaded' });
    expect(logger.warn).toHaveBeenCalledWith('No file uploaded');
  });

  it('should process an image file and return a URL', async () => {
    const mockStream = new Readable();
    mockStream.push(Buffer.from('test-image-data'));
    mockStream.push(null);

    mockRequest = {
      file: {
        buffer: Buffer.from('test-image-data'),
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        fieldname: 'file',
        encoding: '7bit',
        size: 1024,
        stream: mockStream,
        destination: '/tmp',
        filename: 'test-image.jpg',
        path: '/tmp/test-image.jpg',
      },
    };

    await createPreview(mockRequest as Request, mockResponse as Response);

    expect(storeOriginalFile).toHaveBeenCalledWith(
      mockRequest.file?.buffer,
      mockRequest.file?.originalname,
      mockRequest.file?.mimetype,
    );
    expect(createPreviewImage).toHaveBeenCalledWith(mockRequest.file?.buffer);
    expect(uploadFile).toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(responseObject).toEqual({
      url: 'https://test-bucket.wasabisys.com/test-file.webp',
      fileId: 'test-file-id',
    });
  });

  it('should process a video file and return a URL', async () => {
    const mockStream = new Readable();
    mockStream.push(Buffer.from('test-video-data'));
    mockStream.push(null);

    mockRequest = {
      file: {
        buffer: Buffer.from('test-video-data'),
        originalname: 'test-video.mp4',
        mimetype: 'video/mp4',
        fieldname: 'file',
        encoding: '7bit',
        size: 1024,
        stream: mockStream,
        destination: '/tmp',
        filename: 'test-video.mp4',
        path: '/tmp/test-video.mp4',
      },
    };

    await createPreview(mockRequest as Request, mockResponse as Response);

    expect(storeOriginalFile).toHaveBeenCalledWith(
      mockRequest.file?.buffer,
      mockRequest.file?.originalname,
      mockRequest.file?.mimetype,
    );
    expect(createPreviewVideo).toHaveBeenCalledWith(mockRequest.file?.buffer);
    expect(uploadFile).toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(responseObject).toEqual({
      url: 'https://test-bucket.wasabisys.com/test-file.webp',
      fileId: 'test-file-id',
    });
  });

  it('should return 400 for unsupported file types', async () => {
    const mockStream = new Readable();
    mockStream.push(Buffer.from('test-data'));
    mockStream.push(null);

    mockRequest = {
      file: {
        buffer: Buffer.from('test-data'),
        originalname: 'test-file.pdf',
        mimetype: 'application/pdf',
        fieldname: 'file',
        encoding: '7bit',
        size: 1024,
        stream: mockStream,
        destination: '/tmp',
        filename: 'test-file.pdf',
        path: '/tmp/test-file.pdf',
      },
    };

    await createPreview(mockRequest as Request, mockResponse as Response);

    expect(storeOriginalFile).toHaveBeenCalledWith(
      mockRequest.file?.buffer,
      mockRequest.file?.originalname,
      mockRequest.file?.mimetype,
    );
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(responseObject).toEqual({ message: 'Unsupported file type' });
  });

  it('should handle processing errors and return 500 with retry info', async () => {
    const mockStream = new Readable();
    mockStream.push(Buffer.from('test-image-data'));
    mockStream.push(null);

    mockRequest = {
      file: {
        buffer: Buffer.from('test-image-data'),
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        fieldname: 'file',
        encoding: '7bit',
        size: 1024,
        stream: mockStream,
        destination: '/tmp',
        filename: 'test-image.jpg',
        path: '/tmp/test-image.jpg',
      },
    };

    const error = new Error('Test error');
    (createPreviewImage as jest.Mock).mockRejectedValue(error);

    await createPreview(mockRequest as Request, mockResponse as Response);

    expect(storeOriginalFile).toHaveBeenCalledWith(
      mockRequest.file?.buffer,
      mockRequest.file?.originalname,
      mockRequest.file?.mimetype,
    );
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(responseObject).toEqual({
      message: 'Error processing file',
      fileId: 'test-file-id',
      error: 'Test error',
      canRetry: true,
    });
    expect(logger.error).toHaveBeenCalledWith({ error }, 'Error processing file');
  });

  it('should handle general errors and return 500', async () => {
    const mockStream = new Readable();
    mockStream.push(Buffer.from('test-image-data'));
    mockStream.push(null);

    mockRequest = {
      file: {
        buffer: Buffer.from('test-image-data'),
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        fieldname: 'file',
        encoding: '7bit',
        size: 1024,
        stream: mockStream,
        destination: '/tmp',
        filename: 'test-image.jpg',
        path: '/tmp/test-image.jpg',
      },
    };

    const error = new Error('Test error');
    (storeOriginalFile as jest.Mock).mockRejectedValue(error);

    await createPreview(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(responseObject).toEqual({ message: 'Internal server error' });
    expect(logger.error).toHaveBeenCalledWith({ error }, 'Error creating preview');
  });
});
