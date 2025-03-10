import { createPreviewVideo } from '../../services/video.service';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

jest.mock('fluent-ffmpeg');
jest.mock('path');
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Video Service', () => {
  let mockFfmpeg: any;
  let mockFfprobe: any;
  let mockComplexFilter: any;
  let mockMap: any;
  let mockVideoCodec: any;
  let mockAudioCodec: any;
  let mockOutputOptions: any;
  let mockFormat: any;
  let mockPipe: any;
  let mockOn: any;
  let mockInput: any;

  beforeEach(() => {
    jest.clearAllMocks();

    (path.join as jest.Mock).mockReturnValue('/mocked/path/to/watermark.png');

    mockOn = jest.fn().mockImplementation((event, callback) => {
      if (event === 'end') {
        setTimeout(() => callback(), 10);
      }
      return { on: mockOn };
    });
    mockPipe = jest.fn().mockReturnValue({ on: mockOn });
    mockFormat = jest.fn().mockReturnValue({ pipe: mockPipe });
    mockOutputOptions = jest.fn().mockReturnValue({ format: mockFormat });
    mockAudioCodec = jest.fn().mockReturnValue({ outputOptions: mockOutputOptions });
    mockVideoCodec = jest.fn().mockReturnValue({ audioCodec: mockAudioCodec });
    mockMap = jest.fn().mockReturnValue({ videoCodec: mockVideoCodec });
    mockComplexFilter = jest.fn().mockReturnValue({ map: mockMap });
    mockInput = jest.fn().mockReturnValue({ complexFilter: mockComplexFilter });
    mockFfmpeg = jest.fn().mockReturnValue({ input: mockInput });

    mockFfprobe = jest
      .fn()
      .mockImplementation((callback: (err: Error | null, data?: any) => void) => {
        callback(null, {
          streams: [
            {
              codec_type: 'video',
              width: 1920,
              height: 1080,
              duration: '60.0',
            },
          ],
        });
        return { input: mockInput };
      });

    (ffmpeg as unknown as jest.Mock).mockImplementation((input) => {
      if (typeof input === 'object' && input !== null) {
        return {
          input: mockInput,
          ffprobe: mockFfprobe,
        };
      }
      return mockFfmpeg(input);
    });
  });

  it('should process a video and return the expected result', async () => {
    const inputBuffer = Buffer.from('test-video-data');

    const result = await createPreviewVideo(inputBuffer);

    expect(ffmpeg).toHaveBeenCalled();
    expect(mockInput).toHaveBeenCalledWith('/mocked/path/to/watermark.png');
    expect(mockComplexFilter).toHaveBeenCalledWith([
      {
        filter: 'scale',
        options: '288:-1',
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
    ]);
    expect(mockMap).toHaveBeenCalledWith('output');
    expect(result).toEqual({
      buffer: expect.any(Buffer),
      contentType: 'video/mp4',
      extension: 'mp4',
    });
  });

  it('should calculate watermark size based on video resolution', async () => {
    // Mock a different video resolution
    mockFfprobe.mockImplementationOnce((callback: (err: Error | null, data?: any) => void) => {
      callback(null, {
        streams: [
          {
            codec_type: 'video',
            width: 640,
            height: 480,
            duration: '30.0',
          },
        ],
      });
      return { input: mockInput };
    });

    const inputBuffer = Buffer.from('test-video-data');

    await createPreviewVideo(inputBuffer);

    // Check that the watermark size is 15% of the video width (640 * 0.15 = 96)
    expect(mockComplexFilter).toHaveBeenCalledWith([
      {
        filter: 'scale',
        options: '96:-1',
        inputs: '1:v',
        outputs: 'watermark',
      },
      expect.any(Object),
    ]);
  });

  it('should handle errors during video processing', async () => {
    const inputBuffer = Buffer.from('test-video-data');

    mockFfprobe.mockImplementationOnce((callback: (err: Error | null, data?: any) => void) => {
      callback(new Error('Ffprobe failed'), null);
      return { input: mockInput };
    });

    await expect(createPreviewVideo(inputBuffer)).rejects.toThrow(
      'Failed to process video: Failed to get video metadata: Ffprobe failed',
    );
  });

  it('should handle empty input buffer', async () => {
    const inputBuffer = Buffer.from('');

    await expect(createPreviewVideo(inputBuffer)).rejects.toThrow('Invalid input video buffer');
  });
});
