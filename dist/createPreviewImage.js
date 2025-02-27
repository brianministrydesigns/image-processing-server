"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPreviewImage = createPreviewImage;
const sharp_1 = __importDefault(require("sharp"));
async function createPreviewImage(inputBuffer) {
    const width = 1920;
    const height = Math.round((width * 9) / 16);
    const image = (0, sharp_1.default)(inputBuffer).resize({
        width: width,
        height: height,
        fit: sharp_1.default.fit.contain,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    const watermark = (0, sharp_1.default)("watermark.png").resize({ width: 200 }).webp();
    const [imageBuffer, watermarkBuffer] = await Promise.all([
        image.toBuffer(),
        watermark.toBuffer(),
    ]);
    const outputBuffer = await (0, sharp_1.default)(imageBuffer)
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
