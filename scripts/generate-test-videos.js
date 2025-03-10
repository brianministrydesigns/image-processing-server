#!/usr/bin/env node

/**
 * Script to generate sample test videos with different resolutions
 * This creates simple MP4 files with different sizes to test watermark scaling
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Create test media directory if it doesn't exist
const testMediaDir = path.join(__dirname, '../test-media');
if (!fs.existsSync(testMediaDir)) {
  fs.mkdirSync(testMediaDir);
  console.log(`Created directory: ${testMediaDir}`);
}

// Sample videos to download
const sampleVideos = [
  {
    url: 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
    name: 'test-video-small.mp4',
    resolution: '360p'
  },
  {
    url: 'https://filesamples.com/samples/video/mp4/sample_960x540.mp4',
    name: 'test-video-medium.mp4',
    resolution: '540p'
  },
  {
    url: 'https://filesamples.com/samples/video/mp4/sample_1280x720.mp4',
    name: 'test-video-large.mp4',
    resolution: '720p'
  },
  {
    url: 'https://filesamples.com/samples/video/mp4/sample_1920x1080.mp4',
    name: 'test-video-hd.mp4',
    resolution: '1080p'
  }
];

// Function to download a file
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file if there's an error
      reject(err);
    });
  });
}

// Download all sample videos
async function downloadSampleVideos() {
  console.log('Downloading sample videos...');
  
  for (const video of sampleVideos) {
    const outputPath = path.join(testMediaDir, video.name);
    
    try {
      console.log(`Downloading ${video.resolution} video: ${video.name}...`);
      await downloadFile(video.url, outputPath);
      console.log(`Downloaded: ${outputPath}`);
    } catch (error) {
      console.error(`Error downloading ${video.name}: ${error.message}`);
    }
  }
  
  console.log('\nVideo download complete!');
  console.log(`Files are located in: ${testMediaDir}`);
  console.log('\nTo test the API with these files, use:');
  console.log('curl -F "file=@test-media/test-video-medium.mp4" http://localhost:3000/api/preview/video');
}

// Run the download
downloadSampleVideos().catch(console.error); 