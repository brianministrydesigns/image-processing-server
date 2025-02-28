import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { Readable, PassThrough } from "stream";

export const createPreviewVideo = async (
  inputVideoBuffer: Buffer
): Promise<Buffer> => {
  const watermarkPath = path.join(__dirname, "..", "public", "watermark.png");

  if (!inputVideoBuffer) {
    throw new Error("Invalid input video buffer");
  }

  const inputVideoStream = new Readable();
  inputVideoStream.push(inputVideoBuffer);
  inputVideoStream.push(null);

  const outputStream = new PassThrough();
  const chunks: Buffer[] = [];

  outputStream.on("data", (chunk) => {
    chunks.push(chunk);
  });

  return new Promise((resolve, reject) => {
    ffmpeg(inputVideoStream)
      .input(watermarkPath)
      .complexFilter([
        {
          filter: "overlay",
          options: {
            x: "(main_w-overlay_w)/2",
            y: "(main_h-overlay_h)/2",
          },
        },
      ])
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset veryfast", "-b:v 500k", "-b:a 64k"])
      .format("mp4")
      .pipe(outputStream)
      .on("end", () => {
        console.log("Video processing completed successfully.");
        resolve(Buffer.concat(chunks)); // Return the output video buffer
      })
      .on("error", (err) => {
        console.error("Error processing video:", err);
        reject(new Error("Failed to process video"));
      });
  });
};
