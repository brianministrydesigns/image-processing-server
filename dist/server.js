"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const client_s3_1 = require("@aws-sdk/client-s3");
const createPreviewImage_1 = require("./createPreviewImage");
const createPreviewVideo_1 = require("./createPreviewVideo");
const path_1 = __importDefault(require("path"));
// Initialize express app
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
// Initialize Wasabi S3 client with region-specific endpoint
const s3Client = new client_s3_1.S3Client({
    endpoint: "https://s3.us-central-1.wasabisys.com", // Updated to match your bucket's region
    region: "us-central-1", // Must match the bucket's region
    credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY || "",
        secretAccessKey: process.env.WASABI_SECRET_KEY || "",
    },
});
// Route for uploading files
app.post("/createPreview", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).send("No file uploaded.");
            return;
        }
        let processedFileBuffer;
        // Process the file based on its type
        if (file.mimetype.startsWith("image/")) {
            processedFileBuffer = await (0, createPreviewImage_1.createPreviewImage)(file.buffer);
        }
        else if (file.mimetype.startsWith("video/")) {
            processedFileBuffer = await (0, createPreviewVideo_1.createPreviewVideo)(file.buffer);
        }
        else {
            res.status(400).send("Unsupported file type.");
            return;
        }
        // Upload the processed file to Wasabi
        if (!process.env.WASABI_PUBLIC_BUCKET) {
            throw new Error("WASABI_PUBLIC_BUCKET is not defined");
        }
        const extension = file.mimetype.startsWith("image/") ? "webp" : "mp4";
        const key = `${Date.now()}-${path_1.default.parse(file.originalname).name}.${extension}`;
        const contentType = file.mimetype.startsWith("image/")
            ? "image/webp"
            : "video/mp4";
        const uploadParams = {
            Bucket: process.env.WASABI_PUBLIC_BUCKET,
            Key: key,
            Body: processedFileBuffer,
            ContentType: contentType,
            ACL: client_s3_1.ObjectCannedACL.public_read,
        };
        // Use PutObjectCommand to upload the file
        const command = new client_s3_1.PutObjectCommand(uploadParams);
        await s3Client.send(command);
        // Construct the URL for the uploaded file
        const fileUrl = `https://${process.env.WASABI_PUBLIC_BUCKET}.s3.us-central-1.wasabisys.com/${uploadParams.Key}`;
        // Return the file URL to the API server
        res.status(200).json({ url: fileUrl });
    }
    catch (error) {
        console.error("Error processing file:", error);
        res.status(500).send("Internal server error.");
    }
});
app.get("/upload", (_, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/upload.html"));
});
// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
