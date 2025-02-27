import express, { Request, Response } from "express";
import multer from "multer";
import { S3 } from "aws-sdk";
import { createPreviewImage } from "./createPreviewImage";
import { createPreviewVideo } from "./createPreviewVideo";

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize Wasabi S3 client
const s3 = new S3({
  endpoint: "https://s3.wasabisys.com",
  accessKeyId: process.env.WASABI_ACCESS_KEY,
  secretAccessKey: process.env.WASABI_SECRET_KEY,
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
      if (!process.env.WASABI_BUCKET_NAME) {
        throw new Error("WASABI_BUCKET_NAME is not defined");
      }

      const uploadParams = {
        Bucket: process.env.WASABI_BUCKET_NAME,
        Key: `uploads/${Date.now()}-${file.originalname}`,
        Body: processedFileBuffer, // Make sure this is a Buffer
        ContentType: file.mimetype,
      };

      const uploadResult = await s3.upload(uploadParams).promise();

      // Construct the URL for the uploaded file
      const fileUrl = `https://${process.env.WASABI_BUCKET_NAME}.s3.wasabisys.com/${uploadParams.Key}`;

      // Return the file URL to the API server
      res.status(200).json({ url: fileUrl });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).send("Internal server error.");
    }
  }
);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
