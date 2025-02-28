import express, { Request, Response } from "express";
import multer from "multer";
import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { createPreviewImage } from "./createPreviewImage";
import { createPreviewVideo } from "./createPreviewVideo";
import path from "path";

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize Wasabi S3 client with region-specific endpoint
const s3Client = new S3Client({
  endpoint: "https://s3.us-central-1.wasabisys.com", // Updated to match your bucket's region
  region: "us-central-1", // Must match the bucket's region
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY || "",
    secretAccessKey: process.env.WASABI_SECRET_KEY || "",
  },
});

// Route for uploading files
app.post(
  "/createPreview",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).send("No file uploaded.");
        return;
      }

      let processedFileBuffer: Buffer;

      // Process the file based on its type
      if (file.mimetype.startsWith("image/")) {
        processedFileBuffer = await createPreviewImage(file.buffer);
      } else if (file.mimetype.startsWith("video/")) {
        processedFileBuffer = await createPreviewVideo(file.buffer);
      } else {
        res.status(400).send("Unsupported file type.");
        return;
      }

      // Upload the processed file to Wasabi
      if (!process.env.WASABI_PUBLIC_BUCKET) {
        throw new Error("WASABI_PUBLIC_BUCKET is not defined");
      }

      const extension = file.mimetype.startsWith("image/") ? "webp" : "mp4";
      const key = `${Date.now()}-${
        path.parse(file.originalname).name
      }.${extension}`;

      const contentType = file.mimetype.startsWith("image/")
        ? "image/webp"
        : "video/mp4";

      const uploadParams = {
        Bucket: process.env.WASABI_PUBLIC_BUCKET,
        Key: key,
        Body: processedFileBuffer,
        ContentType: contentType,
        ACL: ObjectCannedACL.public_read,
      };

      // Use PutObjectCommand to upload the file
      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);

      // Construct the URL for the uploaded file
      const fileUrl = `https://${process.env.WASABI_PUBLIC_BUCKET}.s3.us-central-1.wasabisys.com/${uploadParams.Key}`;

      // Return the file URL to the API server
      res.status(200).json({ url: fileUrl });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).send("Internal server error.");
    }
  }
);

app.get("/uploadTester", (_: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public/uploadTester.html"));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
