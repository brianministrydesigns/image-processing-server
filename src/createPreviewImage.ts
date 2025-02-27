import sharp from "sharp";

export async function createPreviewImage(inputBuffer: Buffer): Promise<Buffer> {
  const width = 1920; // Width for retina displays
  const height = Math.round((width * 9) / 16); // Calculate height for 16:9 aspect ratio

  const image = sharp(inputBuffer)
    .resize({
      width: width,
      height: height,
      fit: sharp.fit.contain,
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
    })
    .webp({ quality: 80 }); // Adjust quality as needed

  const watermark = sharp("watermark.png")
    .resize({ width: 200 }) // Resize watermark to appropriate size
    .png();

  const [imageBuffer, watermarkBuffer] = await Promise.all([
    image.toBuffer(),
    watermark.toBuffer(),
  ]);

  const outputBuffer = await sharp(imageBuffer)
    .composite([{ input: watermarkBuffer, gravity: "southeast" }]) // Place watermark in the bottom-right corner
    .toBuffer(); // Get the output as a buffer

  return outputBuffer; // Return the buffer of the new image
}
