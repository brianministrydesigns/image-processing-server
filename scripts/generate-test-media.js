/**
 * Script to generate sample test images and videos with different resolutions
 * This helps test how the watermark scaling works with different media sizes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create test media directory if it doesn't exist
const testMediaDir = path.join(__dirname, '../test-media');
if (!fs.existsSync(testMediaDir)) {
  fs.mkdirSync(testMediaDir);
  console.log(`Created directory: ${testMediaDir}`);
}

// Image resolutions to generate
const imageResolutions = [
  { width: 640, height: 480, name: 'small' },
  { width: 1280, height: 720, name: 'medium' },
  { width: 1920, height: 1080, name: 'large' },
  { width: 3840, height: 2160, name: '4k' },
];

// Video resolutions to generate
const videoResolutions = [
  { width: 640, height: 480, name: 'small' },
  { width: 1280, height: 720, name: 'medium' },
  { width: 1920, height: 1080, name: 'large' },
  { width: 3840, height: 2160, name: '4k' },
];

// Generate test images using ImageMagick
console.log('Generating test images...');
imageResolutions.forEach(({ width, height, name }) => {
  const outputPath = path.join(testMediaDir, `test-image-${name}.jpg`);
  
  try {
    execSync(
      `convert -size ${width}x${height} gradient:blue-red -gravity center ` +
      `-pointsize ${Math.max(width / 20, 20)} -fill white -annotate 0 "${width}x${height}" ${outputPath}`
    );
    console.log(`Created test image: ${outputPath}`);
  } catch (error) {
    console.error(`Error creating test image ${name}: ${error.message}`);
    console.log('Make sure ImageMagick is installed (brew install imagemagick)');
  }
});

// Generate test videos using FFmpeg
console.log('\nGenerating test videos...');
videoResolutions.forEach(({ width, height, name }) => {
  const outputPath = path.join(testMediaDir, `test-video-${name}.mp4`);
  
  try {
    // Create a 5-second test video with resolution text and a timestamp
    execSync(
      `ffmpeg -y -f lavfi -i testsrc=size=${width}x${height}:rate=30 ` +
      `-vf "drawtext=text='${width}x${height}':fontsize=${Math.max(height / 10, 24)}:` +
      `fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2, ` +
      `drawtext=text='%{pts\\:gmtime\\:0\\:%H\\\\\\:%M\\\\\\:%S}':fontsize=${Math.max(height / 20, 18)}:` +
      `fontcolor=white:x=(w-text_w)/2:y=h-th-20" ` +
      `-t 5 -c:v libx264 -pix_fmt yuv420p ${outputPath}`
    );
    console.log(`Created test video: ${outputPath}`);
  } catch (error) {
    console.error(`Error creating test video ${name}: ${error.message}`);
    console.log('Make sure FFmpeg is installed (brew install ffmpeg)');
  }
});

console.log('\nTest media generation complete!');
console.log(`Files are located in: ${testMediaDir}`);
console.log('\nTo test the API with these files, use:');
console.log('curl -F "file=@test-media/test-image-medium.jpg" http://localhost:3000/api/preview/image');
console.log('curl -F "file=@test-media/test-video-medium.mp4" http://localhost:3000/api/preview/video'); 