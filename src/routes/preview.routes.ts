import { Router } from 'express';
import multer from 'multer';
import {
  createPreview,
  createImagePreview,
  createVideoPreview,
  retryProcessing,
} from '../controllers/preview.controller';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Legacy endpoint for backward compatibility
router.post('/createPreview', upload.single('file'), createPreview);

// New specific endpoints
router.post('/image', upload.single('file'), createImagePreview);
router.post('/video', upload.single('file'), createVideoPreview);

// Retry processing endpoint
router.post('/retry', retryProcessing);

export default router;
