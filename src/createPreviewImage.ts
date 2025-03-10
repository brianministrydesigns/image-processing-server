import sharp from "sharp";
import path from "path";

export async function createPreviewImage(inputBuffer: Buffer): Promise<Buffer> {
  const width = 1920;
  const height = 1080;

  // Resize the image and convert to webp with transparency preserved
  const image = sharp(inputBuffer)
    .resize({
      width: width,
      height: height,
      fit: sharp.fit.contain,
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // Ensure transparency
    })
    .webp({ quality: 80 });

  const watermarkPath = path.join(__dirname, "..", "public", "watermark.png");
  const watermark = sharp(watermarkPath).resize({ width: 200 }).png();

  // Get the buffers for the image and watermark
  const [imageBuffer, watermarkBuffer] = await Promise.all([
    image.toBuffer(),
    watermark.toBuffer(),
  ]);

  // Log the metadata to check transparency
  const imageMetadata = await sharp(imageBuffer).metadata();
  const watermarkMetadata = await sharp(watermarkBuffer).metadata();
  console.log("Image metadata:", imageMetadata);
  console.log("Watermark metadata:", watermarkMetadata);

  // Composite the watermark onto the image
  const outputBuffer = await sharp(imageBuffer)
    .composite([
      {
        input: watermarkBuffer,
        gravity: "center", // Center bottom
      },
    ])
    .webp({ quality: 80 }) // Ensure the output is in webp format
    .toBuffer();

  return outputBuffer;
}
