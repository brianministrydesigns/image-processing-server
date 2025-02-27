"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPreviewVideo = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const path_1 = __importDefault(require("path"));
const stream_1 = require("stream");
const createPreviewVideo = async (inputVideoBuffer) => {
    const inputImagePath = path_1.default.join(__dirname, "watermark.png");
    if (!inputVideoBuffer) {
        throw new Error("Invalid input video buffer");
    }
    const inputVideoStream = new stream_1.Readable();
    inputVideoStream.push(inputVideoBuffer);
    inputVideoStream.push(null);
    const outputStream = new stream_1.PassThrough();
    const chunks = [];
    outputStream.on("data", (chunk) => {
        chunks.push(chunk);
    });
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(inputVideoStream)
            .input(inputImagePath)
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
exports.createPreviewVideo = createPreviewVideo;
