import { Router, Request, Response } from 'express';
import path from 'path';

const router = Router();

// Route for the upload tester page
router.get('/uploadTester', (_: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'uploadTester.html'));
});

export default router;
