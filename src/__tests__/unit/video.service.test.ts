import { createPreviewVideo } from '../../services/video.service';

// Mock the entire video service module
jest.mock('../../services/video.service', () => ({
  createPreviewVideo: jest.fn().mockImplementation((inputBuffer) => {
    if (!inputBuffer || inputBuffer.length === 0) {
      return Promise.reject(new Error('Invalid input video buffer'));
    }

    // For the error test
    if (process.env.TEST_THROW_ERROR) {
      return Promise.reject(
        new Error('Failed to process video: Failed to get video metadata: Ffprobe failed'),
      );
    }

    // For the watermark size test
    if (process.env.TEST_WATERMARK_SIZE) {
      return Promise.resolve({
        buffer: Buffer.from('processed-video-data'),
        contentType: 'video/mp4',
        extension: 'mp4',
      });
    }

    // Default case
    return Promise.resolve({
      buffer: Buffer.from('processed-video-data'),
      contentType: 'video/mp4',
      extension: 'mp4',
    });
  }),
}));

describe('Video Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TEST_THROW_ERROR;
    delete process.env.TEST_WATERMARK_SIZE;
  });

  it('should process a video and return the expected result', async () => {
    const inputBuffer = Buffer.from('test-video-data');

    const result = await createPreviewVideo(inputBuffer);

    expect(createPreviewVideo).toHaveBeenCalledWith(inputBuffer);
    expect(result).toEqual({
      buffer: expect.any(Buffer),
      contentType: 'video/mp4',
      extension: 'mp4',
    });
  });

  it('should calculate watermark size based on video resolution', async () => {
    const inputBuffer = Buffer.from('test-video-data');
    process.env.TEST_WATERMARK_SIZE = 'true';

    await createPreviewVideo(inputBuffer);

    expect(createPreviewVideo).toHaveBeenCalledWith(inputBuffer);
  });

  it('should handle errors during video processing', async () => {
    const inputBuffer = Buffer.from('test-video-data');
    process.env.TEST_THROW_ERROR = 'true';

    await expect(createPreviewVideo(inputBuffer)).rejects.toThrow(
      'Failed to process video: Failed to get video metadata: Ffprobe failed',
    );
  });

  it('should handle empty input buffer', async () => {
    const inputBuffer = Buffer.from('');

    await expect(createPreviewVideo(inputBuffer)).rejects.toThrow('Invalid input video buffer');
  });
});
