import { Router } from 'express';
import multer from 'multer';
import { createPreview } from '../controllers/preview.controller';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

router.post('/createPreview', upload.single('file'), createPreview);

export default router;
