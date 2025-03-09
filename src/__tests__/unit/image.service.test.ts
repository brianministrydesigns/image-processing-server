import { createPreviewImage } from '../../services/image.service';
import sharp from 'sharp';
import path from 'path';

jest.mock('sharp');
jest.mock('path');
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Image Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (path.join as jest.Mock).mockReturnValue('/mocked/path/to/watermark.png');

    const mockSharp = {
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      composite: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked-buffer')),
    };
    (sharp as unknown as jest.Mock).mockReturnValue(mockSharp);
  });

  it('should process an image and return the expected result', async () => {
    const inputBuffer = Buffer.from('test-image-data');

    const result = await createPreviewImage(inputBuffer);

    expect(sharp).toHaveBeenCalledWith(inputBuffer);
    expect(result).toEqual({
      buffer: Buffer.from('mocked-buffer'),
      contentType: 'image/webp',
      extension: 'webp',
    });
  });

  it('should handle errors during image processing', async () => {
    const inputBuffer = Buffer.from('test-image-data');
    const error = new Error('Processing failed');

    (sharp as unknown as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(createPreviewImage(inputBuffer)).rejects.toThrow(
      'Failed to process image: Processing failed',
    );
  });
});
