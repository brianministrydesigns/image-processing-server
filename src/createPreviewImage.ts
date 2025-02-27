import sharp from "sharp";

export async function createPreviewImage(inputBuffer: Buffer): Promise<Buffer> {
  const width = 1920;
  const height = Math.round((width * 9) / 16);

  const image = sharp(inputBuffer).resize({
    width: width,
    height: height,
    fit: sharp.fit.contain,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  const watermark = sharp("watermark.png").resize({ width: 200 }).webp();

  const [imageBuffer, watermarkBuffer] = await Promise.all([
    image.toBuffer(),
    watermark.toBuffer(),
  ]);

  const outputBuffer = await sharp(imageBuffer)
    .composite([
      {
        input: watermarkBuffer,
        gravity: "center", // Center bottom
      },
    ])
    .webp({ quality: 80 })
    .toBuffer();

  return outputBuffer;
}
